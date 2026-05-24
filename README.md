# DocuMind — Production-Grade RAG System for Document Intelligence

A full-stack Retrieval-Augmented Generation pipeline enabling cross-document Q&A over any PDF documents with inline citations, hybrid retrieval, and evaluation metrics.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (Vite)                      │
│   Chat UI │ Document Upload │ Eval Dashboard │ Citations     │
└─────────────────┬───────────────────────────────────────────┘
                  │ REST API
┌─────────────────▼───────────────────────────────────────────┐
│              Django Backend (DRF + Channels)                  │
│                                                               │
│  ┌──────────────────── RAG Pipeline ──────────────────────┐  │
│  │                                                         │  │
│  │  Query Classify ──► Semantic Cache ──► Query Expansion  │  │
│  │       │                                    │            │  │
│  │       ▼ (short/vague?)              Adaptive HyDE       │  │
│  │                                           │             │  │
│  │  Hybrid Retrieval (Dense + BM25/FTS + RRF)              │  │
│  │       │                                                 │  │
│  │  Dedup (ID + Semantic) ──► Jina Rerank (fallback: RRF)  │  │
│  │       │                                                 │  │
│  │  Confidence Gate (HIGH/MEDIUM/LOW)                      │  │
│  │       │                                                 │  │
│  │  Context Budget ──► Generation (Gemini 2.5 Flash)       │  │
│  │       │                                                 │  │
│  │  Guardrail (annotate) ──► Pipeline Tracing              │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  Celery Workers ──► Document Ingestion (Docling + Chunking)  │
│  RAGAS Eval     ──► Faithfulness, Relevance, Precision       │
└──────────────┬────────────────────────────┬──────────────────┘
               │                            │
    ┌──────────▼──────────┐     ┌───────────▼──────────┐
    │  Supabase Postgres  │     │     Redis (Upstash)   │
    │  + pgvector         │     │  Channels + Celery    │
    │  (data + vectors)   │     │  broker               │
    └─────────────────────┘     └──────────────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, shadcn/ui |
| **State** | Zustand, TanStack Query |
| **Backend** | Django 5.1, Django REST Framework, Django Channels (Daphne) |
| **LLM** | Google Gemini 2.5 Flash (via REST API) |
| **Embeddings** | Google Gemini Embedding 001 (768 dims) with sentence-transformers fallback |
| **Vector DB** | Supabase PostgreSQL + pgvector (IVFFlat index) |
| **Re-ranker** | Jina Reranker v2 |
| **PDF Parsing** | Docling 2.95 (pypdfium2 backend) — layout-aware extraction + HybridChunker |
| **Evaluation** | RAGAS (faithfulness, relevance, context precision) |
| **Task Queue** | Celery + Redis (Upstash) |
| **Observability** | Pipeline tracing (per-stage latency), Sentry, LangSmith (optional) |
| **Deployment** | Vercel (frontend), Render (backend) |

## Key Features

### Document Processing
- **Docling-Powered Extraction** — Layout-aware PDF parsing with table structure detection, heading hierarchy, and section classification
- **HybridChunker** — Hierarchical + token-aware chunking (512 max tokens) with table header repetition and peer merging
- **Dual Content Storage** — `content_for_embedding` (contextualized with heading path) + `content` (clean for display)

### Retrieval Pipeline
- **Hybrid Retrieval** — Dense vector search (pgvector cosine) + PostgreSQL full-text search (tsvector) with reciprocal rank fusion (RRF k=60)
- **Multi-Query Expansion** — User question → up to 3 reformulated queries via Gemini → merged retrieval for better recall
- **Adaptive HyDE** — For short/vague queries, generates a hypothetical answer and embeds that for dense search (15-20% recall improvement)
- **Query Classification** — Rule-based classifier (factual/short_vague/comparison/multi_hop/general) drives adaptive retrieval strategies
- **Near-Duplicate Deduplication** — ID-based + semantic cosine similarity dedup removes redundant chunks before reranking
- **Re-ranking with Fallback** — Jina Reranker v2 (top 20 → top 5) with graceful fallback to RRF ordering on API failure
- **Confidence Gating** — 3-state retrieval quality scoring: HIGH → answer, MEDIUM → answer with caveat, LOW → abstain ("I don't know")
- **Context Budget** — Token-limited chunk selection (configurable, default 4000 tokens) prevents context window overflow

### Generation & Safety
- **Inline Citations** — Every answer cites `[Document Title, Page X]` with references
- **Confidence-Aware Generation** — MEDIUM confidence prompts the LLM to preface answers with uncertainty caveats
- **Hallucination Guardrail (Annotate Mode)** — Post-generation grounding check returns confidence level and flagged ungrounded claims

### Performance & Observability
- **Semantic Query Cache** — Two-tier cache (exact hash + cosine similarity) skips the full pipeline for repeat queries; auto-invalidates on document changes
- **Pipeline Tracing** — Per-stage latency and metadata logging (cache, expansion, HyDE, retrieval, dedup, reranking, generation, guardrail)
- **Configurable Pipeline** — All 16 RAG parameters exposed as Django settings with env-var overrides

### Other
- **Evaluation Dashboard** — RAGAS metrics (faithfulness, answer relevance, context precision)
- **Embedding Fallback** — Automatically falls back to local sentence-transformers model if Gemini API is unavailable
- **Any Document Type** — Supports research papers, technical documentation, SOPs, HR handbooks, compliance manuals, and any PDF-based content

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 22+
- Docker & Docker Compose (optional, for containerized setup)
- Supabase account (free tier)
- API keys: Google AI (Gemini), Jina AI

### Quick Start with Docker

```bash
cd documind

cp backend/.env.example backend/.env
# Edit backend/.env with your API keys

docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/v1/

### Manual Setup

#### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Enable pgvector in the SQL Editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. The `document_embeddings` table is created automatically on first run, or manually via:
   ```bash
   python manage.py shell -c "from core.vectorstore.pgvector_store import PgVectorStore; PgVectorStore().initialize()"
   ```
4. Copy your project URL, anon key, and direct database connection string to `.env`

#### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env with your Supabase, Gemini, Jina, and Redis credentials

python manage.py makemigrations documents chat evaluation
python manage.py migrate

# Start Daphne (ASGI server with WebSocket support)
daphne -b 0.0.0.0 -p 8000 config.asgi:application

# In a separate terminal — start Celery worker
# macOS requires --pool=solo to avoid native library crashes (Docling/pypdfium2)
OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES celery -A config.celery worker -l info --pool=solo
```

> **macOS Note:** The default Celery `prefork` pool causes SIGSEGV crashes with Docling's native libraries (pypdfium2). Always use `--pool=solo` on macOS for development.

> **Shell Environment Note:** If `GEMINI_API_KEY` is set in your shell environment, it overrides the `.env` file. Use `unset GEMINI_API_KEY` before starting Daphne/Celery if you manage keys via `.env`.

#### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be at http://localhost:5173.

### Environment Variables

Create `backend/.env` from `.env.example`:

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google AI API key (from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)). Must start with `AIzaSy...` |
| `JINA_API_KEY` | Yes | Jina AI API key for Reranker v2 (from [jina.ai](https://jina.ai/reranker)) |
| `DATABASE_URL` | Yes | Supabase PostgreSQL direct connection string (port 5432) |
| `SUPABASE_DB_URL` | Yes | Same as DATABASE_URL (used by pgvector store for direct connections) |
| `SUPABASE_URL` | Yes | Supabase project API URL (`https://<ref>.supabase.co`) |
| `SUPABASE_KEY` | Yes | Supabase anon (publishable) key |
| `REDIS_URL` | Yes | Redis URL — Upstash (`rediss://...`) or local (`redis://localhost:6379/0`) |
| `LANGSMITH_API_KEY` | No | LangSmith tracing for RAG pipeline debugging |
| `SENTRY_DSN` | No | Sentry error tracking |

Create `frontend/.env.local`:
```
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000
```

## Project Structure

```
documind/
├── backend/
│   ├── config/                # Django settings, URLs, ASGI/WSGI, Celery
│   │   └── settings/          # Split settings (base, development, production)
│   ├── apps/
│   │   ├── documents/         # Collections, document upload, ingestion pipeline
│   │   ├── chat/              # Chat sessions, messages, WebSocket consumers
│   │   └── evaluation/        # RAGAS evaluation runs and questions
│   ├── core/
│   │   ├── rag/               # RAG pipeline modules
│   │   │   ├── chunking.py        # Docling HybridChunker (layout-aware)
│   │   │   ├── embeddings.py      # Gemini Embedding 001 + local fallback
│   │   │   ├── retrieval.py       # Hybrid retriever (dense + FTS + RRF + HyDE)
│   │   │   ├── reranker.py        # Jina Reranker v2 (with RRF fallback)
│   │   │   ├── query_expansion.py # Multi-query expansion via Gemini
│   │   │   ├── query_classifier.py# Rule-based query type classification
│   │   │   ├── hyde.py            # Hypothetical Document Embeddings
│   │   │   ├── confidence.py      # 3-state retrieval confidence scoring
│   │   │   ├── semantic_cache.py  # Two-tier semantic query cache
│   │   │   ├── tracing.py         # Per-stage pipeline observability
│   │   │   ├── generation.py      # Gemini 2.5 Flash (confidence-aware)
│   │   │   ├── guardrails.py      # Hallucination guardrail (annotate mode)
│   │   │   └── pipeline.py        # Main RAG orchestrator
│   │   ├── vectorstore/       # Supabase pgvector operations
│   │   └── utils/             # Citation extraction utilities
│   └── tests/                 # pytest test suite
├── frontend/
│   └── src/
│       ├── components/        # React components (chat, documents, evaluation, layout)
│       ├── hooks/             # TanStack Query hooks for API calls
│       ├── stores/            # Zustand stores (chat, document, UI state)
│       ├── lib/               # Axios API client, WebSocket manager
│       ├── pages/             # Route pages (home, collection, chat, evaluation)
│       ├── providers/         # Query and theme providers
│       └── types/             # TypeScript interfaces
├── docker-compose.yml         # Full stack: backend + celery + redis + frontend
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/v1/documents/collections/` | List/create collections |
| GET/PUT/DEL | `/api/v1/documents/collections/:id/` | Collection detail |
| GET/POST | `/api/v1/documents/files/` | List/upload documents (filter: `?collection=<id>`) |
| GET | `/api/v1/documents/chunks/` | List chunks (filter: `?document=<id>`) |
| GET/POST | `/api/v1/chat/sessions/` | List/create chat sessions (filter: `?collection=<id>`) |
| GET/POST | `/api/v1/chat/messages/` | List/send messages (filter: `?session=<id>`) |
| POST | `/api/v1/chat/feedback/` | Submit message feedback |
| GET/POST | `/api/v1/evaluation/runs/` | List/trigger eval runs (filter: `?collection=<id>`) |
| GET | `/api/v1/evaluation/questions/` | Eval question details (filter: `?eval_run=<id>`) |

### Chat Message Flow (REST)

**Send a question:**
```bash
curl -X POST http://localhost:8000/api/v1/chat/messages/ \
  -H "Content-Type: application/json" \
  -d '{"session": "<session-uuid>", "content": "What is the Transformer architecture?"}'
```

**Response** includes the RAG-generated answer with inline citations and retrieval metadata:
```json
{
  "id": "uuid",
  "session": "session-uuid",
  "role": "assistant",
  "content": "The Transformer is a model architecture eschewing recurrence and instead relying entirely on an attention mechanism [Attention Is All You Need, Page 2]...",
  "sources": [{"document_title": "...", "page_number": 2, "section_type": "abstract"}],
  "confidence_level": "high",
  "retrieval_score": 0.72,
  "flagged_claims": [],
  "query_type": "factual",
  "created_at": "2026-05-17T..."
}
```

## RAG Pipeline Flow

```
User Question
     │
     ▼
Query Classification (rule-based, sub-ms)
  → factual / short_vague / comparison / multi_hop / general
     │
     ▼
Semantic Cache Lookup (exact hash + cosine similarity)
  → HIT? Return cached answer immediately
  → MISS? Continue pipeline ▼
     │
     ▼
Query Expansion (Gemini 2.5 Flash)
  → original + up to 3 reformulated queries
     │
     ▼
Adaptive HyDE (for short/vague queries only)
  → Generate hypothetical answer paragraph
  → Embed that instead of raw query for dense search
     │
     ▼
Hybrid Retrieval (for each expanded query)
  → Dense: pgvector cosine similarity (Gemini embeddings, 768 dims)
  → Sparse: PostgreSQL tsvector full-text search
  → Reciprocal Rank Fusion (k=60) to merge results
     │
     ▼
Deduplication
  → ID-based (exact chunk_id match)
  → Semantic (cosine similarity ≥ 0.95 → remove near-duplicates)
     │
     ▼
Jina Reranker v2 (top 20 → top 5)
  → Fallback: RRF ordering if Jina API unavailable
     │
     ▼
Confidence Gating (3-state)
  → HIGH (top_score ≥ 0.5): proceed normally
  → MEDIUM (top_score ≥ 0.25): answer with uncertainty caveat
  → LOW (top_score < 0.25): abstain — "I don't have enough information"
     │
     ▼
Context Budget (token-limited chunk selection)
     │
     ▼
Answer Generation (Gemini 2.5 Flash)
  → Confidence-aware prompting (MEDIUM adds caveat instruction)
  → Citation format: [Document Title, Page X]
     │
     ▼
Hallucination Guardrail — Annotate Mode
  → Returns confidence level + flagged ungrounded claims
     │
     ▼
Cache Store + Pipeline Trace Log
     │
     ▼
Response with citations, confidence, and flagged claims
```

## Configuration

All RAG pipeline parameters are configurable via environment variables (defaults shown):

| Variable | Default | Description |
|---|---|---|
| `RAG_RETRIEVAL_TOP_K` | 20 | Candidates per retrieval query |
| `RAG_RERANK_TOP_K` | 5 | Final chunks after reranking |
| `RAG_RRF_K` | 60 | RRF fusion constant |
| `RAG_CONFIDENCE_HIGH_THRESHOLD` | 0.5 | Reranker score for HIGH confidence |
| `RAG_CONFIDENCE_LOW_THRESHOLD` | 0.25 | Below this → abstain |
| `RAG_DEDUP_SIMILARITY_THRESHOLD` | 0.95 | Cosine sim for near-duplicate removal |
| `RAG_HYDE_ENABLED` | true | Enable HyDE for short queries |
| `RAG_HYDE_MIN_QUERY_WORDS` | 5 | Queries shorter than this trigger HyDE |
| `RAG_SEMANTIC_CACHE_ENABLED` | true | Enable semantic query cache |
| `RAG_SEMANTIC_CACHE_THRESHOLD` | 0.92 | Cosine sim for cache hit |
| `RAG_SEMANTIC_CACHE_TTL` | 3600 | Cache TTL in seconds |
| `RAG_CONTEXT_BUDGET_TOKENS` | 4000 | Max tokens for context window |

## Known Issues & Notes

- **Gemini API Key Security:** Google aggressively blocks API keys detected in public code, chat logs, or version control. Never commit `.env` files or share keys in chat. The `.gitignore` excludes `.env` by default.
- **macOS Celery:** Must use `--pool=solo` flag due to native library (Docling/pypdfium2) incompatibility with the default `prefork` pool.
- **Upstash Redis TLS:** Upstash uses `rediss://` (TLS). The Celery SSL config is handled automatically in `settings/base.py`.
- **Embedding Fallback:** If the Gemini API is unavailable, the embedding service falls back to `all-MiniLM-L6-v2` (384 dims). Note that mixing embedding models between ingestion and query time will cause dimension mismatch errors — re-process documents if switching models.
- **Confidence Thresholds:** Default thresholds (HIGH ≥ 0.5, LOW < 0.25) are conservative starting points. Tune against labeled eval sets per corpus. A healthy abstention rate is 5-15%.

## License

MIT
