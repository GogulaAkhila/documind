import re
from typing import Any

from core.rag.retrieval import RetrievedChunk

CITATION_PATTERN = re.compile(r"\[([^,\]]+),\s*Page\s*(\d+)\]")


def extract_citations(
    answer: str,
    contexts: list[RetrievedChunk],
) -> list[dict[str, Any]]:
    """
    Extracts inline citations from an answer and maps them to source chunks.
    Citations are expected in the format [Document Title, Page X].
    """
    if not answer:
        return []

    matches = CITATION_PATTERN.findall(answer)
    if not matches:
        return _generate_citations_from_contexts(contexts)

    seen: set[tuple[str, int]] = set()
    citations: list[dict[str, Any]] = []

    for title, page_str in matches:
        title = title.strip()
        page = int(page_str)
        key = (title.lower(), page)

        if key in seen:
            continue
        seen.add(key)

        matching_chunk = _find_matching_chunk(title, page, contexts)
        citation: dict[str, Any] = {
            "title": title,
            "page": page,
        }
        if matching_chunk:
            citation["section"] = matching_chunk.section_type
            citation["chunk_id"] = matching_chunk.chunk_id
            citation["relevance_score"] = matching_chunk.score

        citations.append(citation)

    return citations


def _find_matching_chunk(
    title: str,
    page: int,
    contexts: list[RetrievedChunk],
) -> RetrievedChunk | None:
    title_lower = title.lower()
    for ctx in contexts:
        ctx_title = (ctx.document_title or "").lower()
        if title_lower in ctx_title or ctx_title in title_lower:
            if ctx.page_number == page:
                return ctx

    for ctx in contexts:
        ctx_title = (ctx.document_title or "").lower()
        if title_lower in ctx_title or ctx_title in title_lower:
            return ctx

    return None


def _generate_citations_from_contexts(
    contexts: list[RetrievedChunk],
) -> list[dict[str, Any]]:
    """Fallback: generate citations from the retrieved contexts when none found in text."""
    seen: set[tuple[str, int]] = set()
    citations: list[dict[str, Any]] = []

    for ctx in contexts:
        key = (ctx.document_title.lower(), ctx.page_number)
        if key in seen:
            continue
        seen.add(key)
        citations.append({
            "title": ctx.document_title,
            "page": ctx.page_number,
            "section": ctx.section_type,
            "chunk_id": ctx.chunk_id,
            "relevance_score": ctx.score,
        })

    return citations


def format_citation(title: str, page: int) -> str:
    return f"[{title}, Page {page}]"
