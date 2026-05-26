import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=60,
    acks_late=True,
)
def process_document_task(self, document_id: str, pdf_b64: str | None = None) -> dict:
    import base64

    from apps.documents.services.ingestion import IngestionError, IngestionService

    logger.info("Starting document processing", extra={"document_id": document_id})

    pdf_bytes = base64.b64decode(pdf_b64) if pdf_b64 else None

    service = IngestionService()
    try:
        service.process_document(document_id, pdf_bytes=pdf_bytes)
        return {"status": "success", "document_id": document_id}
    except IngestionError as exc:
        logger.error(
            "Ingestion failed",
            extra={"document_id": document_id, "error": str(exc)},
        )
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc)
        return {"status": "failed", "document_id": document_id, "error": str(exc)}
