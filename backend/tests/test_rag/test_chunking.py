import pytest

from core.rag.chunking import MAX_CHUNK_SIZE, MIN_CHUNK_SIZE, Chunk, SemanticChunker


class TestSemanticChunker:
    def setup_method(self):
        self.chunker = SemanticChunker()

    def test_chunks_document_with_clear_sections(self, sample_pages):
        chunks = self.chunker.chunk_document(sample_pages, "Test Paper")

        assert len(chunks) > 0
        assert all(isinstance(c, Chunk) for c in chunks)

        section_types = {c.section_type for c in chunks}
        assert "abstract" in section_types
        assert "methods" in section_types

    def test_assigns_correct_section_types(self, sample_pages):
        chunks = self.chunker.chunk_document(sample_pages, "Test Paper")

        abstract_chunks = [c for c in chunks if c.section_type == "abstract"]
        assert len(abstract_chunks) >= 1
        assert "Transformer" in abstract_chunks[0].content

    def test_preserves_page_numbers(self, sample_pages):
        chunks = self.chunker.chunk_document(sample_pages, "Test Paper")

        for chunk in chunks:
            assert chunk.page_number >= 1
            assert chunk.page_number <= max(sample_pages.keys())

    def test_includes_metadata_with_document_title(self, sample_pages):
        chunks = self.chunker.chunk_document(sample_pages, "My Paper")

        for chunk in chunks:
            assert chunk.metadata.get("document_title") == "My Paper"

    def test_fallback_for_unstructured_text(self):
        pages = {
            1: "Some random text without any section headers. " * 50,
            2: "More text that does not follow academic structure. " * 50,
        }
        chunks = self.chunker.chunk_document(pages, "Random Doc")

        assert len(chunks) > 0
        assert all(c.section_type == "other" for c in chunks)

    def test_respects_max_chunk_size(self):
        pages = {
            1: "Abstract\n" + ("A" * 3000),
        }
        chunks = self.chunker.chunk_document(pages, "Long Abstract")

        for chunk in chunks:
            assert len(chunk.content) <= MAX_CHUNK_SIZE + 200  # Allow overlap buffer

    def test_filters_out_tiny_chunks(self):
        pages = {1: "Abstract\nHi"}
        chunks = self.chunker.chunk_document(pages, "Tiny")

        for chunk in chunks:
            assert len(chunk.content.strip()) >= MIN_CHUNK_SIZE or len(chunks) == 0

    def test_empty_pages_returns_empty(self):
        pages = {1: "", 2: "   "}
        chunks = self.chunker.chunk_document(pages, "Empty")
        assert chunks == []

    def test_handles_all_section_types(self):
        pages = {
            1: "Abstract\nContent of abstract section.",
            2: "Introduction\nContent of introduction section with enough text to be valid.",
            3: "Materials and Methods\nContent of methods section with sufficient length.",
            4: "Results\nContent of results section with data and findings here.",
            5: "Discussion\nContent of discussion section analyzing the results.",
            6: "Conclusion\nContent of conclusion section summarizing findings.",
            7: "References\nContent of references section listing cited works.",
        }
        chunks = self.chunker.chunk_document(pages, "Full Paper")

        section_types = {c.section_type for c in chunks}
        expected = {"abstract", "introduction", "methods", "results", "discussion", "conclusion", "references"}
        assert expected.issubset(section_types)

    def test_numbered_section_headers(self):
        pages = {
            1: "1. Abstract\nContent here in the abstract section for testing purposes.",
            2: "2. Introduction\nMore content in the introduction section for validation.",
        }
        chunks = self.chunker.chunk_document(pages, "Numbered")

        section_types = {c.section_type for c in chunks}
        assert "abstract" in section_types
        assert "introduction" in section_types
