"""Semantic query cache — skips retrieval + LLM for semantically identical questions.

Two-tier approach:
1. Exact match: SHA-256 hash of (collection_id + normalized query)
2. Semantic match: cosine similarity of query embeddings above threshold

Cache is per-collection and auto-invalidates when documents change.
"""
import hashlib
import json
import logging
import time
from dataclasses import asdict, dataclass, field
from typing import Any

import psycopg2
import psycopg2.extras
from django.conf import settings

logger = logging.getLogger(__name__)

CREATE_CACHE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS rag_query_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL,
    query_hash VARCHAR(64) NOT NULL,
    query_text TEXT NOT NULL,
    query_embedding vector(768),
    answer TEXT NOT NULL,
    citations JSONB DEFAULT '[]'::jsonb,
    confidence_level VARCHAR(10) DEFAULT 'high',
    retrieval_score FLOAT DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cache_hash ON rag_query_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_cache_collection ON rag_query_cache(collection_id);
CREATE INDEX IF NOT EXISTS idx_cache_embedding ON rag_query_cache
    USING ivfflat (query_embedding vector_cosine_ops) WITH (lists = 1);
"""


@dataclass
class CachedResult:
    answer: str
    citations: list[dict[str, Any]]
    confidence_level: str = "high"
    retrieval_score: float = 0.0


class SemanticCache:
    def __init__(self) -> None:
        self._db_url = settings.SUPABASE_DB_URL or settings.DATABASES["default"].get("NAME", "")
        self._initialized = False

    def _get_connection(self):
        return psycopg2.connect(self._db_url)

    def _ensure_table(self) -> None:
        if self._initialized:
            return
        try:
            conn = self._get_connection()
            with conn.cursor() as cur:
                cur.execute(CREATE_CACHE_TABLE_SQL)
            conn.commit()
            conn.close()
            self._initialized = True
        except Exception as e:
            logger.warning("Cache table init failed", extra={"error": str(e)})

    @staticmethod
    def _normalize_query(query: str) -> str:
        return " ".join(query.lower().strip().split())

    @staticmethod
    def _hash_query(collection_id: str, query: str) -> str:
        normalized = SemanticCache._normalize_query(query)
        return hashlib.sha256(f"{collection_id}:{normalized}".encode()).hexdigest()

    def lookup(
        self,
        query: str,
        query_embedding: list[float],
        collection_id: str,
    ) -> CachedResult | None:
        """Check cache for exact or semantic match. Returns None on miss."""
        if not settings.RAG_SEMANTIC_CACHE_ENABLED:
            return None

        self._ensure_table()
        query_hash = self._hash_query(collection_id, query)

        try:
            conn = self._get_connection()
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                # Tier 1: exact hash match
                cur.execute(
                    """
                    SELECT answer, citations, confidence_level, retrieval_score
                    FROM rag_query_cache
                    WHERE query_hash = %s AND collection_id = %s::uuid
                      AND expires_at > NOW()
                    LIMIT 1
                    """,
                    (query_hash, collection_id),
                )
                row = cur.fetchone()
                if row:
                    logger.info("Cache HIT (exact)", extra={"query": query[:80]})
                    conn.close()
                    return CachedResult(
                        answer=row["answer"],
                        citations=row["citations"] if isinstance(row["citations"], list) else json.loads(row["citations"]),
                        confidence_level=row["confidence_level"],
                        retrieval_score=float(row["retrieval_score"]),
                    )

                # Tier 2: semantic similarity match
                threshold = settings.RAG_SEMANTIC_CACHE_THRESHOLD
                cur.execute(
                    """
                    SELECT answer, citations, confidence_level, retrieval_score,
                           1 - (query_embedding <=> %s::vector) AS similarity
                    FROM rag_query_cache
                    WHERE collection_id = %s::uuid
                      AND expires_at > NOW()
                    ORDER BY query_embedding <=> %s::vector
                    LIMIT 1
                    """,
                    (query_embedding, collection_id, query_embedding),
                )
                row = cur.fetchone()
                if row and float(row["similarity"]) >= threshold:
                    logger.info(
                        "Cache HIT (semantic)",
                        extra={"query": query[:80], "similarity": round(float(row["similarity"]), 4)},
                    )
                    conn.close()
                    return CachedResult(
                        answer=row["answer"],
                        citations=row["citations"] if isinstance(row["citations"], list) else json.loads(row["citations"]),
                        confidence_level=row["confidence_level"],
                        retrieval_score=float(row["retrieval_score"]),
                    )

            conn.close()
        except Exception as e:
            logger.warning("Cache lookup failed", extra={"error": str(e)})

        return None

    def store(
        self,
        query: str,
        query_embedding: list[float],
        collection_id: str,
        answer: str,
        citations: list[dict[str, Any]],
        confidence_level: str = "high",
        retrieval_score: float = 0.0,
    ) -> None:
        """Store a query result in the cache."""
        if not settings.RAG_SEMANTIC_CACHE_ENABLED:
            return

        self._ensure_table()
        query_hash = self._hash_query(collection_id, query)
        ttl = settings.RAG_SEMANTIC_CACHE_TTL

        try:
            conn = self._get_connection()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO rag_query_cache
                        (collection_id, query_hash, query_text, query_embedding,
                         answer, citations, confidence_level, retrieval_score, expires_at)
                    VALUES (%s::uuid, %s, %s, %s::vector, %s, %s::jsonb, %s, %s,
                            NOW() + INTERVAL '%s seconds')
                    ON CONFLICT (query_hash) DO NOTHING
                    """,
                    (
                        collection_id,
                        query_hash,
                        query,
                        query_embedding,
                        answer,
                        json.dumps(citations),
                        confidence_level,
                        retrieval_score,
                        ttl,
                    ),
                )
            conn.commit()
            conn.close()
            logger.info("Cache STORE", extra={"query": query[:80], "ttl": ttl})
        except Exception as e:
            logger.warning("Cache store failed", extra={"error": str(e)})

    def invalidate_collection(self, collection_id: str) -> int:
        """Invalidate all cache entries for a collection (call on document changes)."""
        self._ensure_table()
        try:
            conn = self._get_connection()
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM rag_query_cache WHERE collection_id = %s::uuid",
                    (collection_id,),
                )
                deleted = cur.rowcount
            conn.commit()
            conn.close()
            if deleted > 0:
                logger.info(
                    "Cache invalidated",
                    extra={"collection_id": collection_id, "entries_removed": deleted},
                )
            return deleted
        except Exception as e:
            logger.warning("Cache invalidation failed", extra={"error": str(e)})
            return 0
