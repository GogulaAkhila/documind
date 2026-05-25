from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ChatSessionViewSet, MessageFeedbackViewSet, MessageViewSet, message_stream_view

router = DefaultRouter()
router.register("sessions", ChatSessionViewSet, basename="chatsession")
router.register("messages", MessageViewSet, basename="message")
router.register("feedback", MessageFeedbackViewSet, basename="messagefeedback")

urlpatterns = [
    path("messages/stream/", message_stream_view, name="message-stream"),
] + router.urls
