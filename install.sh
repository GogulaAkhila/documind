#!/usr/bin/env bash
#
# DocuMind installer (macOS / Linux). Windows users: use install.ps1 instead.
#
# What it does:
#   1. Verifies prerequisites (Python 3.10-3.12, Node 18+)
#   2. Creates the backend virtualenv and installs Python dependencies
#   3. Creates backend/.env (interactively prompting for required API keys/URLs
#      if it doesn't exist yet — never overwrites an existing .env)
#   4. Creates frontend/.env with sane localhost defaults (no secrets needed)
#   5. Runs Django migrations + initializes the pgvector store (best-effort —
#      won't abort the script if the DB isn't reachable yet)
#   6. Installs frontend npm dependencies
#
# This script only installs/updates dependencies — it does NOT start any
# services. Once it finishes, run ./run.sh to start Daphne, Celery, and Vite
# each in their own terminal window.
#
# Usage:
#   ./install.sh
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      grep '^#' "$0" | sed 's/^#//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Pretty output helpers
# ---------------------------------------------------------------------------
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; RESET='\033[0m'

info()  { echo -e "${BLUE}==>${RESET} ${BOLD}$1${RESET}"; }
ok()    { echo -e "${GREEN}✓${RESET} $1"; }
warn()  { echo -e "${YELLOW}!${RESET} $1"; }
fail()  { echo -e "${RED}✗ $1${RESET}" >&2; }

# ---------------------------------------------------------------------------
# Prerequisite checks
# ---------------------------------------------------------------------------
check_prereqs() {
  info "Checking prerequisites"

  PYTHON_BIN=""
  for candidate in python3.12 python3.11 python3.10 python3; do
    if command -v "$candidate" >/dev/null 2>&1; then
      ver="$("$candidate" -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
      case "$ver" in
        3.10|3.11|3.12) PYTHON_BIN="$candidate"; break ;;
      esac
    fi
  done
  if [ -z "$PYTHON_BIN" ]; then
    fail "Python 3.10-3.12 is required (Docling is unstable on 3.13+). Install via 'brew install python@3.12'."
    exit 1
  fi
  ok "Using $($PYTHON_BIN --version) ($PYTHON_BIN)"

  if ! command -v node >/dev/null 2>&1; then
    fail "Node.js is required (v18+). Install via 'brew install node' or nvm."
    exit 1
  fi
  ok "Using $(node --version)"

  if ! command -v npm >/dev/null 2>&1; then
    fail "npm is required but was not found alongside node."
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Backend: venv + dependencies
# ---------------------------------------------------------------------------
setup_backend_deps() {
  info "Setting up backend virtual environment"
  cd "$BACKEND_DIR"

  if [ ! -d venv ]; then
    "$PYTHON_BIN" -m venv venv
    ok "Created venv"
  else
    ok "venv already exists"
  fi

  # shellcheck disable=SC1091
  source venv/bin/activate
  pip install --upgrade pip -q
  pip install -q -r requirements.txt
  deactivate
  ok "Backend dependencies installed"
}

# ---------------------------------------------------------------------------
# Backend: .env (interactive, only if missing — never overwrites secrets)
# ---------------------------------------------------------------------------
prompt_env_var() {
  # prompt_env_var VAR_NAME "Prompt text" "default-placeholder-in-example"
  local var_name="$1" prompt_text="$2" placeholder="$3" value=""
  if [ -t 0 ]; then
    read -r -p "  $prompt_text: " value || true
  fi
  if [ -n "$value" ]; then
    # Escape characters that are special to sed's replacement string.
    local escaped
    escaped=$(printf '%s' "$value" | sed -e 's/[\/&]/\\&/g')
    sed -i.bak "s/^${var_name}=.*/${var_name}=${escaped}/" .env
    rm -f .env.bak
  else
    warn "  Left ${var_name} as a placeholder — edit backend/.env before starting services."
  fi
}

setup_backend_env() {
  info "Setting up backend/.env"
  cd "$BACKEND_DIR"

  if [ -f .env ]; then
    ok "backend/.env already exists — leaving it untouched"
    return
  fi

  cp .env.example .env

  # A real secret key doesn't need user input — generate one now.
  local secret_key
  secret_key="$(source venv/bin/activate 2>/dev/null && python -c "import secrets; print(secrets.token_urlsafe(50))" 2>/dev/null || openssl rand -base64 40)"
  local escaped_key
  escaped_key=$(printf '%s' "$secret_key" | sed -e 's/[\/&]/\\&/g')
  sed -i.bak "s/^DJANGO_SECRET_KEY=.*/DJANGO_SECRET_KEY=${escaped_key}/" .env
  rm -f .env.bak

  if [ -t 0 ]; then
    echo ""
    echo "backend/.env was created from the template. Paste your credentials now"
    echo "(press Enter to skip any of these and fill them in later):"
    echo ""
    prompt_env_var GEMINI_API_KEY   "Gemini API key (aistudio.google.com/apikey)"
    prompt_env_var JINA_API_KEY     "Jina API key (jina.ai/reranker)"
    prompt_env_var DATABASE_URL     "Supabase DATABASE_URL (postgres://...)"
    prompt_env_var SUPABASE_DB_URL  "Supabase SUPABASE_DB_URL (usually same as above)"
    prompt_env_var SUPABASE_URL     "Supabase project URL (https://<ref>.supabase.co)"
    prompt_env_var SUPABASE_KEY     "Supabase anon key"
    prompt_env_var REDIS_URL        "Redis URL (Upstash rediss://... or redis://localhost:6379/0)"
    echo ""
  else
    warn "Non-interactive shell detected — backend/.env created from template with placeholders only."
    warn "Edit backend/.env and fill in GEMINI_API_KEY, JINA_API_KEY, DATABASE_URL, SUPABASE_DB_URL, SUPABASE_URL, SUPABASE_KEY, REDIS_URL."
  fi

  ok "backend/.env ready"
}

# ---------------------------------------------------------------------------
# Backend: migrations + vector store init (best-effort)
# ---------------------------------------------------------------------------
run_migrations() {
  info "Running database migrations"
  cd "$BACKEND_DIR"
  # shellcheck disable=SC1091
  source venv/bin/activate
  unset GEMINI_API_KEY || true

  if python manage.py migrate --noinput; then
    ok "Migrations applied"
  else
    warn "Migrations failed — check DATABASE_URL/SUPABASE_DB_URL in backend/.env, then re-run this script."
    deactivate
    return
  fi

  if DJANGO_SETTINGS_MODULE=config.settings python -c "
import django
django.setup()
from core.vectorstore.pgvector_store import PgVectorStore
PgVectorStore().initialize()
" 2>/dev/null; then
    ok "pgvector store initialized"
  else
    warn "Could not initialize the pgvector store yet (will be created automatically on first document upload)."
  fi

  deactivate
}

# ---------------------------------------------------------------------------
# Frontend: .env + npm dependencies
# ---------------------------------------------------------------------------
setup_frontend() {
  info "Setting up frontend"
  cd "$FRONTEND_DIR"

  if [ ! -f .env ]; then
    cat > .env <<'EOF'
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000
EOF
    ok "Created frontend/.env with local defaults"
  else
    ok "frontend/.env already exists — leaving it untouched"
  fi

  npm install --silent
  ok "Frontend dependencies installed"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
check_prereqs
setup_backend_deps
setup_backend_env
run_migrations
setup_frontend

echo ""
ok "Setup complete."
echo ""
info "Next: run ./run.sh to start the backend, Celery worker, and frontend."
echo ""
