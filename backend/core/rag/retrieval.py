import logging
from dataclasses import dataclass, field

from django.conf import settings

from core.rag.embeddings import EmbeddingService
from core.vectorstore.pgvector_store import PgVectorStore

logger = logging.getLogger(__name__)


@dataclass
class RetrievedChunk:
    chunk_id: str
    content: str
    section_type: str
    page_number: int
    document_title: str
    score: float
    metadata: dict = field(default_factory=dict)


class RetrievalError(Exception):
    """Raised when retrieval operations fail."""


class HybridRetriever:
    def __init__(self) -> None:
        self.embedding_service = EmbeddingService()
        self.vector_store = PgVectorStore()

    def dense_search(
        self,
        query_embedding: list[float],
        collection_id: str,
        top_k: int | None = None,
    ) -> list[RetrievedChunk]:
        top_k = top_k or settings.RAG_RETRIEVAL_TOP_K
        try:
            results = self.vector_store.similarity_search(
                query_embedding=query_embedding,
                collection_id=collection_id,
                top_k=top_k,
            )
            return [
                RetrievedChunk(
                    chunk_id=r["id"],
                    content=r["content"],
                    section_type=r.get("section_type", "other"),
                    page_number=r.get("page_number", 1),
                    document_title=r.get("document_title", ""),
                    score=r.get("score", 0.0),
                    metadata=r.get("metadata", {}),
                )
                for r in results
            ]
        except Exception as e:
            logger.error("Dense search failed", extra={"error": str(e)})
            raise RetrievalError(f"Dense search failed: {e}") from e

    def sparse_search(
        self,
        query: str,
        collection_id: str,
        top_k: int | None = None,
    ) -> list[RetrievedChunk]:
        top_k = top_k or settings.RAG_RETRIEVAL_TOP_K
        try:
            results = self.vector_store.full_text_search(
                query=query,
                collection_id=collection_id,
                top_k=top_k,
            )
            return [
                RetrievedChunk(
                    chunk_id=r["id"],
                    content=r["content"],
                    section_type=r.get("section_type", "other"),
                    page_number=r.get("page_number", 1),
                    document_title=r.get("document_title", ""),
                    score=r.get("score", 0.0),
                    metadata=r.get("metadata", {}),
                )
                for r in results
            ]
        except Exception as e:
            logger.error("Sparse search failed", extra={"error": str(e)})
            raise RetrievalError(f"Sparse search failed: {e}") from e

    def hybrid_search(
        self,
        query: str,
        collection_id: str,
        top_k: int | None = None,
    ) -> list[RetrievedChunk]:
        top_k = top_k or settings.RAG_RETRIEVAL_TOP_K
        query_embedding = self.embedding_service.embed_query(query)

        dense_results = self.dense_search(query_embedding, collection_id, top_k)
        sparse_results = self.sparse_search(query, collection_id, top_k)

        fused = self._reciprocal_rank_fusion(dense_results, sparse_results)

        return fused[:top_k]

    def hybrid_search_with_hyde(
        self,
        query: str,
        hyde_document: str,
        collection_id: str,
        top_k: int | None = None,
    ) -> list[RetrievedChunk]:
        """Hybrid search using HyDE embedding for dense, original query for sparse."""
        top_k = top_k or settings.RAG_RETRIEVAL_TOP_K
        hyde_embedding = self.embedding_service.embed_query(hyde_document)

        dense_results = self.dense_search(hyde_embedding, collection_id, top_k)
        sparse_results = self.sparse_search(query, collection_id, top_k)

        fused = self._reciprocal_rank_fusion(dense_results, sparse_results)
        return fused[:top_k]

    def _reciprocal_rank_fusion(
        self,
        dense_results: list[RetrievedChunk],
        sparse_results: list[RetrievedChunk],
    ) -> list[RetrievedChunk]:
        scores: dict[str, float] = {}
        chunk_map: dict[str, RetrievedChunk] = {}

        rrf_k = settings.RAG_RRF_K

        for rank, chunk in enumerate(dense_results):
            rrf_score = 1.0 / (rrf_k + rank + 1)
            scores[chunk.chunk_id] = scores.get(chunk.chunk_id, 0.0) + rrf_score
            chunk_map[chunk.chunk_id] = chunk

        for rank, chunk in enumerate(sparse_results):
            rrf_score = 1.0 / (rrf_k + rank + 1)
            scores[chunk.chunk_id] = scores.get(chunk.chunk_id, 0.0) + rrf_score
            if chunk.chunk_id not in chunk_map:
                chunk_map[chunk.chunk_id] = chunk

        sorted_ids = sorted(scores.keys(), key=lambda cid: scores[cid], reverse=True)

        fused_results: list[RetrievedChunk] = []
        for chunk_id in sorted_ids:
            chunk = chunk_map[chunk_id]
            chunk.score = scores[chunk_id]
            fused_results.append(chunk)

        return fused_results
