import logging
import re
import unicodedata
from dataclasses import dataclass, field
from io import BytesIO
from typing import Any

from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
from docling.chunking import HybridChunker
from docling.datamodel.base_models import DocumentStream, InputFormat
from docling.datamodel.accelerator_options import AcceleratorDevice, AcceleratorOptions
from docling.datamodel.pipeline_options import (
    PdfPipelineOptions,
    TableFormerMode,
    TableStructureOptions,
)
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.types.doc import DoclingDocument, TableItem

logger = logging.getLogger(__name__)

MAX_TOKENS = 512
MIN_CHUNK_CHARS = 50
TOKENIZER_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

SECTION_TYPE_MAP: dict[str, str] = {
    "abstract": "abstract",
    "introduction": "introduction",
    "method": "methods",
    "methods": "methods",
    "materials and methods": "methods",
    "result": "results",
    "results": "results",
    "discussion": "discussion",
    "conclusion": "conclusion",
    "conclusions": "conclusion",
    "reference": "references",
    "references": "references",
    "bibliography": "references",
    "summary": "summary",
    "executive summary": "summary",
    "purpose": "purpose",
    "objective": "purpose",
    "objectives": "purpose",
    "scope": "scope",
    "prerequisite": "requirements",
    "prerequisites": "requirements",
    "requirement": "requirements",
    "requirements": "requirements",
    "installation": "procedure",
    "setup": "procedure",
    "configuration": "procedure",
    "procedure": "procedure",
    "procedures": "procedure",
    "process": "procedure",
    "steps": "procedure",
    "instructions": "procedure",
    "how to": "procedure",
    "troubleshooting": "troubleshooting",
    "known issues": "troubleshooting",
    "faq": "faq",
    "frequently asked questions": "faq",
    "glossary": "glossary",
    "definitions": "glossary",
    "terminology": "glossary",
    "appendix": "appendix",
    "annex": "appendix",
    "overview": "overview",
    "architecture": "overview",
    "design": "overview",
    "system design": "overview",
    "security": "policy",
    "compliance": "policy",
    "policy": "policy",
    "revision history": "references",
    "changelog": "references",
}


@dataclass
class Chunk:
    """Represents a processed document chunk ready for embedding and storage."""

    content: str
    content_for_embedding: str
    section_type: str
    page_number: int
    metadata: dict = field(default_factory=dict)


def _build_converter() -> DocumentConverter:
    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_table_structure = True
    pipeline_options.table_structure_options = TableStructureOptions(
        do_cell_matching=True,
        mode=TableFormerMode.FAST,
    )
    pipeline_options.do_ocr = False
    pipeline_options.accelerator_options = AcceleratorOptions(
        num_threads=4,
        device=AcceleratorDevice.CPU,
    )

    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(
                backend=PyPdfiumDocumentBackend,
                pipeline_options=pipeline_options,
            )
        }
    )


def _build_chunker() -> HybridChunker:
    from docling_core.transforms.chunker.tokenizer.huggingface import (
        HuggingFaceTokenizer,
    )
    from transformers import AutoTokenizer

    tokenizer = HuggingFaceTokenizer(
        tokenizer=AutoTokenizer.from_pretrained(TOKENIZER_MODEL),
        max_tokens=MAX_TOKENS,
    )
    return HybridChunker(
        tokenizer=tokenizer,
        max_tokens=MAX_TOKENS,
        merge_peers=True,
        repeat_table_header=True,
    )


_converter: DocumentConverter | None = None
_chunker: HybridChunker | None = None


def get_converter() -> DocumentConverter:
    global _converter
    if _converter is None:
        _converter = _build_converter()
    return _converter


def get_chunker() -> HybridChunker:
    global _chunker
    if _chunker is None:
        _chunker = _build_chunker()
    return _chunker


def _normalize_unicode(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("\u2018", "'").replace("\u2019", "'")
    text = text.replace("\u201c", '"').replace("\u201d", '"')
    text = text.replace("\u2013", "-").replace("\u2014", "-")
    return text


def _classify_section(headings: list[str]) -> str:
    for heading in reversed(headings):
        normalized = re.sub(r"^\d+[\.\)]\s*", "", heading).strip().lower()
        if normalized in SECTION_TYPE_MAP:
            return SECTION_TYPE_MAP[normalized]
        for key, section_type in SECTION_TYPE_MAP.items():
            if key in normalized:
                return section_type
    return "other"


def _get_content_type(doc_items: list[Any]) -> str:
    for item in doc_items:
        if isinstance(item, TableItem):
            return "table"
    return "prose"


def _get_page_number(chunk_meta: Any) -> int:
    """Extract page number from chunk metadata's doc_items provenance."""
    if not hasattr(chunk_meta, "doc_items") or not chunk_meta.doc_items:
        return 1
    for item_ref in chunk_meta.doc_items:
        item = item_ref if not callable(getattr(item_ref, "resolve", None)) else item_ref
        if hasattr(item, "prov") and item.prov:
            for prov in item.prov:
                if hasattr(prov, "page_no") and prov.page_no:
                    return prov.page_no
    return 1


def extract_and_chunk(
    pdf_bytes: bytes,
    document_title: str = "",
    filename: str = "document.pdf",
) -> tuple[DoclingDocument, list[Chunk]]:
    converter = get_converter()
    chunker = get_chunker()

    stream = DocumentStream(name=filename, stream=BytesIO(pdf_bytes))
    result = converter.convert(stream)
    doc = result.document

    raw_chunks = list(chunker.chunk(doc))
    chunks: list[Chunk] = []

    for idx, raw_chunk in enumerate(raw_chunks):
        text = raw_chunk.text.strip()
        if len(text) < MIN_CHUNK_CHARS:
            continue

        text = _normalize_unicode(text)

        headings = raw_chunk.meta.headings if raw_chunk.meta.headings else []
        section_type = _classify_section(headings)

        contextualized = chunker.contextualize(raw_chunk)
        contextualized = _normalize_unicode(contextualized)

        content_type = _get_content_type(
            raw_chunk.meta.doc_items if raw_chunk.meta.doc_items else []
        )
        page_number = _get_page_number(raw_chunk.meta)
        section_path = " > ".join(headings) if headings else ""

        chunks.append(
            Chunk(
                content=text,
                content_for_embedding=contextualized,
                section_type=section_type,
                page_number=page_number,
                metadata={
                    "document_title": document_title,
                    "section_path": section_path,
                    "content_type": content_type,
                    "heading_level": len(headings),
                    "chunk_index": idx,
                },
            )
        )

    logger.info(
        "Document processed with Docling",
        extra={
            "title": document_title,
            "total_raw_chunks": len(raw_chunks),
            "filtered_chunks": len(chunks),
            "page_count": doc.num_pages(),
        },
    )
    return doc, chunks
