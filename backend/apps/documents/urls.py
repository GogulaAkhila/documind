from rest_framework.routers import DefaultRouter

from .views import CollectionViewSet, DocumentChunkViewSet, DocumentViewSet

router = DefaultRouter()
router.register("collections", CollectionViewSet, basename="collection")
router.register("files", DocumentViewSet, basename="document")
router.register("chunks", DocumentChunkViewSet, basename="documentchunk")

urlpatterns = router.urls
