import logging

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.response import Response

from core.rag.pipeline import RAGPipeline

from .models import ChatSession, Message, MessageFeedback
from .serializers import (
    ChatSessionSerializer,
    MessageCreateSerializer,
    MessageFeedbackSerializer,
    MessageSerializer,
)

logger = logging.getLogger(__name__)


class ChatSessionViewSet(viewsets.ModelViewSet):
    queryset = ChatSession.objects.all()
    serializer_class = ChatSessionSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["collection"]


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["session"]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return Message.objects.select_related("session").all()

    def create(self, request, *args, **kwargs):
        create_serializer = MessageCreateSerializer(data=request.data)
        create_serializer.is_valid(raise_exception=True)

        session_id = create_serializer.validated_data["session"]
        content = create_serializer.validated_data["content"]

        try:
            session = ChatSession.objects.get(id=session_id)
        except ChatSession.DoesNotExist:
            return Response(
                {"detail": "Chat session not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        user_message = Message.objects.create(
            session=session,
            role=Message.Role.USER,
            content=content,
        )

        pipeline = RAGPipeline()
        try:
            result = pipeline.query(
                user_query=content,
                collection_id=str(session.collection_id),
            )
        except Exception as e:
            logger.exception(
                "RAG pipeline failed",
                extra={"session_id": str(session_id), "error": str(e)},
            )
            return Response(
                {"detail": "Failed to generate response. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        assistant_message = Message.objects.create(
            session=session,
            role=Message.Role.ASSISTANT,
            content=result.answer,
            sources=result.citations,
        )

        serializer = MessageSerializer(assistant_message)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MessageFeedbackViewSet(viewsets.ModelViewSet):
    queryset = MessageFeedback.objects.all()
    serializer_class = MessageFeedbackSerializer
    http_method_names = ["get", "post", "head", "options"]
