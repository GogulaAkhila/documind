from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/documents/", include("apps.documents.urls")),
    path("api/v1/chat/", include("apps.chat.urls")),
    path("api/v1/evaluation/", include("apps.evaluation.urls")),
]
