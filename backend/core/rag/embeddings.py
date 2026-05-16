import logging
from typing import Sequence

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

GEMINI_MODEL = "models/gemini-embedding-001"
GEMINI_DIMENSION = 768
BATCH_SIZE = 100
API_BASE = "https://generativelanguage.googleapis.com/v1beta"


class EmbeddingError(Exception):
    """Raised when embedding generation fails."""


class EmbeddingService:
    def __init__(self) -> None:
        self._api_key = settings.GEMINI_API_KEY
        self._local_model = None
        self._use_local = not self._api_key

        if self._use_local:
            self._init_local_model()

    def _init_local_model(self):
        from sentence_transformers import SentenceTransformer
        logger.info("Using local embedding model (all-MiniLM-L6-v2)")
        self._local_model = SentenceTransformer("all-MiniLM-L6-v2")
        self._use_local = True

    def _gemini_embed_batch(self, texts: list[str]) -> list[list[float]]:
        requests = [
            {
                "model": GEMINI_MODEL,
                "content": {"parts": [{"text": t}]},
                "outputDimensionality": GEMINI_DIMENSION,
            }
            for t in texts
        ]
        with httpx.Client(timeout=60) as client:
            resp = client.post(
                f"{API_BASE}/{GEMINI_MODEL}:batchEmbedContents",
                params={"key": self._api_key},
                json={"requests": requests},
            )
        if resp.status_code == 403 and "blocked" in resp.text.lower():
            logger.warning("Gemini API key blocked, falling back to local model")
            self._init_local_model()
            return self._local_embed_batch(texts)
        if resp.status_code != 200:
            raise EmbeddingError(f"Gemini API error {resp.status_code}: {resp.text[:300]}")
        return [e["values"] for e in resp.json()["embeddings"]]

    def _gemini_embed_single(self, text: str) -> list[float]:
        with httpx.Client(timeout=60) as client:
            resp = client.post(
                f"{API_BASE}/{GEMINI_MODEL}:embedContent",
                params={"key": self._api_key},
                json={
                    "model": GEMINI_MODEL,
                    "content": {"parts": [{"text": text}]},
                    "outputDimensionality": GEMINI_DIMENSION,
                },
            )
        if resp.status_code == 403 and "blocked" in resp.text.lower():
            logger.warning("Gemini API key blocked, falling back to local model")
            self._init_local_model()
            return self._local_embed_single(text)
        if resp.status_code != 200:
            raise EmbeddingError(f"Gemini API error {resp.status_code}: {resp.text[:300]}")
        return resp.json()["embedding"]["values"]

    def _local_embed_batch(self, texts: list[str]) -> list[list[float]]:
        embeddings = self._local_model.encode(texts, normalize_embeddings=True)
        return [e.tolist() for e in embeddings]

    def _local_embed_single(self, text: str) -> list[float]:
        embedding = self._local_model.encode([text], normalize_embeddings=True)
        return embedding[0].tolist()

    def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []

        all_embeddings: list[list[float]] = []
        for i in range(0, len(texts), BATCH_SIZE):
            batch = list(texts[i : i + BATCH_SIZE])
            try:
                if self._use_local:
                    batch_embeddings = self._local_embed_batch(batch)
                else:
                    batch_embeddings = self._gemini_embed_batch(batch)
                all_embeddings.extend(batch_embeddings)
            except Exception as e:
                logger.error(
                    "Embedding batch failed",
                    extra={"batch_start": i, "batch_size": len(batch), "error": str(e)},
                )
                raise EmbeddingError(f"Failed to embed batch starting at index {i}: {e}") from e

        logger.info("Embedded documents", extra={"count": len(all_embeddings)})
        return all_embeddings

    def embed_query(self, text: str) -> list[float]:
        if not text.strip():
            raise EmbeddingError("Cannot embed empty query")
        try:
            if self._use_local:
                return self._local_embed_single(text)
            return self._gemini_embed_single(text)
        except Exception as e:
            logger.error("Query embedding failed", extra={"error": str(e)})
            raise EmbeddingError(f"Failed to embed query: {e}") from e
