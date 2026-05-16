import logging
import uuid

from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.chat.models import ChatSession, Message
from core.rag.pipeline import RAGPipeline

logger = logging.getLogger(__name__)


class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self) -> None:
        self.collection_id = str(self.scope["url_route"]["kwargs"]["collection_id"])
        self.room_group_name = f"chat_{self.collection_id}"

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        logger.info(
            "WebSocket connected",
            extra={"collection_id": self.collection_id},
        )

    async def disconnect(self, close_code: int) -> None:
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        logger.info(
            "WebSocket disconnected",
            extra={"collection_id": self.collection_id, "close_code": close_code},
        )

    async def receive_json(self, content: dict) -> None:
        query = content.get("query", "").strip()
        session_id = content.get("session_id")

        if not query:
            await self.send_json({"type": "error", "data": "Query cannot be empty"})
            return

        if not session_id:
            await self.send_json({"type": "error", "data": "session_id is required"})
            return

        try:
            await self._handle_query(query, session_id)
        except Exception as e:
            logger.exception(
                "Error processing WebSocket query",
                extra={"collection_id": self.collection_id, "error": str(e)},
            )
            await self.send_json({"type": "error", "data": "An error occurred processing your request"})

    async def _handle_query(self, query: str, session_id: str) -> None:
        from asgiref.sync import sync_to_async

        session = await sync_to_async(ChatSession.objects.get)(id=session_id)

        await sync_to_async(Message.objects.create)(
            session=session,
            role=Message.Role.USER,
            content=query,
        )

        pipeline = RAGPipeline()
        collected_tokens: list[str] = []
        sources: list[dict] = []

        async for event in pipeline.query_stream(
            user_query=query,
            collection_id=self.collection_id,
        ):
            if event["type"] == "token":
                collected_tokens.append(event["data"])
                await self.send_json({"type": "token", "data": event["data"]})
            elif event["type"] == "sources":
                sources = event["data"]
                await self.send_json({"type": "sources", "data": event["data"]})

        full_answer = "".join(collected_tokens)

        await sync_to_async(Message.objects.create)(
            session=session,
            role=Message.Role.ASSISTANT,
            content=full_answer,
            sources=sources,
        )

        await self.send_json({"type": "done"})
