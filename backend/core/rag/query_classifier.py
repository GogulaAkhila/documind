"""Lightweight query classifier for adaptive retrieval strategies."""
import logging
import re
from enum import Enum

from django.conf import settings

logger = logging.getLogger(__name__)


class QueryType(str, Enum):
    FACTUAL = "factual"
    SHORT_VAGUE = "short_vague"
    COMPARISON = "comparison"
    MULTI_HOP = "multi_hop"
    GENERAL = "general"
    GREETING = "greeting"


_GREETING_PATTERNS = {
    "hi", "hello", "hey", "howdy", "hola", "greetings",
    "good morning", "good afternoon", "good evening", "good day",
    "yo", "sup", "whats up", "what's up",
    "hi there", "hello there", "hey there",
    "thanks", "thank you", "thx", "ty",
    "bye", "goodbye", "see you", "good bye",
    "ok", "okay", "cool", "nice", "great", "awesome",
}

_GREETING_EXACT = {
    "hi", "hello", "hey", "howdy", "hola", "yo", "sup",
    "thanks", "thank you", "thx", "ty", "ok", "okay",
    "cool", "nice", "great", "awesome", "bye", "goodbye",
}

GREETING_RESPONSE = (
    "Hello! I'm DocuMind, your document intelligence assistant. "
    "I can answer questions based on the documents in this collection. "
    "Try asking me about specific topics, findings, or details from your uploaded documents!"
)

THANKS_RESPONSE = (
    "You're welcome! Feel free to ask more questions about your documents anytime."
)

GOODBYE_RESPONSE = (
    "Goodbye! Come back anytime you need help with your documents."
)


def _get_greeting_response(query_lower: str) -> str:
    """Return the appropriate canned response for a greeting-type query."""
    thanks_words = {"thanks", "thank you", "thx", "ty"}
    bye_words = {"bye", "goodbye", "see you", "good bye"}

    if any(w in query_lower for w in thanks_words):
        return THANKS_RESPONSE
    if any(w in query_lower for w in bye_words):
        return GOODBYE_RESPONSE
    return GREETING_RESPONSE


_COMPARISON_PATTERNS = [
    re.compile(p)
    for p in [
        r"\bcompare\b",
        r"\bversus\b",
        r"\bvs\.?\b",
        r"\bdifference\s+between\b",
        r"\bsimilarit(?:y|ies)\s+between\b",
        r"\bpros\s+and\s+cons\b",
        r"\badvantages?\s+(?:and|or)\s+disadvantages?\b",
    ]
]

_MULTI_HOP_PATTERNS = [
    re.compile(p)
    for p in [
        r"\bhow\s+did\s+.+\s+affect\b",
        r"\bwhat\s+(?:was|were)\s+the\s+(?:impact|effect|result)\b",
        r"\brelationship\s+between\b",
        r"\bcause\s+and\s+effect\b",
        r"\bbefore\s+and\s+after\b",
        r"\bled\s+to\b",
    ]
]

_FACTUAL_STARTS = (
    "what is",
    "what are",
    "who is",
    "who are",
    "when was",
    "when did",
    "where is",
    "where are",
    "how many",
    "how much",
    "define",
    "list the",
    "name the",
    "what does",
)


def classify_query(query: str) -> QueryType:
    """Rule-based query classifier — no LLM call, sub-millisecond."""
    words = query.strip().split()
    word_count = len(words)
    query_lower = query.lower().strip()

    # Detect greetings/chitchat before anything else
    stripped = re.sub(r"[!?.,:;]+$", "", query_lower).strip()
    if stripped in _GREETING_EXACT or stripped in _GREETING_PATTERNS:
        return QueryType.GREETING
    if word_count <= 3 and any(stripped.startswith(g) for g in _GREETING_PATTERNS):
        return QueryType.GREETING

    if word_count < settings.RAG_HYDE_MIN_QUERY_WORDS:
        return QueryType.SHORT_VAGUE

    if any(p.search(query_lower) for p in _COMPARISON_PATTERNS):
        return QueryType.COMPARISON

    if any(p.search(query_lower) for p in _MULTI_HOP_PATTERNS):
        return QueryType.MULTI_HOP

    if any(query_lower.startswith(s) for s in _FACTUAL_STARTS):
        return QueryType.FACTUAL

    return QueryType.GENERAL
