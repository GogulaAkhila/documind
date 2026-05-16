import logging
from datetime import timezone
from typing import BinaryIO

import fitz
from django.utils import timezone as dj_timezone

from apps.documents.models import Document, DocumentChunk
from core.rag.chunking import SemanticChunker
from core.rag.embeddings import EmbeddingService
from core.vectorstore.pgvector_store import PgVectorStore

logger = logging.getLogger(__name__)


class IngestionError(Exception):
    """Raised when document ingestion fails."""


class IngestionService:
    def __init__(self) -> None:
        self.chunker = SemanticChunker()
        self.embedding_service = EmbeddingService()
        self.vector_store = PgVectorStore()

    def process_document(self, document_id: str) -> None:
        try:
            document = Document.objects.get(id=document_id)
        except Document.DoesNotExist as e:
            raise IngestionError(f"Document {document_id} not found") from e

        document.status = Document.Status.PROCESSING
        document.save(update_fields=["status"])

        try:
            text_by_page = self._extract_text(document.file)
            document.page_count = len(text_by_page)

            chunks = self.chunker.chunk_document(text_by_page, document.title)
            logger.info(
                "Chunked document",
                extra={
                    "document_id": document_id,
                    "chunk_count": len(chunks),
                },
            )

            texts = [chunk.content for chunk in chunks]
            embeddings = self.embedding_service.embed_documents(texts)

            embedding_ids = self.vector_store.store_embeddings(
                chunks=chunks,
                embeddings=embeddings,
                collection_id=str(document.collection_id),
                document_id=document_id,
            )

            self._save_chunks(document, chunks, embedding_ids)

            document.status = Document.Status.READY
            document.processed_at = dj_timezone.now()
            document.save(update_fields=["status", "page_count", "processed_at"])

            logger.info(
                "Document processing complete",
                extra={"document_id": document_id},
            )

        except Exception as e:
            logger.exception(
                "Document processing failed",
                extra={"document_id": document_id},
            )
            document.status = Document.Status.FAILED
            document.error_message = str(e)[:1000]
            document.save(update_fields=["status", "error_message"])
            raise IngestionError(f"Processing failed: {e}") from e

    def _extract_text(self, file_field) -> dict[int, str]:
        pages: dict[int, str] = {}
        with file_field.open("rb") as f:
            pdf_bytes = f.read()

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        try:
            for page_num in range(len(doc)):
                page = doc[page_num]
                text = page.get_text("text")
                if text.strip():
                    pages[page_num + 1] = text
        finally:
            doc.close()

        if not pages:
            raise IngestionError("No text content extracted from PDF")

        return pages

    def _save_chunks(
        self,
        document: Document,
        chunks: list,
        embedding_ids: list[str],
    ) -> None:
        DocumentChunk.objects.filter(document=document).delete()

        chunk_objects = [
            DocumentChunk(
                document=document,
                content=chunk.content,
                chunk_index=idx,
                section_type=chunk.section_type,
                page_number=chunk.page_number,
                metadata=chunk.metadata,
                embedding_id=embedding_ids[idx] if idx < len(embedding_ids) else "",
            )
            for idx, chunk in enumerate(chunks)
        ]
        DocumentChunk.objects.bulk_create(chunk_objects, batch_size=100)
