# DocuMind — Production-Grade RAG System for Research Papers

A full-stack Retrieval-Augmented Generation pipeline enabling cross-document Q&A over research papers with inline citations, hybrid retrieval, and evaluation metrics.

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
│  │  Query Expansion ──► Hybrid Retrieval ──► Jina Rerank  │  │
│  │    (Gemini 2.5       (Dense + BM25/FTS)    (top 20→5)  │  │
│  │     Flash)                  │                           │  │
│  │                    ┌────────▼───────┐                   │  │
│  │                    │  Generation    │                   │  │
│  │                    │  (Gemini 2.5   │                   │  │
│  │                    │   Flash)       │                   │  │
│  │                    └────────┬───────┘                   │  │
│  │                             │                           │  │
│  │                  Hallucination Guardrail                │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  Celery Workers ──► Document Ingestion (PyMuPDF + Chunking)  │
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
| **PDF Parsing** | PyMuPDF (fitz) |
| **Evaluation** | RAGAS (faithfulness, relevance, context precision) |
| **Task Queue** | Celery + Redis (Upstash) |
| **Observability** | Sentry, LangSmith (optional) |
| **Deployment** | Vercel (frontend), Render (backend) |

## Key Features

- **Semantic Chunking** — Splits papers by section (Abstract, Methods, Results) rather than arbitrary token counts
- **Hybrid Retrieval** — Dense vector search (pgvector cosine similarity) + PostgreSQL full-text search (tsvector) with reciprocal rank fusion
- **Re-ranking** — Jina Reranker v2 narrows top 20 → top 5 most relevant passages
- **Inline Citations** — Every answer cites `[Paper Title, Page X]` with references
- **Multi-Query Expansion** — User question → 3 reformulated queries via Gemini → merged retrieval for better recall
- **Hallucination Guardrail** — Post-generation verification that claims are grounded in retrieved context
- **Evaluation Dashboard** — RAGAS metrics (faithfulness, answer relevance, context precision)
- **Embedding Fallback** — Automatically falls back to local sentence-transformers model if Gemini API is unavailable

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
# macOS requires --pool=solo to avoid native library crashes (PyMuPDF)
OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES celery -A config.celery worker -l info --pool=solo
```

> **macOS Note:** The default Celery `prefork` pool causes SIGSEGV crashes with PyMuPDF's native C libraries. Always use `--pool=solo` on macOS for development.

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
│   │   │   ├── chunking.py        # Semantic section-based chunker
│   │   │   ├── embeddings.py      # Gemini Embedding 001 + local fallback
│   │   │   ├── retrieval.py       # Hybrid retriever (dense + full-text + RRF)
│   │   │   ├── reranker.py        # Jina Reranker v2
│   │   │   ├── query_expansion.py # Multi-query expansion via Gemini
│   │   │   ├── generation.py      # Gemini 2.5 Flash answer generation
│   │   │   ├── guardrails.py      # Hallucination grounding check
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

**Response** includes the RAG-generated answer with inline citations:
```json
{
  "id": "uuid",
  "session": "session-uuid",
  "role": "assistant",
  "content": "The Transformer is a model architecture eschewing recurrence and instead relying entirely on an attention mechanism [Attention Is All You Need, Page 2]...",
  "sources": [{"paper_title": "...", "page_number": 2, "section_type": "abstract"}],
  "created_at": "2026-05-17T..."
}
```

## RAG Pipeline Flow

```
User Question
     │
     ▼
Query Expansion (Gemini 2.5 Flash)
  → original + 3 reformulated queries
     │
     ▼
Hybrid Retrieval (for each query)
  → Dense search: pgvector cosine similarity (Gemini embeddings, 768 dims)
  → Sparse search: PostgreSQL tsvector full-text search
  → Reciprocal Rank Fusion to merge results
     │
     ▼
Deduplication
     │
     ▼
Jina Reranker v2 (top 20 → top 5)
     │
     ▼
Answer Generation (Gemini 2.5 Flash)
  → System prompt enforces citation format [Paper Title, Page X]
     │
     ▼
Hallucination Guardrail (Gemini 2.5 Flash)
  → Verifies each claim is grounded in retrieved context
     │
     ▼
Response with citations
```

## Known Issues & Notes

- **Gemini API Key Security:** Google aggressively blocks API keys detected in public code, chat logs, or version control. Never commit `.env` files or share keys in chat. The `.gitignore` excludes `.env` by default.
- **macOS Celery:** Must use `--pool=solo` flag due to native library (PyMuPDF) incompatibility with the default `prefork` pool.
- **Upstash Redis TLS:** Upstash uses `rediss://` (TLS). The Celery SSL config is handled automatically in `settings/base.py`.
- **Embedding Fallback:** If the Gemini API is unavailable, the embedding service falls back to `all-MiniLM-L6-v2` (384 dims). Note that mixing embedding models between ingestion and query time will cause dimension mismatch errors — re-process documents if switching models.

## License

MIT
