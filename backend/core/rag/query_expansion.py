import json
import logging

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

API_BASE = "https://generativelanguage.googleapis.com/v1beta"
MODEL = "models/gemini-2.5-flash"

EXPANSION_PROMPT = """Given the following user question about the uploaded documents, generate 3 alternative 
formulations of the same question that might help retrieve relevant passages.

Return ONLY a JSON array of strings, no other text. Example: ["question 1", "question 2", "question 3"]

User question: {query}"""


class QueryExpansionError(Exception):
    """Raised when query expansion fails."""


class QueryExpander:
    def __init__(self) -> None:
        self._api_key = settings.GEMINI_API_KEY

    def expand(self, original_query: str) -> list[str]:
        if not self._api_key:
            return [original_query]

        try:
            with httpx.Client(timeout=30) as client:
                resp = client.post(
                    f"{API_BASE}/{MODEL}:generateContent",
                    params={"key": self._api_key},
                    json={
                        "contents": [{"role": "user", "parts": [{"text": EXPANSION_PROMPT.format(query=original_query)}]}],
                        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 512},
                    },
                )

            if resp.status_code != 200:
                logger.warning("Query expansion API error, using original query only")
                return [original_query]

            candidates = resp.json().get("candidates", [])
            if not candidates:
                return [original_query]

            text = candidates[0]["content"]["parts"][0]["text"].strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

            queries = json.loads(text)
            if isinstance(queries, list) and all(isinstance(q, str) for q in queries):
                result = [original_query] + queries[:3]
                logger.info("Query expanded", extra={"original": original_query, "expanded_count": len(result)})
                return result
        except Exception as e:
            logger.warning("Query expansion failed, using original", extra={"error": str(e)})

        return [original_query]
