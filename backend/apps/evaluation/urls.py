from rest_framework.routers import DefaultRouter

from .views import EvalQuestionViewSet, EvalRunViewSet

router = DefaultRouter()
router.register("runs", EvalRunViewSet, basename="evalrun")
router.register("questions", EvalQuestionViewSet, basename="evalquestion")

urlpatterns = router.urls
