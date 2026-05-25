#!/usr/bin/env bash
set -euo pipefail

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Starting Daphne ASGI server..."
exec daphne -b 0.0.0.0 -p "${PORT:-8000}" config.asgi:application
