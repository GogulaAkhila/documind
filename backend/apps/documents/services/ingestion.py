import logging

from django.utils import timezone as dj_timezone

from apps.documents.models import Document, DocumentChunk
from core.rag.chunking import Chunk, extract_and_chunk
from core.rag.embeddings import EmbeddingService
from core.vectorstore.pgvector_store import PgVectorStore

logger = logging.getLogger(__name__)


class IngestionError(Exception):
    """Raised when document ingestion fails."""


class IngestionService:
    def __init__(self) -> None:
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
            pdf_bytes = self._read_file(document.file)

            doc, chunks = extract_and_chunk(
                pdf_bytes=pdf_bytes,
                document_title=document.title,
                filename=document.file.name or "document.pdf",
            )
            document.page_count = doc.num_pages()

            logger.info(
                "Chunked document",
                extra={
                    "document_id": document_id,
                    "chunk_count": len(chunks),
                    "page_count": document.page_count,
                },
            )

            texts_for_embedding = [chunk.content_for_embedding for chunk in chunks]
            embeddings = self.embedding_service.embed_documents(texts_for_embedding)

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

    def _read_file(self, file_field) -> bytes:
        with file_field.open("rb") as f:
            return f.read()

    def _save_chunks(
        self,
        document: Document,
        chunks: list[Chunk],
        embedding_ids: list[str],
    ) -> None:
        DocumentChunk.objects.filter(document=document).delete()

        chunk_objects = [
            DocumentChunk(
                document=document,
                content=chunk.content,
                chunk_index=idx,
                section_type=chunk.section_type,
                content_type=chunk.metadata.get("content_type", "prose"),
                page_number=chunk.page_number,
                metadata=chunk.metadata,
                embedding_id=embedding_ids[idx] if idx < len(embedding_ids) else "",
            )
            for idx, chunk in enumerate(chunks)
        ]
        DocumentChunk.objects.bulk_create(chunk_objects, batch_size=100)
