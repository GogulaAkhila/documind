import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "insecure-change-me")

ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

DJANGO_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "corsheaders",
    "django_filters",
    "channels",
]

LOCAL_APPS = [
    "apps.documents",
    "apps.chat",
    "apps.evaluation",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": dj_database_url.config(
        default=os.environ.get(
            "DATABASE_URL", "postgres://localhost:5432/documind"
        ),
        conn_max_age=600,
        conn_health_checks=True,
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Channel Layers
_redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [_redis_url],
        },
    },
}

# REST Framework
REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
    },
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "EXCEPTION_HANDLER": "rest_framework.views.exception_handler",
}

# Celery
CELERY_BROKER_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
if CELERY_BROKER_URL.startswith("rediss://"):
    import ssl as _celery_ssl
    CELERY_BROKER_USE_SSL = {"ssl_cert_reqs": _celery_ssl.CERT_REQUIRED}
    CELERY_REDIS_BACKEND_USE_SSL = {"ssl_cert_reqs": _celery_ssl.CERT_REQUIRED}
CELERY_RESULT_BACKEND = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 1800
CELERY_TASK_SOFT_TIME_LIMIT = 1500

# External Service Keys
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
JINA_API_KEY = os.environ.get("JINA_API_KEY", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
SUPABASE_DB_URL = os.environ.get("SUPABASE_DB_URL", "")
LANGSMITH_API_KEY = os.environ.get("LANGSMITH_API_KEY", "")
SENTRY_DSN = os.environ.get("SENTRY_DSN", "")

# RAG Pipeline Configuration
RAG_RETRIEVAL_TOP_K = int(os.environ.get("RAG_RETRIEVAL_TOP_K", "20"))
RAG_RERANK_TOP_K = int(os.environ.get("RAG_RERANK_TOP_K", "5"))
RAG_RRF_K = int(os.environ.get("RAG_RRF_K", "60"))
RAG_QUERY_EXPANSION_VARIANTS = int(os.environ.get("RAG_QUERY_EXPANSION_VARIANTS", "3"))
RAG_CONFIDENCE_HIGH_THRESHOLD = float(os.environ.get("RAG_CONFIDENCE_HIGH_THRESHOLD", "0.5"))
RAG_CONFIDENCE_LOW_THRESHOLD = float(os.environ.get("RAG_CONFIDENCE_LOW_THRESHOLD", "0.25"))
RAG_DEDUP_SIMILARITY_THRESHOLD = float(os.environ.get("RAG_DEDUP_SIMILARITY_THRESHOLD", "0.95"))
RAG_HYDE_ENABLED = os.environ.get("RAG_HYDE_ENABLED", "true").lower() == "true"
RAG_HYDE_MIN_QUERY_WORDS = int(os.environ.get("RAG_HYDE_MIN_QUERY_WORDS", "5"))
RAG_SEMANTIC_CACHE_ENABLED = os.environ.get("RAG_SEMANTIC_CACHE_ENABLED", "true").lower() == "true"
RAG_SEMANTIC_CACHE_THRESHOLD = float(os.environ.get("RAG_SEMANTIC_CACHE_THRESHOLD", "0.92"))
RAG_SEMANTIC_CACHE_TTL = int(os.environ.get("RAG_SEMANTIC_CACHE_TTL", "3600"))
RAG_CONTEXT_BUDGET_TOKENS = int(os.environ.get("RAG_CONTEXT_BUDGET_TOKENS", "4000"))
RAG_GENERATION_MODEL = os.environ.get("RAG_GENERATION_MODEL", "models/gemini-2.5-flash")
RAG_EMBEDDING_MODEL = os.environ.get("RAG_EMBEDDING_MODEL", "models/gemini-embedding-001")
RAG_RERANKER_MODEL = os.environ.get("RAG_RERANKER_MODEL", "jina-reranker-v2-base-multilingual")

# Logging
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "django.utils.log.ServerFormatter",
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "apps": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
        "core": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
    },
}
