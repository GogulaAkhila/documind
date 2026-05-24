import logging

import httpx
from django.conf import settings

from core.rag.retrieval import RetrievedChunk

logger = logging.getLogger(__name__)

JINA_RERANK_URL = "https://api.jina.ai/v1/rerank"
REQUEST_TIMEOUT = 30.0


class RerankerError(Exception):
    """Raised when reranking fails."""


class JinaReranker:
    def __init__(self) -> None:
        self.api_key = getattr(settings, 'JINA_API_KEY', '') or ''
        if not self.api_key:
            logger.warning("JINA_API_KEY not configured, reranker will use RRF fallback")

    def rerank(
        self,
        query: str,
        documents: list[RetrievedChunk],
        top_k: int | None = None,
    ) -> list[RetrievedChunk]:
        top_k = top_k or settings.RAG_RERANK_TOP_K
        if not documents:
            return []
        if len(documents) <= top_k:
            return documents
        if not self.api_key:
            logger.info("No reranker API key, using RRF ordering")
            return documents[:top_k]

        texts = [doc.content for doc in documents]
        payload = {
            "model": settings.RAG_RERANKER_MODEL,
            "query": query,
            "documents": texts,
            "top_n": top_k,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
                response = client.post(JINA_RERANK_URL, json=payload, headers=headers)
                response.raise_for_status()
        except (httpx.TimeoutException, httpx.HTTPStatusError) as e:
            logger.warning("Reranker API failed, falling back to RRF ordering", extra={"error": str(e)})
            return documents[:top_k]

        data = response.json()
        results_data = data.get("results", [])

        reranked: list[RetrievedChunk] = []
        for result in results_data:
            idx = result["index"]
            chunk = documents[idx]
            chunk.score = result["relevance_score"]
            reranked.append(chunk)

        logger.info("Reranked documents", extra={"input_count": len(documents), "output_count": len(reranked)})
        return reranked
