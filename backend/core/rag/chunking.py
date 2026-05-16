import logging
import re
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

SECTION_PATTERNS: list[tuple[str, str]] = [
    (r"(?i)^(?:\d+\.?\s*)?abstract\b", "abstract"),
    (r"(?i)^(?:\d+\.?\s*)?introduction\b", "introduction"),
    (r"(?i)^(?:\d+\.?\s*)?(?:materials?\s*(?:and|&)\s*)?methods?\b", "methods"),
    (r"(?i)^(?:\d+\.?\s*)?results?\b", "results"),
    (r"(?i)^(?:\d+\.?\s*)?discussion\b", "discussion"),
    (r"(?i)^(?:\d+\.?\s*)?conclusions?\b", "conclusion"),
    (r"(?i)^(?:\d+\.?\s*)?references?\b", "references"),
]

MAX_CHUNK_SIZE = 1500
CHUNK_OVERLAP = 200
MIN_CHUNK_SIZE = 100


@dataclass
class Chunk:
    content: str
    section_type: str
    page_number: int
    metadata: dict = field(default_factory=dict)


class SemanticChunker:
    """Splits academic papers by detected sections with fallback to recursive splitting."""

    def chunk_document(
        self,
        pages: dict[int, str],
        document_title: str = "",
    ) -> list[Chunk]:
        sections = self._detect_sections(pages)

        if not sections:
            return self._fallback_chunk(pages, document_title)

        chunks: list[Chunk] = []
        for section in sections:
            section_chunks = self._split_section(
                text=section["text"],
                section_type=section["type"],
                start_page=section["page"],
                document_title=document_title,
            )
            chunks.extend(section_chunks)

        if not chunks:
            return self._fallback_chunk(pages, document_title)

        logger.info(
            "Document chunked by sections",
            extra={"chunk_count": len(chunks), "title": document_title},
        )
        return chunks

    def _detect_sections(self, pages: dict[int, str]) -> list[dict]:
        sections: list[dict] = []
        current_section: dict | None = None

        for page_num in sorted(pages.keys()):
            lines = pages[page_num].split("\n")
            for line in lines:
                stripped = line.strip()
                if not stripped:
                    continue

                detected_type = self._match_section_header(stripped)
                if detected_type:
                    if current_section and current_section["text"].strip():
                        sections.append(current_section)
                    current_section = {
                        "type": detected_type,
                        "text": "",
                        "page": page_num,
                    }
                elif current_section is not None:
                    current_section["text"] += line + "\n"
                else:
                    current_section = {
                        "type": "other",
                        "text": line + "\n",
                        "page": page_num,
                    }

        if current_section and current_section["text"].strip():
            sections.append(current_section)

        return sections

    def _match_section_header(self, line: str) -> str | None:
        if len(line) > 100:
            return None
        for pattern, section_type in SECTION_PATTERNS:
            if re.match(pattern, line):
                return section_type
        return None

    def _split_section(
        self,
        text: str,
        section_type: str,
        start_page: int,
        document_title: str,
    ) -> list[Chunk]:
        if len(text) <= MAX_CHUNK_SIZE:
            if len(text.strip()) < MIN_CHUNK_SIZE:
                return []
            return [
                Chunk(
                    content=text.strip(),
                    section_type=section_type,
                    page_number=start_page,
                    metadata={"document_title": document_title},
                )
            ]

        return self._recursive_split(text, section_type, start_page, document_title)

    def _recursive_split(
        self,
        text: str,
        section_type: str,
        page_number: int,
        document_title: str,
    ) -> list[Chunk]:
        chunks: list[Chunk] = []
        separators = ["\n\n", "\n", ". ", " "]

        parts = self._split_by_separators(text, separators)

        current_chunk = ""
        for part in parts:
            if len(current_chunk) + len(part) <= MAX_CHUNK_SIZE:
                current_chunk += part
            else:
                if current_chunk.strip() and len(current_chunk.strip()) >= MIN_CHUNK_SIZE:
                    chunks.append(
                        Chunk(
                            content=current_chunk.strip(),
                            section_type=section_type,
                            page_number=page_number,
                            metadata={"document_title": document_title},
                        )
                    )
                overlap_text = current_chunk[-CHUNK_OVERLAP:] if len(current_chunk) > CHUNK_OVERLAP else ""
                current_chunk = overlap_text + part

        if current_chunk.strip() and len(current_chunk.strip()) >= MIN_CHUNK_SIZE:
            chunks.append(
                Chunk(
                    content=current_chunk.strip(),
                    section_type=section_type,
                    page_number=page_number,
                    metadata={"document_title": document_title},
                )
            )

        return chunks

    def _split_by_separators(self, text: str, separators: list[str]) -> list[str]:
        parts = [text]
        for sep in separators:
            new_parts = []
            for part in parts:
                if len(part) <= MAX_CHUNK_SIZE:
                    new_parts.append(part)
                else:
                    split_parts = part.split(sep)
                    for i, sp in enumerate(split_parts):
                        new_parts.append(sp + (sep if i < len(split_parts) - 1 else ""))
            parts = new_parts
        return parts

    def _fallback_chunk(self, pages: dict[int, str], document_title: str) -> list[Chunk]:
        full_text = "\n".join(pages[p] for p in sorted(pages.keys()))
        page_list = sorted(pages.keys())
        first_page = page_list[0] if page_list else 1
        return self._recursive_split(full_text, "other", first_page, document_title)
