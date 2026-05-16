from unittest.mock import MagicMock, patch

import pytest

from core.rag.retrieval import DEFAULT_TOP_K, HybridRetriever, RetrievedChunk


class TestHybridRetriever:
    def setup_method(self):
        with patch("core.rag.retrieval.EmbeddingService"), \
             patch("core.rag.retrieval.PgVectorStore"):
            self.retriever = HybridRetriever()

    def test_reciprocal_rank_fusion_combines_results(self):
        dense_results = [
            RetrievedChunk(
                chunk_id="a", content="Dense result A", section_type="methods",
                page_number=1, document_title="Paper 1", score=0.95,
            ),
            RetrievedChunk(
                chunk_id="b", content="Dense result B", section_type="results",
                page_number=2, document_title="Paper 1", score=0.90,
            ),
        ]
        sparse_results = [
            RetrievedChunk(
                chunk_id="b", content="Sparse result B", section_type="results",
                page_number=2, document_title="Paper 1", score=5.2,
            ),
            RetrievedChunk(
                chunk_id="c", content="Sparse result C", section_type="abstract",
                page_number=1, document_title="Paper 2", score=4.8,
            ),
        ]

        fused = self.retriever._reciprocal_rank_fusion(dense_results, sparse_results)

        assert len(fused) == 3
        chunk_ids = [c.chunk_id for c in fused]
        assert "b" == chunk_ids[0]  # "b" appears in both lists, highest RRF score

    def test_rrf_handles_empty_dense(self):
        sparse_results = [
            RetrievedChunk(
                chunk_id="a", content="Only sparse", section_type="other",
                page_number=1, document_title="Paper", score=3.0,
            ),
        ]
        fused = self.retriever._reciprocal_rank_fusion([], sparse_results)
        assert len(fused) == 1
        assert fused[0].chunk_id == "a"

    def test_rrf_handles_empty_sparse(self):
        dense_results = [
            RetrievedChunk(
                chunk_id="a", content="Only dense", section_type="other",
                page_number=1, document_title="Paper", score=0.9,
            ),
        ]
        fused = self.retriever._reciprocal_rank_fusion(dense_results, [])
        assert len(fused) == 1
        assert fused[0].chunk_id == "a"

    def test_rrf_handles_both_empty(self):
        fused = self.retriever._reciprocal_rank_fusion([], [])
        assert fused == []

    def test_rrf_deduplicates_by_chunk_id(self):
        dense_results = [
            RetrievedChunk(
                chunk_id="same", content="Content", section_type="other",
                page_number=1, document_title="Paper", score=0.8,
            ),
        ]
        sparse_results = [
            RetrievedChunk(
                chunk_id="same", content="Content", section_type="other",
                page_number=1, document_title="Paper", score=4.0,
            ),
        ]
        fused = self.retriever._reciprocal_rank_fusion(dense_results, sparse_results)
        assert len(fused) == 1

    @patch("core.rag.retrieval.EmbeddingService")
    @patch("core.rag.retrieval.PgVectorStore")
    def test_hybrid_search_calls_both_methods(self, mock_store_cls, mock_emb_cls):
        mock_emb = MagicMock()
        mock_emb.embed_query.return_value = [0.1] * 768
        mock_emb_cls.return_value = mock_emb

        mock_store = MagicMock()
        mock_store.similarity_search.return_value = [
            {"id": "1", "content": "text", "section_type": "other",
             "page_number": 1, "document_title": "P", "score": 0.9, "metadata": {}},
        ]
        mock_store.full_text_search.return_value = [
            {"id": "2", "content": "text2", "section_type": "methods",
             "page_number": 2, "document_title": "P", "score": 3.0, "metadata": {}},
        ]
        mock_store_cls.return_value = mock_store

        retriever = HybridRetriever()
        results = retriever.hybrid_search("test query", "collection-id", top_k=10)

        assert len(results) == 2
        mock_emb.embed_query.assert_called_once_with("test query")
        mock_store.similarity_search.assert_called_once()
        mock_store.full_text_search.assert_called_once()

    def test_rrf_scores_are_positive(self):
        dense_results = [
            RetrievedChunk(
                chunk_id=f"d{i}", content=f"Dense {i}", section_type="other",
                page_number=1, document_title="Paper", score=0.9 - i * 0.1,
            )
            for i in range(5)
        ]
        sparse_results = [
            RetrievedChunk(
                chunk_id=f"s{i}", content=f"Sparse {i}", section_type="other",
                page_number=1, document_title="Paper", score=5.0 - i,
            )
            for i in range(5)
        ]
        fused = self.retriever._reciprocal_rank_fusion(dense_results, sparse_results)

        for chunk in fused:
            assert chunk.score > 0
