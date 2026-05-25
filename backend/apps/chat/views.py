import json
import logging

from asgiref.sync import sync_to_async
from django.http import HttpResponseNotAllowed, JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
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

        data = MessageSerializer(assistant_message).data
        data["confidence_level"] = result.confidence_level
        data["retrieval_score"] = result.retrieval_score
        data["flagged_claims"] = result.flagged_claims
        data["query_type"] = result.query_type
        return Response(data, status=status.HTTP_201_CREATED)


@csrf_exempt
async def message_stream_view(request):
    """SSE endpoint that streams RAG pipeline generation tokens.

    POST /api/v1/chat/messages/stream/
    Body: {"session": "<uuid>", "content": "user question"}

    Sends newline-delimited JSON events:
      {"type": "phase",      "data": "searching"}
      {"type": "confidence", "data": {"level": "high", "score": 0.72}}
      {"type": "sources",    "data": [...]}
      {"type": "token",      "data": "partial text"}
      {"type": "done",       "data": {"citations": [...], ...}}
      {"type": "error",      "data": "error message"}
    """
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"detail": "Invalid JSON body"}, status=400)

    session_id = body.get("session")
    content = (body.get("content") or "").strip()

    if not session_id or not content:
        return JsonResponse({"detail": "session and content are required"}, status=400)

    try:
        session = await sync_to_async(ChatSession.objects.get)(id=session_id)
    except ChatSession.DoesNotExist:
        return JsonResponse({"detail": "Chat session not found"}, status=404)

    await sync_to_async(Message.objects.create)(
        session=session,
        role=Message.Role.USER,
        content=content,
    )

    # Fetch recent chat history for conversational context
    history = body.get("history", None)
    if history is None:
        recent_msgs = await sync_to_async(
            lambda: list(
                Message.objects.filter(session=session)
                .order_by("-created_at")[:12]
                .values("role", "content")
            )
        )()
        # Reverse to chronological order and exclude the message we just created
        history = list(reversed(recent_msgs))[:-1] if len(recent_msgs) > 1 else []

    response = StreamingHttpResponse(
        _stream_events(session, content, history),
        content_type="text/event-stream",
    )
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


async def _stream_events(session, content: str, chat_history: list[dict] | None = None):
    """Async generator that yields SSE-formatted lines."""
    pipeline = RAGPipeline()
    full_answer = ""
    final_meta = {}

    try:
        async for event in pipeline.query_stream(
            user_query=content,
            collection_id=str(session.collection_id),
            chat_history=chat_history,
        ):
            event_type = event.get("type", "")
            if event_type == "token":
                full_answer += event["data"]
            elif event_type == "done":
                final_meta = event.get("data", {})

            yield f"data: {json.dumps(event)}\n\n"

    except Exception as e:
        logger.exception("Streaming pipeline failed", extra={"error": str(e)})
        yield f"data: {json.dumps({'type': 'error', 'data': 'Failed to generate response. Please try again.'})}\n\n"
        return

    if full_answer:
        citations = final_meta.get("citations", [])
        assistant_msg = await sync_to_async(Message.objects.create)(
            session=session,
            role=Message.Role.ASSISTANT,
            content=full_answer,
            sources=citations,
        )
        yield f"data: {json.dumps({'type': 'message_saved', 'data': {'id': str(assistant_msg.id)}})}\n\n"


class MessageFeedbackViewSet(viewsets.ModelViewSet):
    queryset = MessageFeedback.objects.all()
    serializer_class = MessageFeedbackSerializer
    http_method_names = ["get", "post", "head", "options"]
