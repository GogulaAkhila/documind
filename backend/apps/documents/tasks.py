import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=60,
    acks_late=True,
)
def process_document_task(self, document_id: str) -> dict:
    from apps.documents.services.ingestion import IngestionError, IngestionService

    logger.info("Starting document processing", extra={"document_id": document_id})

    service = IngestionService()
    try:
        service.process_document(document_id)
        return {"status": "success", "document_id": document_id}
    except IngestionError as exc:
        logger.error(
            "Ingestion failed",
            extra={"document_id": document_id, "error": str(exc)},
        )
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc)
        return {"status": "failed", "document_id": document_id, "error": str(exc)}
