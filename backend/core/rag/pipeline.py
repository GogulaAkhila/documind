import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import numpy as np
from django.conf import settings

from core.rag.confidence import ConfidenceLevel, score_retrieval_confidence
from core.rag.generation import AnswerGenerator
from core.rag.guardrails import GroundingResult, HallucinationGuardrail
from core.rag.hyde import HyDEGenerator
from core.rag.query_classifier import QueryType, classify_query
from core.rag.query_expansion import QueryExpander
from core.rag.reranker import JinaReranker
from core.rag.retrieval import HybridRetriever, RetrievedChunk
from core.rag.semantic_cache import SemanticCache
from core.rag.tracing import PipelineTrace
from core.utils.citations import extract_citations

logger = logging.getLogger(__name__)


@dataclass
class RAGResponse:
    answer: str
    citations: list[dict[str, Any]]
    retrieved_chunks: list[RetrievedChunk]
    grounding: GroundingResult
    expanded_queries: list[str] = field(default_factory=list)
    confidence_level: str = "high"
    retrieval_score: float = 0.0
    flagged_claims: list[str] = field(default_factory=list)
    query_type: str = "general"


class PipelineError(Exception):
    """Raised when the RAG pipeline encounters a fatal error."""


class RAGPipeline:
    def __init__(self) -> None:
        self.query_expander = QueryExpander()
        self.retriever = HybridRetriever()
        self.reranker = JinaReranker()
        self.generator = AnswerGenerator()
        self.guardrail = HallucinationGuardrail()
        self.hyde_generator = HyDEGenerator()
        self.semantic_cache = SemanticCache()

    def query(
        self,
        user_query: str,
        collection_id: str,
        retrieval_top_k: int | None = None,
        rerank_top_k: int | None = None,
    ) -> RAGResponse:
        retrieval_top_k = retrieval_top_k or settings.RAG_RETRIEVAL_TOP_K
        rerank_top_k = rerank_top_k or settings.RAG_RERANK_TOP_K

        if not user_query.strip():
            raise PipelineError("Query cannot be empty")

        trace = PipelineTrace()
        trace.start()

        # Classify query for adaptive strategies
        query_type = classify_query(user_query)

        # Check semantic cache before doing any work
        with trace.stage("cache_lookup") as meta:
            query_embedding = self.retriever.embedding_service.embed_query(user_query)
            cached = self.semantic_cache.lookup(user_query, query_embedding, collection_id)
            meta["hit"] = cached is not None

        if cached:
            trace.finish()
            trace.log_summary()
            return RAGResponse(
                answer=cached.answer,
                citations=cached.citations,
                retrieved_chunks=[],
                grounding=GroundingResult(is_grounded=True, confidence=1.0),
                confidence_level=cached.confidence_level,
                retrieval_score=cached.retrieval_score,
                query_type=query_type.value,
            )

        # Query expansion
        with trace.stage("expansion") as meta:
            expanded_queries = self.query_expander.expand(user_query)
            meta["queries_generated"] = len(expanded_queries)

        logger.info(
            "Pipeline started",
            extra={
                "query": user_query[:100],
                "query_type": query_type.value,
                "expanded_count": len(expanded_queries),
            },
        )

        # HyDE for short/vague queries
        hyde_document = None
        if settings.RAG_HYDE_ENABLED and query_type == QueryType.SHORT_VAGUE:
            with trace.stage("hyde") as meta:
                hyde_document = self.hyde_generator.generate_hypothetical_document(user_query)
                meta["generated"] = hyde_document is not None

        # Retrieval
        with trace.stage("retrieval") as meta:
            all_chunks: list[RetrievedChunk] = []
            for q in expanded_queries:
                if hyde_document and q == user_query:
                    chunks = self.retriever.hybrid_search_with_hyde(
                        query=q, hyde_document=hyde_document,
                        collection_id=collection_id, top_k=retrieval_top_k,
                    )
                else:
                    chunks = self.retriever.hybrid_search(
                        query=q, collection_id=collection_id, top_k=retrieval_top_k,
                    )
                all_chunks.extend(chunks)
            meta["total_candidates"] = len(all_chunks)

        # Deduplication (ID-based then semantic)
        with trace.stage("dedup") as meta:
            deduplicated = self._deduplicate_chunks(all_chunks)
            meta["after_id_dedup"] = len(deduplicated)
            deduplicated = self._semantic_deduplicate(deduplicated)
            meta["after_semantic_dedup"] = len(deduplicated)
            meta["removed"] = len(all_chunks) - len(deduplicated)

        logger.info("Retrieved and deduplicated", extra={"count": len(deduplicated)})

        # Reranking
        with trace.stage("reranking") as meta:
            reranked = self.reranker.rerank(
                query=user_query, documents=deduplicated, top_k=rerank_top_k,
            )
            meta["output_count"] = len(reranked)
            if reranked:
                meta["top_score"] = round(reranked[0].score, 4)

        # Confidence scoring
        confidence = score_retrieval_confidence(reranked)

        if confidence.should_abstain:
            trace.finish()
            trace.log_summary()
            logger.info("Low retrieval confidence, abstaining", extra={"score": confidence.score})
            return RAGResponse(
                answer="I don't have enough information in the uploaded documents to answer this question accurately. Please try rephrasing your question or upload more relevant documents.",
                citations=[],
                retrieved_chunks=reranked,
                grounding=GroundingResult(is_grounded=True, confidence=0.0),
                expanded_queries=expanded_queries,
                confidence_level=confidence.level.value,
                retrieval_score=confidence.score,
                query_type=query_type.value,
            )

        # Context budgeting — take chunks within token budget
        with trace.stage("context_budget") as meta:
            budgeted = self._apply_context_budget(reranked)
            meta["chunks_before"] = len(reranked)
            meta["chunks_after"] = len(budgeted)

        # Generation
        with trace.stage("generation") as meta:
            answer = self.generator.generate(
                query=user_query, contexts=budgeted, confidence_level=confidence.level,
            )
            meta["answer_length"] = len(answer)

        # Grounding guardrail
        with trace.stage("guardrail") as meta:
            grounding = self.guardrail.check(
                answer=answer, contexts=[ch.content for ch in budgeted],
            )
            meta["is_grounded"] = grounding.is_grounded
            meta["confidence"] = grounding.confidence

        flagged = grounding.flagged_claims if not grounding.is_grounded else []
        if flagged:
            logger.warning(
                "Answer failed grounding check",
                extra={"flagged_claims": flagged, "confidence": grounding.confidence},
            )

        citations = extract_citations(answer, budgeted)

        # Cache the result
        self.semantic_cache.store(
            query=user_query,
            query_embedding=query_embedding,
            collection_id=collection_id,
            answer=answer,
            citations=citations,
            confidence_level=confidence.level.value,
            retrieval_score=confidence.score,
        )

        trace.finish()
        trace.log_summary()

        return RAGResponse(
            answer=answer,
            citations=citations,
            retrieved_chunks=reranked,
            grounding=grounding,
            expanded_queries=expanded_queries,
            confidence_level=confidence.level.value,
            retrieval_score=confidence.score,
            flagged_claims=flagged,
            query_type=query_type.value,
        )

    async def query_stream(
        self,
        user_query: str,
        collection_id: str,
        retrieval_top_k: int | None = None,
        rerank_top_k: int | None = None,
    ) -> AsyncIterator[dict]:
        """Stream pipeline: runs retrieval synchronously, then streams generation tokens."""
        retrieval_top_k = retrieval_top_k or settings.RAG_RETRIEVAL_TOP_K
        rerank_top_k = rerank_top_k or settings.RAG_RERANK_TOP_K

        if not user_query.strip():
            raise PipelineError("Query cannot be empty")

        trace = PipelineTrace()
        trace.start()

        query_type = classify_query(user_query)

        yield {"type": "phase", "data": "searching"}

        # Cache check
        with trace.stage("cache_lookup") as meta:
            query_embedding = self.retriever.embedding_service.embed_query(user_query)
            cached = self.semantic_cache.lookup(user_query, query_embedding, collection_id)
            meta["hit"] = cached is not None

        if cached:
            trace.finish()
            trace.log_summary()
            yield {"type": "confidence", "data": {"level": cached.confidence_level, "score": cached.retrieval_score}}
            yield {"type": "sources", "data": cached.citations}
            yield {"type": "phase", "data": "generating"}
            yield {"type": "token", "data": cached.answer}
            yield {
                "type": "done",
                "data": {
                    "citations": cached.citations,
                    "query_type": query_type.value,
                    "confidence_level": cached.confidence_level,
                    "retrieval_score": cached.retrieval_score,
                    "cached": True,
                },
            }
            return

        # Query expansion
        with trace.stage("expansion") as meta:
            expanded_queries = self.query_expander.expand(user_query)
            meta["queries_generated"] = len(expanded_queries)

        # HyDE for short/vague queries
        hyde_document = None
        if settings.RAG_HYDE_ENABLED and query_type == QueryType.SHORT_VAGUE:
            with trace.stage("hyde") as meta:
                hyde_document = self.hyde_generator.generate_hypothetical_document(user_query)
                meta["generated"] = hyde_document is not None

        # Retrieval
        with trace.stage("retrieval") as meta:
            all_chunks: list[RetrievedChunk] = []
            for q in expanded_queries:
                if hyde_document and q == user_query:
                    chunks = self.retriever.hybrid_search_with_hyde(
                        query=q, hyde_document=hyde_document,
                        collection_id=collection_id, top_k=retrieval_top_k,
                    )
                else:
                    chunks = self.retriever.hybrid_search(
                        query=q, collection_id=collection_id, top_k=retrieval_top_k,
                    )
                all_chunks.extend(chunks)
            meta["total_candidates"] = len(all_chunks)

        # Deduplication
        with trace.stage("dedup") as meta:
            deduplicated = self._deduplicate_chunks(all_chunks)
            meta["after_id_dedup"] = len(deduplicated)
            deduplicated = self._semantic_deduplicate(deduplicated)
            meta["after_semantic_dedup"] = len(deduplicated)

        yield {"type": "phase", "data": "reranking"}

        # Reranking
        with trace.stage("reranking") as meta:
            reranked = self.reranker.rerank(
                query=user_query, documents=deduplicated, top_k=rerank_top_k,
            )
            meta["output_count"] = len(reranked)
            if reranked:
                meta["top_score"] = round(reranked[0].score, 4)

        # Confidence scoring
        confidence = score_retrieval_confidence(reranked)

        if confidence.should_abstain:
            trace.finish()
            trace.log_summary()
            yield {"type": "confidence", "data": {"level": "low", "score": confidence.score}}
            yield {"type": "sources", "data": []}
            yield {"type": "phase", "data": "generating"}
            yield {"type": "token", "data": "I don't have enough information in the uploaded documents to answer this question accurately. Please try rephrasing your question or upload more relevant documents."}
            yield {
                "type": "done",
                "data": {
                    "citations": [],
                    "query_type": query_type.value,
                    "confidence_level": "low",
                    "retrieval_score": confidence.score,
                },
            }
            return

        yield {"type": "confidence", "data": {"level": confidence.level.value, "score": confidence.score}}

        # Context budgeting
        with trace.stage("context_budget") as meta:
            budgeted = self._apply_context_budget(reranked)
            meta["chunks_before"] = len(reranked)
            meta["chunks_after"] = len(budgeted)

        sources = [
            {
                "title": chunk.document_title,
                "page": chunk.page_number,
                "section": chunk.section_type,
                "score": chunk.score,
            }
            for chunk in budgeted
        ]
        yield {"type": "sources", "data": sources}

        yield {"type": "phase", "data": "generating"}

        # Stream generation tokens
        full_answer = ""
        async for token in self.generator.generate_stream(
            query=user_query, contexts=budgeted, confidence_level=confidence.level,
        ):
            full_answer += token
            yield {"type": "token", "data": token}

        # Post-generation guardrail
        with trace.stage("guardrail") as meta:
            grounding = self.guardrail.check(
                answer=full_answer, contexts=[ch.content for ch in budgeted],
            )
            meta["is_grounded"] = grounding.is_grounded
            meta["confidence"] = grounding.confidence

        flagged = grounding.flagged_claims if not grounding.is_grounded else []
        citations = extract_citations(full_answer, budgeted)

        # Cache the result
        self.semantic_cache.store(
            query=user_query,
            query_embedding=query_embedding,
            collection_id=collection_id,
            answer=full_answer,
            citations=citations,
            confidence_level=confidence.level.value,
            retrieval_score=confidence.score,
        )

        trace.finish()
        trace.log_summary()

        yield {
            "type": "done",
            "data": {
                "citations": citations,
                "flagged_claims": flagged,
                "grounding": {
                    "is_grounded": grounding.is_grounded,
                    "confidence": grounding.confidence,
                },
                "query_type": query_type.value,
                "confidence_level": confidence.level.value,
                "retrieval_score": confidence.score,
            },
        }

    def _deduplicate_chunks(self, chunks: list[RetrievedChunk]) -> list[RetrievedChunk]:
        seen: set[str] = set()
        unique: list[RetrievedChunk] = []
        for chunk in chunks:
            if chunk.chunk_id not in seen:
                seen.add(chunk.chunk_id)
                unique.append(chunk)
        return unique

    def _semantic_deduplicate(self, chunks: list[RetrievedChunk]) -> list[RetrievedChunk]:
        """Remove near-duplicate chunks using cosine similarity."""
        threshold = settings.RAG_DEDUP_SIMILARITY_THRESHOLD
        if len(chunks) <= 1:
            return chunks

        try:
            texts = [c.content for c in chunks]
            embeddings = self.retriever.embedding_service.embed_documents(texts)
        except Exception as e:
            logger.warning("Semantic dedup embedding failed, skipping", extra={"error": str(e)})
            return chunks

        emb_array = np.array(embeddings)
        norms = np.linalg.norm(emb_array, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1, norms)
        normalized = emb_array / norms

        kept_indices = [0]
        for i in range(1, len(chunks)):
            candidate = normalized[i]
            is_dup = False
            for kept_idx in kept_indices:
                if float(np.dot(candidate, normalized[kept_idx])) >= threshold:
                    is_dup = True
                    break
            if not is_dup:
                kept_indices.append(i)

        deduplicated = [chunks[i] for i in kept_indices]
        removed = len(chunks) - len(deduplicated)
        if removed > 0:
            logger.info("Semantic dedup", extra={"before": len(chunks), "after": len(deduplicated), "removed": removed})
        return deduplicated

    def _apply_context_budget(self, chunks: list[RetrievedChunk]) -> list[RetrievedChunk]:
        """Select chunks within a token budget (approximate: 1 token ≈ 4 chars)."""
        budget = settings.RAG_CONTEXT_BUDGET_TOKENS
        budgeted: list[RetrievedChunk] = []
        tokens_used = 0

        for chunk in chunks:
            chunk_tokens = len(chunk.content) // 4
            if tokens_used + chunk_tokens > budget and budgeted:
                break
            budgeted.append(chunk)
            tokens_used += chunk_tokens

        return budgeted
