import uuid

from django.db import models

from apps.documents.models import Collection


class EvalRun(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    collection = models.ForeignKey(
        Collection, on_delete=models.CASCADE, related_name="eval_runs"
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    metrics = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["collection", "-started_at"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"EvalRun {self.id} ({self.status})"


class EvalQuestion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    eval_run = models.ForeignKey(
        EvalRun, on_delete=models.CASCADE, related_name="questions"
    )
    question = models.TextField()
    ground_truth = models.TextField(blank=True, default="")
    generated_answer = models.TextField(blank=True, default="")
    retrieved_contexts = models.JSONField(default=list, blank=True)
    scores = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(fields=["eval_run"]),
        ]

    def __str__(self) -> str:
        return f"Q: {self.question[:80]}"
