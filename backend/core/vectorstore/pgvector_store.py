import logging
import uuid
from typing import Any

import psycopg2
import psycopg2.extras
from django.conf import settings

from core.rag.chunking import Chunk

# content_for_embedding holds the contextualized text (with heading path prepended)
# that was used to generate the embedding. FTS indexes this richer text so keyword
# searches benefit from the heading context, while `content` stays clean for display.

logger = logging.getLogger(__name__)

EMBEDDING_DIMENSION = 768
BATCH_SIZE = 50

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS document_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL,
    document_id UUID NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_for_embedding TEXT NOT NULL DEFAULT '',
    section_type VARCHAR(30) NOT NULL DEFAULT 'other',
    page_number INTEGER NOT NULL DEFAULT 1,
    document_title VARCHAR(512) DEFAULT '',
    metadata JSONB DEFAULT '{{}}'::jsonb,
    embedding vector({dimension}),
    content_tsv tsvector GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(content_for_embedding, content))
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embeddings_collection ON document_embeddings(collection_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_document ON document_embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON document_embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 1);
CREATE INDEX IF NOT EXISTS idx_embeddings_tsv ON document_embeddings USING gin(content_tsv);
""".format(dimension=EMBEDDING_DIMENSION)

MIGRATE_TABLE_SQL = """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'document_embeddings'
        AND column_name = 'content_for_embedding'
    ) THEN
        ALTER TABLE document_embeddings
            ADD COLUMN content_for_embedding TEXT NOT NULL DEFAULT '';
    END IF;
END $$;
"""

# `content_tsv` is a GENERATED STORED column, so adding `content_for_embedding`
# above does NOT retroactively change what content_tsv is computed from on
# tables created before that column existed — it keeps indexing the old
# expression (`to_tsvector('english', content)`) forever, silently starving
# full-text search of the richer, contextualized text (and of any content
# that lives only in headings/titles prepended to content_for_embedding).
# This repairs it by dropping + recreating the column (and its GIN index)
# whenever its stored generation expression is stale, which also makes
# Postgres backfill content_tsv for every existing row automatically.
REPAIR_TSV_SQL = """
DO $$
DECLARE
    tsv_expr TEXT;
BEGIN
    SELECT generation_expression INTO tsv_expr
    FROM information_schema.columns
    WHERE table_name = 'document_embeddings' AND column_name = 'content_tsv';

    IF tsv_expr IS NOT NULL AND tsv_expr NOT LIKE '%content_for_embedding%' THEN
        DROP INDEX IF EXISTS idx_embeddings_tsv;
        ALTER TABLE document_embeddings DROP COLUMN content_tsv;
        ALTER TABLE document_embeddings ADD COLUMN content_tsv tsvector GENERATED ALWAYS AS (
            to_tsvector('english', coalesce(content_for_embedding, content))
        ) STORED;
        CREATE INDEX idx_embeddings_tsv ON document_embeddings USING gin(content_tsv);
    END IF;
END $$;
"""


class VectorStoreError(Exception):
    """Raised when vector store operations fail."""


class PgVectorStore:
    def __init__(self) -> None:
        self._db_url = settings.SUPABASE_DB_URL or settings.DATABASES["default"].get("NAME", "")

    def _get_connection(self):
        try:
            return psycopg2.connect(self._db_url)
        except psycopg2.Error as e:
            raise VectorStoreError(f"Failed to connect to vector store: {e}") from e

    def initialize(self) -> None:
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                cur.execute(CREATE_TABLE_SQL)
                cur.execute(MIGRATE_TABLE_SQL)
                cur.execute(REPAIR_TSV_SQL)
            conn.commit()
            logger.info("Vector store initialized")
        except psycopg2.Error as e:
            conn.rollback()
            raise VectorStoreError(f"Failed to initialize vector store: {e}") from e
        finally:
            conn.close()

    def store_embeddings(
        self,
        chunks: list[Chunk],
        embeddings: list[list[float]],
        collection_id: str,
        document_id: str,
    ) -> list[str]:
        if len(chunks) != len(embeddings):
            raise VectorStoreError(
                f"Chunk count ({len(chunks)}) does not match embedding count ({len(embeddings)})"
            )

        conn = self._get_connection()
        embedding_ids: list[str] = []

        try:
            with conn.cursor() as cur:
                for i in range(0, len(chunks), BATCH_SIZE):
                    batch_chunks = chunks[i : i + BATCH_SIZE]
                    batch_embeddings = embeddings[i : i + BATCH_SIZE]

                    values = []
                    for j, (chunk, embedding) in enumerate(zip(batch_chunks, batch_embeddings)):
                        emb_id = str(uuid.uuid4())
                        embedding_ids.append(emb_id)
                        content_for_emb = getattr(chunk, "content_for_embedding", "") or chunk.content
                        values.append((
                            emb_id,
                            collection_id,
                            document_id,
                            i + j,
                            chunk.content,
                            content_for_emb,
                            chunk.section_type,
                            chunk.page_number,
                            chunk.metadata.get("document_title", ""),
                            psycopg2.extras.Json(chunk.metadata),
                            embedding,
                        ))

                    insert_sql = """
                        INSERT INTO document_embeddings
                            (id, collection_id, document_id, chunk_index, content,
                             content_for_embedding, section_type, page_number,
                             document_title, metadata, embedding)
                        VALUES (%s, %s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s::vector)
                    """
                    psycopg2.extras.execute_batch(cur, insert_sql, values, page_size=BATCH_SIZE)

            conn.commit()
            logger.info(
                "Stored embeddings",
                extra={"count": len(embedding_ids), "collection_id": collection_id},
            )
            return embedding_ids

        except psycopg2.Error as e:
            conn.rollback()
            raise VectorStoreError(f"Failed to store embeddings: {e}") from e
        finally:
            conn.close()

    def similarity_search(
        self,
        query_embedding: list[float],
        collection_id: str,
        top_k: int = 20,
    ) -> list[dict[str, Any]]:
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        id::text,
                        content,
                        section_type,
                        page_number,
                        document_title,
                        metadata,
                        1 - (embedding <=> %s::vector) AS score
                    FROM document_embeddings
                    WHERE collection_id = %s::uuid
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                    """,
                    (query_embedding, collection_id, query_embedding, top_k),
                )
                rows = cur.fetchall()
                return [dict(row) for row in rows]
        except psycopg2.Error as e:
            raise VectorStoreError(f"Similarity search failed: {e}") from e
        finally:
            conn.close()

    def full_text_search(
        self,
        query: str,
        collection_id: str,
        top_k: int = 20,
    ) -> list[dict[str, Any]]:
        # Underscore-joined tokens (e.g. filename-derived names like
        # "AKSHITA_JAIN") get lexed as a single unstemmed word by Postgres's
        # english tsvector config and won't match "akshita" + "jain" stored
        # as separate lexemes in the document text. Splitting on underscores
        # lets plainto_tsquery match each word independently.
        normalized_query = query.replace("_", " ")

        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    -- plainto_tsquery ANDs every term together, so any natural-
                    -- language question containing even one word absent from a
                    -- chunk (e.g. "what did X study" when the chunk never says
                    -- "study") guarantees zero matches. OR-ing the same stemmed
                    -- terms turns this into a proper keyword-recall signal that
                    -- actually complements dense search instead of almost
                    -- always returning nothing.
                    SELECT
                        id::text,
                        content,
                        section_type,
                        page_number,
                        document_title,
                        metadata,
                        ts_rank_cd(
                            content_tsv,
                            to_tsquery('english', replace(plainto_tsquery('english', %s)::text, ' & ', ' | '))
                        ) AS score
                    FROM document_embeddings
                    WHERE collection_id = %s::uuid
                      AND content_tsv @@ to_tsquery('english', replace(plainto_tsquery('english', %s)::text, ' & ', ' | '))
                    ORDER BY score DESC
                    LIMIT %s
                    """,
                    (normalized_query, collection_id, normalized_query, top_k),
                )
                rows = cur.fetchall()
                return [dict(row) for row in rows]
        except psycopg2.Error as e:
            raise VectorStoreError(f"Full-text search failed: {e}") from e
        finally:
            conn.close()

    def delete_collection(self, collection_id: str) -> int:
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM document_embeddings WHERE collection_id = %s::uuid",
                    (collection_id,),
                )
                deleted = cur.rowcount
            conn.commit()
            logger.info(
                "Deleted collection embeddings",
                extra={"collection_id": collection_id, "deleted_count": deleted},
            )
            return deleted
        except psycopg2.Error as e:
            conn.rollback()
            raise VectorStoreError(f"Failed to delete collection: {e}") from e
        finally:
            conn.close()

    def delete_document(self, document_id: str) -> int:
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM document_embeddings WHERE document_id = %s::uuid",
                    (document_id,),
                )
                deleted = cur.rowcount
            conn.commit()
            return deleted
        except psycopg2.Error as e:
            conn.rollback()
            raise VectorStoreError(f"Failed to delete document embeddings: {e}") from e
        finally:
            conn.close()
