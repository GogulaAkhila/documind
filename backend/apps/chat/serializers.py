from rest_framework import serializers

from .models import ChatSession, Message, MessageFeedback


class ChatSessionSerializer(serializers.ModelSerializer):
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatSession
        fields = ["id", "collection", "title", "message_count", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_message_count(self, obj: ChatSession) -> int:
        return obj.messages.count()


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["id", "session", "role", "content", "sources", "created_at"]
        read_only_fields = ["id", "role", "sources", "created_at"]

    def validate_content(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError("Message content cannot be empty.")
        if len(value) > 10000:
            raise serializers.ValidationError("Message content exceeds maximum length of 10000 characters.")
        return value.strip()


class MessageCreateSerializer(serializers.Serializer):
    session = serializers.UUIDField()
    content = serializers.CharField(max_length=10000)

    def validate_content(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError("Message content cannot be empty.")
        return value.strip()


class MessageFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageFeedback
        fields = ["id", "message", "rating", "comment", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_message(self, value):
        if value.role != Message.Role.ASSISTANT:
            raise serializers.ValidationError("Feedback can only be provided on assistant messages.")
        if hasattr(value, "feedback"):
            raise serializers.ValidationError("Feedback already exists for this message.")
        return value
