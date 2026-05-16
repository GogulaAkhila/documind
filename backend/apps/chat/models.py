import uuid

from django.db import models

from apps.documents.models import Collection


class ChatSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    collection = models.ForeignKey(
        Collection, on_delete=models.CASCADE, related_name="chat_sessions"
    )
    title = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["collection", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"Session: {self.title or self.id}"


class Message(models.Model):
    class Role(models.TextChoices):
        USER = "user", "User"
        ASSISTANT = "assistant", "Assistant"
        SYSTEM = "system", "System"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        ChatSession, on_delete=models.CASCADE, related_name="messages"
    )
    role = models.CharField(max_length=10, choices=Role.choices)
    content = models.TextField()
    sources = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["session", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.role}: {self.content[:50]}"


class MessageFeedback(models.Model):
    class Rating(models.TextChoices):
        THUMBS_UP = "thumbs_up", "Thumbs Up"
        THUMBS_DOWN = "thumbs_down", "Thumbs Down"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.OneToOneField(
        Message, on_delete=models.CASCADE, related_name="feedback"
    )
    rating = models.CharField(max_length=12, choices=Rating.choices)
    comment = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["message"]),
        ]

    def __str__(self) -> str:
        return f"Feedback on {self.message_id}: {self.rating}"
