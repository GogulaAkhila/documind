import uuid

import pytest
from rest_framework.test import APIClient

from apps.documents.models import Collection, Document, DocumentChunk


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def collection(db) -> Collection:
    return Collection.objects.create(
        name="Test Collection",
        description="A test collection for unit tests",
    )


@pytest.fixture
def document(db, collection) -> Document:
    return Document.objects.create(
        collection=collection,
        title="Test Paper: Attention Is All You Need",
        file="documents/2024/01/test.pdf",
        file_type="pdf",
        page_count=15,
        status=Document.Status.READY,
    )


@pytest.fixture
def document_chunks(db, document) -> list[DocumentChunk]:
    chunks = []
    sections = [
        ("abstract", "This paper proposes a new architecture called Transformer..."),
        ("introduction", "The dominant sequence transduction models are based on complex..."),
        ("methods", "The Transformer follows an encoder-decoder structure using stacked self-attention..."),
        ("results", "On the WMT 2014 English-to-German translation task, the big transformer model..."),
        ("conclusion", "In this work, we presented the Transformer, the first sequence transduction model..."),
    ]
    for idx, (section_type, content) in enumerate(sections):
        chunk = DocumentChunk.objects.create(
            document=document,
            content=content,
            chunk_index=idx,
            section_type=section_type,
            page_number=idx + 1,
            metadata={"document_title": document.title},
            embedding_id=str(uuid.uuid4()),
        )
        chunks.append(chunk)
    return chunks


@pytest.fixture
def mock_embedding():
    return [0.1] * 768


@pytest.fixture
def sample_pages() -> dict[int, str]:
    return {
        1: "Abstract\nThis paper proposes a new architecture called Transformer that relies entirely on attention mechanisms.",
        2: "Introduction\nThe dominant sequence transduction models are based on complex recurrent or convolutional neural networks.",
        3: "Methods\nThe Transformer follows an encoder-decoder structure using stacked self-attention and point-wise fully connected layers.",
        4: "Results\nOn the WMT 2014 English-to-German translation task, the big transformer model outperforms all previously reported ensembles.",
        5: "Conclusion\nIn this work, we presented the Transformer, the first sequence transduction model based entirely on attention.",
    }


@pytest.fixture
def enterprise_document_text():
    return [
        ("purpose", "This document describes the standard operating procedure for onboarding new employees at Acme Corp."),
        ("scope", "This SOP applies to all departments and covers the complete onboarding workflow from offer acceptance to first day."),
        ("procedure", "Step 1: HR sends welcome email within 24 hours of offer acceptance. Step 2: IT provisions laptop, email, and VPN access. Step 3: Manager schedules first-week orientation meetings."),
        ("requirements", "New hires must complete the following before their start date: background check, NDA signing, and tax form submission."),
        ("troubleshooting", "If VPN access is not working, verify that the employee's Active Directory account has been activated by IT."),
    ]
