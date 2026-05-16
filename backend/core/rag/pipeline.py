import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

from core.rag.generation import AnswerGenerator
from core.rag.guardrails import GroundingResult, HallucinationGuardrail
from core.rag.query_expansion import QueryExpander
from core.rag.reranker import JinaReranker
from core.rag.retrieval import HybridRetriever, RetrievedChunk
from core.utils.citations import extract_citations

logger = logging.getLogger(__name__)

DEFAULT_RETRIEVAL_TOP_K = 20
DEFAULT_RERANK_TOP_K = 5


@dataclass
class RAGResponse:
    answer: str
    citations: list[dict[str, Any]]
    retrieved_chunks: list[RetrievedChunk]
    grounding: GroundingResult
    expanded_queries: list[str] = field(default_factory=list)


class PipelineError(Exception):
    """Raised when the RAG pipeline encounters a fatal error."""


class RAGPipeline:
    def __init__(self) -> None:
        self.query_expander = QueryExpander()
        self.retriever = HybridRetriever()
        self.reranker = JinaReranker()
        self.generator = AnswerGenerator()
        self.guardrail = HallucinationGuardrail()

    def query(
        self,
        user_query: str,
        collection_id: str,
        retrieval_top_k: int = DEFAULT_RETRIEVAL_TOP_K,
        rerank_top_k: int = DEFAULT_RERANK_TOP_K,
    ) -> RAGResponse:
        if not user_query.strip():
            raise PipelineError("Query cannot be empty")

        expanded_queries = self.query_expander.expand(user_query)
        logger.info(
            "Pipeline started",
            extra={"query": user_query[:100], "expanded_count": len(expanded_queries)},
        )

        all_chunks: list[RetrievedChunk] = []
        for q in expanded_queries:
            chunks = self.retriever.hybrid_search(
                query=q,
                collection_id=collection_id,
                top_k=retrieval_top_k,
            )
            all_chunks.extend(chunks)

        deduplicated = self._deduplicate_chunks(all_chunks)
        logger.info("Retrieved and deduplicated", extra={"count": len(deduplicated)})

        reranked = self.reranker.rerank(
            query=user_query,
            documents=deduplicated,
            top_k=rerank_top_k,
        )

        answer = self.generator.generate(query=user_query, contexts=reranked)

        grounding = self.guardrail.check(answer=answer, contexts=[ch.content for ch in reranked])
        if not grounding.is_grounded:
            logger.warning(
                "Answer failed grounding check",
                extra={
                    "flagged_claims": grounding.flagged_claims,
                    "confidence": grounding.confidence,
                },
            )

        citations = extract_citations(answer, reranked)

        return RAGResponse(
            answer=answer,
            citations=citations,
            retrieved_chunks=reranked,
            grounding=grounding,
            expanded_queries=expanded_queries,
        )

    async def query_stream(
        self,
        user_query: str,
        collection_id: str,
        retrieval_top_k: int = DEFAULT_RETRIEVAL_TOP_K,
        rerank_top_k: int = DEFAULT_RERANK_TOP_K,
    ) -> AsyncIterator[dict]:
        if not user_query.strip():
            raise PipelineError("Query cannot be empty")

        expanded_queries = self.query_expander.expand(user_query)

        all_chunks: list[RetrievedChunk] = []
        for q in expanded_queries:
            chunks = self.retriever.hybrid_search(
                query=q,
                collection_id=collection_id,
                top_k=retrieval_top_k,
            )
            all_chunks.extend(chunks)

        deduplicated = self._deduplicate_chunks(all_chunks)

        reranked = self.reranker.rerank(
            query=user_query,
            documents=deduplicated,
            top_k=rerank_top_k,
        )

        sources = [
            {
                "title": chunk.document_title,
                "page": chunk.page_number,
                "section": chunk.section_type,
                "score": chunk.score,
            }
            for chunk in reranked
        ]
        yield {"type": "sources", "data": sources}

        async for token in self.generator.generate_stream(
            query=user_query, contexts=reranked
        ):
            yield {"type": "token", "data": token}

    def _deduplicate_chunks(self, chunks: list[RetrievedChunk]) -> list[RetrievedChunk]:
        seen: set[str] = set()
        unique: list[RetrievedChunk] = []
        for chunk in chunks:
            if chunk.chunk_id not in seen:
                seen.add(chunk.chunk_id)
                unique.append(chunk)
        return unique
