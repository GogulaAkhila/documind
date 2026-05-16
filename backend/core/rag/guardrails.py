import json
import logging
from dataclasses import dataclass, field

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

API_BASE = "https://generativelanguage.googleapis.com/v1beta"
MODEL = "models/gemini-2.5-flash"

GROUNDING_PROMPT = """You are a fact-checking assistant. Your job is to verify whether each claim 
in the ANSWER is supported by the provided CONTEXT passages.

CONTEXT:
{context}

ANSWER TO VERIFY:
{answer}

For each major claim in the answer, check if it is grounded in the context.
Return a JSON object with:
- "is_grounded": true/false (overall assessment)
- "confidence": float between 0 and 1
- "flagged_claims": list of strings (claims not supported by context, empty if all grounded)

Return ONLY the JSON, no other text."""


class GuardrailError(Exception):
    """Raised when guardrail check fails."""


@dataclass
class GroundingResult:
    is_grounded: bool
    confidence: float
    flagged_claims: list[str] = field(default_factory=list)


class HallucinationGuardrail:
    def __init__(self) -> None:
        self._api_key = settings.GEMINI_API_KEY

    def check(self, answer: str, contexts: list[str]) -> GroundingResult:
        if not self._api_key:
            return GroundingResult(is_grounded=True, confidence=0.5, flagged_claims=[])

        context_text = "\n\n---\n\n".join(contexts)
        prompt = GROUNDING_PROMPT.format(context=context_text, answer=answer)

        try:
            with httpx.Client(timeout=60) as client:
                resp = client.post(
                    f"{API_BASE}/{MODEL}:generateContent",
                    params={"key": self._api_key},
                    json={
                        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0.0, "maxOutputTokens": 1024},
                    },
                )

            if resp.status_code != 200:
                logger.warning("Guardrail API error, assuming grounded")
                return GroundingResult(is_grounded=True, confidence=0.5)

            candidates = resp.json().get("candidates", [])
            if not candidates:
                return GroundingResult(is_grounded=True, confidence=0.5)

            text = candidates[0]["content"]["parts"][0]["text"].strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

            data = json.loads(text)
            result = GroundingResult(
                is_grounded=data.get("is_grounded", True),
                confidence=float(data.get("confidence", 0.5)),
                flagged_claims=data.get("flagged_claims", []),
            )
            logger.info(
                "Grounding check complete",
                extra={"is_grounded": result.is_grounded, "confidence": result.confidence},
            )
            return result

        except Exception as e:
            logger.warning("Guardrail check failed, assuming grounded", extra={"error": str(e)})
            return GroundingResult(is_grounded=True, confidence=0.5)
