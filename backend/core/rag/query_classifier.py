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

    if word_count < settings.RAG_HYDE_MIN_QUERY_WORDS:
        return QueryType.SHORT_VAGUE

    if any(p.search(query_lower) for p in _COMPARISON_PATTERNS):
        return QueryType.COMPARISON

    if any(p.search(query_lower) for p in _MULTI_HOP_PATTERNS):
        return QueryType.MULTI_HOP

    if any(query_lower.startswith(s) for s in _FACTUAL_STARTS):
        return QueryType.FACTUAL

    return QueryType.GENERAL
