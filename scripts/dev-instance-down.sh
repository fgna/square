#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE="$ROOT/.local-community"
for service in api web; do
  pidfile="$STATE/$service.pid"
  if [[ -f "$pidfile" ]]; then
    pid="$(cat "$pidfile")"
    if [[ "$pid" =~ ^[0-9]+$ ]]; then
      # Only stop processes with the workspace-specific command line.
      if ps -p "$pid" -o args= 2>/dev/null | grep -Eq '(corepack|pnpm).*(apps/(api|web)|next|nest)|node .*/apps/api/dist/.*/?main.js|node .*/apps/api/dist/main.js'; then
        pkill -TERM -P "$pid" 2>/dev/null || true
        kill "$pid" 2>/dev/null || true
      fi
    fi
    rm -f "$pidfile"
  fi
done
cd "$ROOT"
if command -v docker >/dev/null 2>&1; then
  docker compose --env-file "$STATE/demo.env" -f docker-compose.local.yml down
fi
echo "Stopped local demo. Database volume and private development secrets preserved."
