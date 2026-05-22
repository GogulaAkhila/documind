import pytest

from core.rag.chunking import (
    Chunk,
    _classify_section,
    _normalize_unicode,
)


class TestChunkDataclass:
    def test_chunk_has_required_fields(self):
        chunk = Chunk(
            content="Test content",
            content_for_embedding="Section > Test content",
            section_type="methods",
            page_number=3,
            metadata={"document_title": "Paper"},
        )
        assert chunk.content == "Test content"
        assert chunk.content_for_embedding == "Section > Test content"
        assert chunk.section_type == "methods"
        assert chunk.page_number == 3
        assert chunk.metadata["document_title"] == "Paper"

    def test_chunk_defaults(self):
        chunk = Chunk(
            content="text",
            content_for_embedding="text",
            section_type="other",
            page_number=1,
        )
        assert chunk.metadata == {}


class TestSectionClassification:
    @pytest.mark.parametrize(
        "headings,expected",
        [
            (["Abstract"], "abstract"),
            (["1. Introduction"], "introduction"),
            (["Materials and Methods"], "methods"),
            (["3. Methods"], "methods"),
            (["Results"], "results"),
            (["Discussion"], "discussion"),
            (["Conclusion"], "conclusion"),
            (["Conclusions"], "conclusion"),
            (["References"], "references"),
            (["Bibliography"], "references"),
        ],
    )
    def test_academic_sections(self, headings, expected):
        assert _classify_section(headings) == expected

    @pytest.mark.parametrize(
        "headings,expected",
        [
            (["Purpose"], "purpose"),
            (["Scope"], "scope"),
            (["Prerequisites"], "requirements"),
            (["Procedure"], "procedure"),
            (["Troubleshooting"], "troubleshooting"),
            (["FAQ"], "faq"),
            (["Glossary"], "glossary"),
            (["Appendix"], "appendix"),
            (["Overview"], "overview"),
            (["Security"], "policy"),
        ],
    )
    def test_enterprise_sections(self, headings, expected):
        assert _classify_section(headings) == expected

    def test_numbered_heading_stripped(self):
        assert _classify_section(["3. Methods"]) == "methods"
        assert _classify_section(["1) Introduction"]) == "introduction"

    def test_nested_headings_falls_back_to_parent(self):
        assert _classify_section(["1. Introduction", "1.1 Background"]) == "introduction"
        assert _classify_section(["1. Introduction", "Methods"]) == "methods"

    def test_unknown_heading_returns_other(self):
        assert _classify_section(["Something Random"]) == "other"
        assert _classify_section([]) == "other"


class TestUnicodeNormalization:
    def test_smart_quotes(self):
        assert _normalize_unicode("\u201cHello\u201d") == '"Hello"'
        assert _normalize_unicode("\u2018Hi\u2019") == "'Hi'"

    def test_dashes(self):
        assert _normalize_unicode("a\u2013b") == "a-b"
        assert _normalize_unicode("a\u2014b") == "a-b"

    def test_nfkc_normalization(self):
        assert _normalize_unicode("\ufb01") == "fi"
