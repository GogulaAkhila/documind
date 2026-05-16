from rest_framework.routers import DefaultRouter

from .views import ChatSessionViewSet, MessageFeedbackViewSet, MessageViewSet

router = DefaultRouter()
router.register("sessions", ChatSessionViewSet, basename="chatsession")
router.register("messages", MessageViewSet, basename="message")
router.register("feedback", MessageFeedbackViewSet, basename="messagefeedback")

urlpatterns = router.urls
