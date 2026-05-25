"""Conversational query rewriter — resolves follow-up references using chat history.

Enterprise RAG pattern: before retrieval, use one LLM call to combine the
current question with recent conversation history and rewrite it into a
standalone, self-contained query. This resolves pronouns ("it", "this"),
ellipsis ("explain more"), and implicit references that would otherwise
cause retrieval to fail on follow-up turns.
"""

import logging

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

API_BASE = "https://generativelanguage.googleapis.com/v1beta"

REWRITE_PROMPT = """Given the conversation history and the latest user question, rewrite the question as a standalone, self-contained question that can be understood without the conversation history.

Rules:
- Replace all pronouns (it, this, these, that, which one, them, etc.) with the specific nouns they refer to
- Fill in any omitted subjects, objects, or context from the conversation
- Preserve the user's original intent — do not add new topics or change meaning
- If the question is ALREADY standalone and complete, return it unchanged
- Output ONLY the rewritten question — no explanation, no preamble

CONVERSATION HISTORY:
{history}

LATEST USER QUESTION: {question}

REWRITTEN STANDALONE QUESTION:"""


def _format_history(chat_history: list[dict]) -> str:
    """Format chat history as a readable transcript for the LLM."""
    lines = []
    for msg in chat_history:
        role = msg.get("role", "user").upper()
        content = msg.get("content", "")
        if len(content) > 500:
            content = content[:500] + "..."
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


def rewrite_with_history(
    query: str,
    chat_history: list[dict],
    max_history_turns: int = 6,
) -> str:
    """Rewrite a follow-up query into a standalone query using chat history.

    Args:
        query: The latest user question.
        chat_history: List of prior messages [{"role": "user"|"assistant", "content": "..."}].
        max_history_turns: Max number of recent messages to include (default 6 = ~3 exchanges).

    Returns:
        The rewritten standalone query, or the original query if rewriting fails.
    """
    if not chat_history:
        return query

    recent = chat_history[-max_history_turns:]
    history_text = _format_history(recent)
    prompt = REWRITE_PROMPT.format(history=history_text, question=query)

    api_key = settings.GEMINI_API_KEY
    model = settings.RAG_GENERATION_MODEL

    try:
        with httpx.Client(timeout=30) as client:
            resp = client.post(
                f"{API_BASE}/{model}:generateContent",
                params={"key": api_key},
                json={
                    "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.0,
                        "maxOutputTokens": 256,
                    },
                },
            )

        if resp.status_code != 200:
            logger.warning("Query rewrite API error %d, using original", resp.status_code)
            return query

        candidates = resp.json().get("candidates", [])
        if not candidates:
            return query

        rewritten = candidates[0]["content"]["parts"][0]["text"].strip()

        if not rewritten or len(rewritten) > len(query) * 5:
            return query

        logger.info(
            "Query rewritten",
            extra={"original": query[:100], "rewritten": rewritten[:100]},
        )
        return rewritten

    except Exception as e:
        logger.warning("Query rewrite failed, using original", extra={"error": str(e)})
        return query


def needs_rewriting(query: str, chat_history: list[dict]) -> bool:
    """Heuristic check: does this query likely need history-aware rewriting?

    Avoids the LLM call for obviously standalone queries to save latency.
    """
    if not chat_history:
        return False

    q = query.lower().strip()
    word_count = len(q.split())

    pronoun_indicators = {
        "it", "its", "this", "that", "these", "those", "them", "they",
        "their", "which", "the same", "above", "previous",
    }
    for indicator in pronoun_indicators:
        if indicator in q.split() or f" {indicator} " in f" {q} ":
            return True

    follow_up_patterns = [
        "explain more", "tell me more", "elaborate", "go deeper",
        "what about", "how about", "and also", "can you also",
        "why is that", "why not", "what else", "anything else",
        "compared to", "in contrast", "similarly",
        "the first", "the second", "the last",
    ]
    for pattern in follow_up_patterns:
        if pattern in q:
            return True

    if word_count <= 4 and any(
        w in q.split() for w in {"more", "why", "how", "explain", "detail", "example"}
    ):
        return True

    return False
