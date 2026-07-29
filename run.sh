#!/usr/bin/env bash
#
# DocuMind launcher (macOS / Linux). Windows users: use run.ps1 instead.
#
# Starts all three services — Daphne (backend), Celery worker, and Vite
# (frontend) — each in its own terminal window/tab so you get full native,
# color output and can Ctrl+C or close any one of them independently.
#
# On macOS this opens 3 Terminal.app windows via AppleScript. On Linux it
# tries common terminal emulators (gnome-terminal, konsole, xterm). If no
# terminal emulator can be opened (e.g. running over SSH with no display),
# it falls back to running all 3 services in the background and tailing
# their logs from backend/logs/ and frontend/logs/.
#
# Run ./install.sh first to set up the venv, .env files, and dependencies.
#
# Usage:
#   ./run.sh
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; RESET='\033[0m'

info()  { echo -e "${BLUE}==>${RESET} ${BOLD}$1${RESET}"; }
ok()    { echo -e "${GREEN}✓${RESET} $1"; }
warn()  { echo -e "${YELLOW}!${RESET} $1"; }
fail()  { echo -e "${RED}✗ $1${RESET}" >&2; }

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
# Sanity checks — make sure install.sh has been run
# ---------------------------------------------------------------------------
if [ ! -d "$BACKEND_DIR/venv" ]; then
  fail "backend/venv not found. Run ./install.sh first."
  exit 1
fi
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  fail "frontend/node_modules not found. Run ./install.sh first."
  exit 1
fi
if [ ! -f "$BACKEND_DIR/.env" ]; then
  fail "backend/.env not found. Run ./install.sh first."
  exit 1
fi

# ---------------------------------------------------------------------------
# Per-service launch scripts (written to a temp dir so we never have to
# worry about escaping quotes inside AppleScript/terminal-emulator strings)
# ---------------------------------------------------------------------------
RUN_TMP_DIR="$(mktemp -d /tmp/documind-run.XXXXXX)"

write_launch_script() {
  # write_launch_script <filename> <window-title> <body...>
  local file="$RUN_TMP_DIR/$1"
  local title="$2"
  shift 2
  {
    echo "#!/usr/bin/env bash"
    echo "printf '\\033]0;%s\\007' \"$title\""
    echo "$@"
    echo "echo"
    echo "echo 'Process exited — press Enter to close.'"
    echo "read -r"
  } > "$file"
  chmod +x "$file"
  echo "$file"
}

BACKEND_SCRIPT="$(write_launch_script backend.sh "DocuMind - Backend (Daphne :8000)" \
  "cd '$BACKEND_DIR' && source venv/bin/activate && unset GEMINI_API_KEY && daphne -b 0.0.0.0 -p 8000 config.asgi:application")"

if [ "$(uname)" = "Darwin" ]; then
  # macOS: Docling's native pypdfium2 libs crash under Celery's default
  # prefork pool, so this project always runs Celery with --pool=solo.
  CELERY_SCRIPT="$(write_launch_script celery.sh "DocuMind - Celery worker" \
    "cd '$BACKEND_DIR' && source venv/bin/activate && unset GEMINI_API_KEY && OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES celery -A config.celery worker -l info --pool=solo")"
else
  CELERY_SCRIPT="$(write_launch_script celery.sh "DocuMind - Celery worker" \
    "cd '$BACKEND_DIR' && source venv/bin/activate && unset GEMINI_API_KEY && celery -A config.celery worker -l info --pool=solo")"
fi

FRONTEND_SCRIPT="$(write_launch_script frontend.sh "DocuMind - Frontend (Vite :5173)" \
  "cd '$FRONTEND_DIR' && npm run dev")"

# ---------------------------------------------------------------------------
# Open each script in its own terminal window
# ---------------------------------------------------------------------------
open_macos_terminal() {
  local script_path="$1"
  osascript <<APPLESCRIPT >/dev/null
tell application "Terminal"
  activate
  do script "bash '$script_path'"
end tell
APPLESCRIPT
}

open_linux_terminal() {
  local script_path="$1"
  if command -v gnome-terminal >/dev/null 2>&1; then
    gnome-terminal -- bash "$script_path" &
  elif command -v konsole >/dev/null 2>&1; then
    konsole -e bash "$script_path" &
  elif command -v xterm >/dev/null 2>&1; then
    xterm -e bash "$script_path" &
  else
    return 1
  fi
}

BG_PIDS=()
run_in_background() {
  local script_path="$1" log_file="$2"
  nohup bash "$script_path" >"$log_file" 2>&1 &
  BG_PIDS+=($!)
}

info "Starting Daphne, Celery, and Vite"

if [ "$(uname)" = "Darwin" ]; then
  open_macos_terminal "$BACKEND_SCRIPT"
  sleep 1
  open_macos_terminal "$CELERY_SCRIPT"
  sleep 1
  open_macos_terminal "$FRONTEND_SCRIPT"
  ok "Opened 3 Terminal windows (backend, celery, frontend)"
elif open_linux_terminal "$BACKEND_SCRIPT" 2>/dev/null; then
  sleep 1
  open_linux_terminal "$CELERY_SCRIPT"
  sleep 1
  open_linux_terminal "$FRONTEND_SCRIPT"
  ok "Opened 3 terminal windows (backend, celery, frontend)"
else
  warn "No supported terminal emulator found — running services in the background instead."
  mkdir -p "$BACKEND_DIR/logs" "$FRONTEND_DIR/logs"
  run_in_background "$BACKEND_SCRIPT" "$BACKEND_DIR/logs/backend.log"
  run_in_background "$CELERY_SCRIPT" "$BACKEND_DIR/logs/celery.log"
  run_in_background "$FRONTEND_SCRIPT" "$FRONTEND_DIR/logs/frontend.log"
  ok "Started in background (PIDs: ${BG_PIDS[*]})"
  echo "  tail -f $BACKEND_DIR/logs/backend.log"
  echo "  tail -f $BACKEND_DIR/logs/celery.log"
  echo "  tail -f $FRONTEND_DIR/logs/frontend.log"
fi

echo ""
ok "Backend:  http://localhost:8000/api/v1/"
ok "Frontend: http://localhost:5173"
echo ""
echo "Close each terminal window (or Ctrl+C inside it) to stop that service."
echo ""
