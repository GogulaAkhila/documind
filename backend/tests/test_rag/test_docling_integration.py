"""Integration tests that run actual PDFs through the Docling pipeline.

These tests are slower (~5-10s each) because they invoke the layout model.
Mark with pytest.mark.slow if you want to skip them in fast CI runs.
"""

from pathlib import Path

import pytest

from core.rag.chunking import Chunk, extract_and_chunk

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def sample_pdf_bytes() -> bytes:
    pdf_path = FIXTURES_DIR / "sample_paper.pdf"
    if not pdf_path.exists():
        pytest.skip("sample_paper.pdf fixture not found")
    return pdf_path.read_bytes()


@pytest.fixture(scope="module")
def processed_result(sample_pdf_bytes):
    doc, chunks = extract_and_chunk(
        pdf_bytes=sample_pdf_bytes,
        document_title="Test Paper",
        filename="sample_paper.pdf",
    )
    return doc, chunks


class TestDoclingExtraction:
    def test_extracts_correct_page_count(self, processed_result):
        doc, _ = processed_result
        assert doc.num_pages() == 2

    def test_produces_chunks(self, processed_result):
        _, chunks = processed_result
        assert len(chunks) > 0
        assert all(isinstance(c, Chunk) for c in chunks)


class TestChunkContent:
    def test_content_is_clean_text(self, processed_result):
        _, chunks = processed_result
        for chunk in chunks:
            assert len(chunk.content.strip()) > 0

    def test_content_for_embedding_includes_heading(self, processed_result):
        _, chunks = processed_result
        headed_chunks = [c for c in chunks if c.section_type != "other"]
        assert len(headed_chunks) > 0
        for chunk in headed_chunks:
            assert chunk.content_for_embedding != chunk.content
            assert len(chunk.content_for_embedding) >= len(chunk.content)


class TestSectionDetection:
    def test_detects_known_sections(self, processed_result):
        _, chunks = processed_result
        section_types = {c.section_type for c in chunks}
        assert len(section_types - {"other"}) >= 2

    def test_all_section_types_are_valid(self, processed_result):
        _, chunks = processed_result
        valid_types = {
            "abstract", "introduction", "methods", "results", "discussion",
            "conclusion", "references", "summary", "purpose", "scope",
            "requirements", "procedure", "troubleshooting", "faq", "glossary",
            "appendix", "overview", "policy", "other",
        }
        for chunk in chunks:
            assert chunk.section_type in valid_types


class TestMetadata:
    def test_has_document_title(self, processed_result):
        _, chunks = processed_result
        for chunk in chunks:
            assert chunk.metadata.get("document_title") == "Test Paper"

    def test_has_content_type(self, processed_result):
        _, chunks = processed_result
        for chunk in chunks:
            assert chunk.metadata.get("content_type") in ("prose", "table", "list", "code")

    def test_has_section_path(self, processed_result):
        _, chunks = processed_result
        for chunk in chunks:
            assert "section_path" in chunk.metadata

    def test_page_numbers_are_valid(self, processed_result):
        doc, chunks = processed_result
        for chunk in chunks:
            assert 1 <= chunk.page_number <= doc.num_pages()

    def test_has_heading_level(self, processed_result):
        _, chunks = processed_result
        for chunk in chunks:
            assert "heading_level" in chunk.metadata
            assert isinstance(chunk.metadata["heading_level"], int)
