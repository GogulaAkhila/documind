import uuid

from django.db import models


class Collection(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
        ]

    def __str__(self) -> str:
        return self.name


class Document(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    collection = models.ForeignKey(
        Collection, on_delete=models.CASCADE, related_name="documents"
    )
    title = models.CharField(max_length=512)
    file = models.FileField(upload_to="documents/%Y/%m/")
    file_type = models.CharField(max_length=50, default="pdf")
    page_count = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    error_message = models.TextField(blank=True, default="")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-uploaded_at"]
        indexes = [
            models.Index(fields=["collection", "status"]),
            models.Index(fields=["-uploaded_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.get_status_display()})"


class DocumentChunk(models.Model):
    class SectionType(models.TextChoices):
        ABSTRACT = "abstract", "Abstract"
        INTRODUCTION = "introduction", "Introduction"
        METHODS = "methods", "Methods"
        RESULTS = "results", "Results"
        DISCUSSION = "discussion", "Discussion"
        CONCLUSION = "conclusion", "Conclusion"
        REFERENCES = "references", "References"
        OTHER = "other", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(
        Document, on_delete=models.CASCADE, related_name="chunks"
    )
    content = models.TextField()
    chunk_index = models.PositiveIntegerField()
    section_type = models.CharField(
        max_length=20, choices=SectionType.choices, default=SectionType.OTHER
    )
    page_number = models.PositiveIntegerField(default=1)
    metadata = models.JSONField(default=dict, blank=True)
    embedding_id = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["document", "chunk_index"]
        indexes = [
            models.Index(fields=["document", "chunk_index"]),
            models.Index(fields=["document", "section_type"]),
        ]
        unique_together = [["document", "chunk_index"]]

    def __str__(self) -> str:
        return f"{self.document.title} - Chunk {self.chunk_index} ({self.section_type})"
