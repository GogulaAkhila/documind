from rest_framework import serializers

from .models import Collection, Document, DocumentChunk


class CollectionSerializer(serializers.ModelSerializer):
    document_count = serializers.SerializerMethodField()

    class Meta:
        model = Collection
        fields = ["id", "name", "description", "document_count", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_document_count(self, obj: Collection) -> int:
        return obj.documents.count()


class DocumentSerializer(serializers.ModelSerializer):
    chunk_count = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id", "collection", "title", "file", "file_type",
            "page_count", "status", "error_message", "chunk_count",
            "uploaded_at", "processed_at",
        ]
        read_only_fields = [
            "id", "file_type", "page_count", "status",
            "error_message", "chunk_count", "uploaded_at", "processed_at",
        ]

    def get_chunk_count(self, obj: Document) -> int:
        return obj.chunks.count()

    def validate_file(self, value):
        max_size = 50 * 1024 * 1024  # 50MB
        if value.size > max_size:
            raise serializers.ValidationError("File size must not exceed 50MB.")
        allowed_types = ["application/pdf"]
        if hasattr(value, "content_type") and value.content_type not in allowed_types:
            raise serializers.ValidationError("Only PDF files are supported.")
        return value


class DocumentChunkSerializer(serializers.ModelSerializer):
    document_title = serializers.CharField(source="document.title", read_only=True)

    class Meta:
        model = DocumentChunk
        fields = [
            "id", "document", "document_title", "content", "chunk_index",
            "section_type", "page_number", "metadata", "embedding_id",
        ]
        read_only_fields = ["id"]
