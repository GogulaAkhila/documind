import logging
from collections.abc import AsyncIterator

import httpx
from django.conf import settings

from core.rag.retrieval import RetrievedChunk

logger = logging.getLogger(__name__)

API_BASE = "https://generativelanguage.googleapis.com/v1beta"
MODEL = "models/gemini-2.5-flash"

SYSTEM_PROMPT = """You are a document assistant that answers questions based on the provided documents.

RULES:
1. Only answer based on the provided context passages. Do not use any external knowledge.
2. For EVERY claim or fact in your answer, include an inline citation in the format [Document Title, Page X].
3. If the context does not contain enough information to answer the question, say so explicitly.
4. Be precise and concise. Prefer direct quotes when appropriate.
5. If multiple documents discuss the same topic, synthesize their information and cite each one.

CONTEXT PASSAGES:
{context}

Answer the user's question based solely on the above context."""


class GenerationError(Exception):
    """Raised when answer generation fails."""


class AnswerGenerator:
    def __init__(self) -> None:
        self._api_key = settings.GEMINI_API_KEY
        if not self._api_key:
            raise GenerationError("GEMINI_API_KEY is not configured")

    def _call_gemini(self, system: str, user: str) -> str:
        with httpx.Client(timeout=120) as client:
            resp = client.post(
                f"{API_BASE}/{MODEL}:generateContent",
                params={"key": self._api_key},
                json={
                    "system_instruction": {"parts": [{"text": system}]},
                    "contents": [{"role": "user", "parts": [{"text": user}]}],
                    "generationConfig": {
                        "temperature": 0.1,
                        "maxOutputTokens": 2048,
                    },
                },
            )
        if resp.status_code != 200:
            raise GenerationError(f"Gemini API error {resp.status_code}: {resp.text[:300]}")
        candidates = resp.json().get("candidates", [])
        if not candidates:
            raise GenerationError("No response candidates from Gemini")
        return candidates[0]["content"]["parts"][0]["text"]

    def generate(self, query: str, contexts: list[RetrievedChunk]) -> str:
        if not contexts:
            return "I don't have enough context to answer this question. Please upload relevant documents first."

        context_text = self._format_contexts(contexts)
        system_message = SYSTEM_PROMPT.format(context=context_text)

        try:
            answer = self._call_gemini(system_message, query)
            logger.info("Answer generated", extra={"query": query[:100], "answer_length": len(answer)})
            return answer
        except Exception as e:
            logger.error("Generation failed", extra={"error": str(e)})
            raise GenerationError(f"Failed to generate answer: {e}") from e

    async def generate_stream(self, query: str, contexts: list[RetrievedChunk]) -> AsyncIterator[str]:
        if not contexts:
            yield "I don't have enough context to answer this question. Please upload relevant documents first."
            return

        context_text = self._format_contexts(contexts)
        system_message = SYSTEM_PROMPT.format(context=context_text)

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream(
                    "POST",
                    f"{API_BASE}/{MODEL}:streamGenerateContent",
                    params={"key": self._api_key, "alt": "sse"},
                    json={
                        "system_instruction": {"parts": [{"text": system_message}]},
                        "contents": [{"role": "user", "parts": [{"text": query}]}],
                        "generationConfig": {
                            "temperature": 0.1,
                            "maxOutputTokens": 2048,
                        },
                    },
                ) as resp:
                    import json
                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            data = json.loads(line[6:])
                            candidates = data.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                for part in parts:
                                    text = part.get("text", "")
                                    if text:
                                        yield text
        except Exception as e:
            logger.error("Streaming generation failed", extra={"error": str(e)})
            raise GenerationError(f"Streaming failed: {e}") from e

    def _format_contexts(self, contexts: list[RetrievedChunk]) -> str:
        formatted_parts: list[str] = []
        for i, ctx in enumerate(contexts, 1):
            title = ctx.document_title or "Untitled Document"
            formatted_parts.append(
                f"[Passage {i}] From: {title}, Page {ctx.page_number}, "
                f"Section: {ctx.section_type}\n{ctx.content}"
            )
        return "\n\n---\n\n".join(formatted_parts)
