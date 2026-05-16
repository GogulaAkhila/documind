import logging

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.response import Response

from .models import Collection, Document, DocumentChunk
from .serializers import CollectionSerializer, DocumentChunkSerializer, DocumentSerializer
from .tasks import process_document_task

logger = logging.getLogger(__name__)


class CollectionViewSet(viewsets.ModelViewSet):
    queryset = Collection.objects.all()
    serializer_class = CollectionSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at"]


class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.select_related("collection").all()
    serializer_class = DocumentSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["collection", "status"]
    ordering_fields = ["uploaded_at", "title"]

    def perform_create(self, serializer) -> None:
        document = serializer.save(
            file_type=self._extract_file_type(serializer.validated_data["file"])
        )
        logger.info(
            "Document uploaded, queuing processing",
            extra={"document_id": str(document.id)},
        )
        process_document_task.delay(str(document.id))

    def _extract_file_type(self, file) -> str:
        name = file.name.lower()
        if name.endswith(".pdf"):
            return "pdf"
        return "unknown"

    def destroy(self, request, *args, **kwargs):
        document = self.get_object()
        if document.status == Document.Status.PROCESSING:
            return Response(
                {"detail": "Cannot delete a document while it is being processed."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)


class DocumentChunkViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DocumentChunkSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["document", "section_type"]
    ordering_fields = ["chunk_index"]

    def get_queryset(self):
        return DocumentChunk.objects.select_related("document").all()
