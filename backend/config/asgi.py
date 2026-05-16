import os

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application
from django.urls import path

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

django_asgi_app = get_asgi_application()

from apps.chat.consumers.chat_consumer import ChatConsumer  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": URLRouter(
            [
                path("ws/chat/<uuid:collection_id>/", ChatConsumer.as_asgi()),
            ]
        ),
    }
)
