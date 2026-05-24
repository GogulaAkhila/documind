"""Hypothetical Document Embeddings (HyDE) for improved retrieval on vague queries.

Generates a hypothetical answer paragraph and embeds that instead of the raw query
for dense retrieval. Sparse (BM25) search still uses the original query text.
"""
import logging

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

API_BASE = "https://generativelanguage.googleapis.com/v1beta"

HYDE_PROMPT = """You are a document assistant. Given the following question, write a detailed 
paragraph (3-5 sentences) that would be a good answer to this question. Write as if you are 
quoting from an authoritative document. Be specific and use technical language appropriate 
to the topic. Do NOT say "I don't know" — generate a plausible, detailed answer.

Question: {query}

Hypothetical answer paragraph:"""


class HyDEGenerator:
    def __init__(self) -> None:
        self._api_key = settings.GEMINI_API_KEY

    def generate_hypothetical_document(self, query: str) -> str | None:
        """Generate a hypothetical answer document for embedding-based retrieval.

        Returns the hypothetical document text, or None on failure (caller
        falls back to standard embedding).
        """
        if not self._api_key:
            return None

        model = settings.RAG_GENERATION_MODEL
        prompt = HYDE_PROMPT.format(query=query)

        try:
            with httpx.Client(timeout=15) as client:
                resp = client.post(
                    f"{API_BASE}/{model}:generateContent",
                    params={"key": self._api_key},
                    json={
                        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "temperature": 0.7,
                            "maxOutputTokens": 512,
                        },
                    },
                )

            if resp.status_code != 200:
                logger.warning("HyDE generation failed", extra={"status": resp.status_code})
                return None

            candidates = resp.json().get("candidates", [])
            if not candidates:
                return None

            text = candidates[0]["content"]["parts"][0]["text"].strip()
            logger.info(
                "HyDE document generated",
                extra={"length": len(text), "query": query[:80]},
            )
            return text

        except Exception as e:
            logger.warning("HyDE generation error, falling back to standard retrieval", extra={"error": str(e)})
            return None
