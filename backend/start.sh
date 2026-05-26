#!/usr/bin/env bash
set -euo pipefail

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Starting Celery worker in background..."
celery -A config.celery worker -l info --pool=solo &
CELERY_PID=$!

echo "Starting Daphne ASGI server..."
daphne -b 0.0.0.0 -p "${PORT:-8000}" config.asgi:application &
DAPHNE_PID=$!

trap "kill $CELERY_PID $DAPHNE_PID 2>/dev/null; exit" SIGTERM SIGINT

wait -n
exit $?
