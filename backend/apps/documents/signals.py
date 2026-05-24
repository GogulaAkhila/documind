import logging

from django.db.models.signals import pre_delete
from django.dispatch import receiver

from core.rag.semantic_cache import SemanticCache
from core.vectorstore.pgvector_store import PgVectorStore, VectorStoreError

logger = logging.getLogger(__name__)


@receiver(pre_delete, sender="documents.Document")
def cleanup_document_vectors(sender, instance, **kwargs):
    try:
        store = PgVectorStore()
        deleted = store.delete_document(str(instance.id))
        logger.info(
            "Cleaned up document vectors",
            extra={"document_id": str(instance.id), "deleted_count": deleted},
        )
    except VectorStoreError:
        logger.exception(
            "Failed to clean up vectors for document",
            extra={"document_id": str(instance.id)},
        )

    if hasattr(instance, "collection_id") and instance.collection_id:
        try:
            SemanticCache().invalidate_collection(str(instance.collection_id))
        except Exception:
            logger.warning("Failed to invalidate cache on document delete")


@receiver(pre_delete, sender="documents.Collection")
def cleanup_collection_vectors(sender, instance, **kwargs):
    try:
        store = PgVectorStore()
        deleted = store.delete_collection(str(instance.id))
        logger.info(
            "Cleaned up collection vectors",
            extra={"collection_id": str(instance.id), "deleted_count": deleted},
        )
    except VectorStoreError:
        logger.exception(
            "Failed to clean up vectors for collection",
            extra={"collection_id": str(instance.id)},
        )

    try:
        SemanticCache().invalidate_collection(str(instance.id))
    except Exception:
        logger.warning("Failed to invalidate cache on collection delete")
