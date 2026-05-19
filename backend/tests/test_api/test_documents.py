import uuid
from io import BytesIO
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient

from apps.documents.models import Collection, Document, DocumentChunk


@pytest.mark.django_db
class TestCollectionViewSet:
    def test_create_collection(self, api_client: APIClient):
        response = api_client.post(
            "/api/v1/documents/collections/",
            {"name": "Engineering Docs", "description": "Engineering documentation"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Engineering Docs"
        assert "id" in response.data

    def test_list_collections(self, api_client: APIClient, collection: Collection):
        response = api_client.get("/api/v1/documents/collections/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1

    def test_retrieve_collection(self, api_client: APIClient, collection: Collection):
        response = api_client.get(f"/api/v1/documents/collections/{collection.id}/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == collection.name

    def test_update_collection(self, api_client: APIClient, collection: Collection):
        response = api_client.patch(
            f"/api/v1/documents/collections/{collection.id}/",
            {"name": "Updated Name"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Updated Name"

    def test_delete_collection(self, api_client: APIClient, collection: Collection):
        response = api_client.delete(f"/api/v1/documents/collections/{collection.id}/")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Collection.objects.filter(id=collection.id).exists()

    def test_collection_includes_document_count(self, api_client: APIClient, document: Document):
        response = api_client.get(
            f"/api/v1/documents/collections/{document.collection_id}/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["document_count"] == 1


@pytest.mark.django_db
class TestDocumentViewSet:
    @patch("apps.documents.views.process_document_task.delay")
    def test_upload_document(self, mock_task, api_client: APIClient, collection: Collection):
        pdf_content = b"%PDF-1.4 fake pdf content"
        uploaded_file = SimpleUploadedFile(
            "document.pdf", pdf_content, content_type="application/pdf"
        )
        response = api_client.post(
            "/api/v1/documents/files/",
            {
                "collection": str(collection.id),
                "title": "Attention Is All You Need",
                "file": uploaded_file,
            },
            format="multipart",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["title"] == "Attention Is All You Need"
        assert response.data["status"] == "pending"
        mock_task.assert_called_once()

    def test_list_documents_filtered_by_collection(
        self, api_client: APIClient, document: Document, collection: Collection
    ):
        response = api_client.get(
            f"/api/v1/documents/files/?collection={collection.id}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["title"] == document.title

    def test_cannot_delete_processing_document(
        self, api_client: APIClient, document: Document
    ):
        document.status = Document.Status.PROCESSING
        document.save()
        response = api_client.delete(f"/api/v1/documents/files/{document.id}/")
        assert response.status_code == status.HTTP_409_CONFLICT

    def test_delete_ready_document(self, api_client: APIClient, document: Document):
        response = api_client.delete(f"/api/v1/documents/files/{document.id}/")
        assert response.status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.django_db
class TestDocumentChunkViewSet:
    def test_list_chunks_for_document(
        self, api_client: APIClient, document_chunks: list[DocumentChunk]
    ):
        doc = document_chunks[0].document
        response = api_client.get(f"/api/v1/documents/chunks/?document={doc.id}")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == len(document_chunks)

    def test_filter_chunks_by_section_type(
        self, api_client: APIClient, document_chunks: list[DocumentChunk]
    ):
        doc = document_chunks[0].document
        response = api_client.get(
            f"/api/v1/documents/chunks/?document={doc.id}&section_type=abstract"
        )
        assert response.status_code == status.HTTP_200_OK
        for chunk in response.data["results"]:
            assert chunk["section_type"] == "abstract"

    def test_chunks_are_read_only(
        self, api_client: APIClient, document_chunks: list[DocumentChunk]
    ):
        chunk = document_chunks[0]
        response = api_client.delete(f"/api/v1/documents/chunks/{chunk.id}/")
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
