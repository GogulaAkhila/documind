"""Retrieval quality scoring with three-state confidence gating."""
import logging
from dataclasses import dataclass
from enum import Enum

from django.conf import settings

from core.rag.retrieval import RetrievedChunk

logger = logging.getLogger(__name__)


class ConfidenceLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class RetrievalConfidence:
    level: ConfidenceLevel
    score: float
    top_score: float
    avg_score: float
    score_margin: float

    @property
    def should_abstain(self) -> bool:
        return self.level == ConfidenceLevel.LOW

    @property
    def needs_caveat(self) -> bool:
        return self.level == ConfidenceLevel.MEDIUM


def score_retrieval_confidence(chunks: list[RetrievedChunk]) -> RetrievalConfidence:
    high_threshold = settings.RAG_CONFIDENCE_HIGH_THRESHOLD
    low_threshold = settings.RAG_CONFIDENCE_LOW_THRESHOLD

    if not chunks:
        return RetrievalConfidence(
            level=ConfidenceLevel.LOW, score=0.0,
            top_score=0.0, avg_score=0.0, score_margin=0.0,
        )

    scores = [c.score for c in chunks]
    top_score = max(scores)
    avg_score = sum(scores) / len(scores)
    score_margin = scores[0] - scores[-1] if len(scores) > 1 else 0.0

    rq_score = 0.5 * top_score + 0.3 * avg_score + 0.2 * score_margin

    if top_score >= high_threshold and avg_score >= high_threshold * 0.6:
        level = ConfidenceLevel.HIGH
    elif top_score >= low_threshold:
        level = ConfidenceLevel.MEDIUM
    else:
        level = ConfidenceLevel.LOW

    confidence = RetrievalConfidence(
        level=level, score=rq_score,
        top_score=top_score, avg_score=avg_score, score_margin=score_margin,
    )

    logger.info(
        "Retrieval confidence scored",
        extra={"level": level.value, "rq_score": round(rq_score, 4),
               "top_score": round(top_score, 4), "avg_score": round(avg_score, 4)},
    )
    return confidence
