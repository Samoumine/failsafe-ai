#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
source .venv/scripts/activate
uvicorn api_server:app --host 0.0.0.0 --port 8001 --reload
