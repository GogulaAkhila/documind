import logging

import httpx
from django.conf import settings

from core.rag.retrieval import RetrievedChunk

logger = logging.getLogger(__name__)

JINA_RERANK_URL = "https://api.jina.ai/v1/rerank"
JINA_MODEL = "jina-reranker-v2-base-multilingual"
DEFAULT_TOP_K = 5
REQUEST_TIMEOUT = 30.0


class RerankerError(Exception):
    """Raised when reranking fails."""


class JinaReranker:
    def __init__(self) -> None:
        self.api_key = settings.JINA_API_KEY
        if not self.api_key:
            raise RerankerError("JINA_API_KEY is not configured")

    def rerank(
        self,
        query: str,
        documents: list[RetrievedChunk],
        top_k: int = DEFAULT_TOP_K,
    ) -> list[RetrievedChunk]:
        if not documents:
            return []

        if len(documents) <= top_k:
            return documents

        texts = [doc.content for doc in documents]

        payload = {
            "model": JINA_MODEL,
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
        except httpx.TimeoutException as e:
            logger.error("Jina reranker timeout", extra={"error": str(e)})
            raise RerankerError("Reranker request timed out") from e
        except httpx.HTTPStatusError as e:
            logger.error(
                "Jina reranker HTTP error",
                extra={"status": e.response.status_code, "body": e.response.text[:500]},
            )
            raise RerankerError(f"Reranker returned {e.response.status_code}") from e

        data = response.json()
        results_data = data.get("results", [])

        reranked: list[RetrievedChunk] = []
        for result in results_data:
            idx = result["index"]
            relevance_score = result["relevance_score"]
            chunk = documents[idx]
            chunk.score = relevance_score
            reranked.append(chunk)

        logger.info(
            "Reranked documents",
            extra={"input_count": len(documents), "output_count": len(reranked)},
        )
        return reranked
