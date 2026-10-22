#!/usr/bin/env bash
# Admin provisioning for a legacy Core demo lacking .local-community/demo.env.
# Uses the existing dedicated Docker PostgreSQL container, not process secrets.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
command -v docker >/dev/null || { echo "Docker required" >&2; exit 1; }
export CORE_DEMO_ROOT="$ROOT"
node "$ROOT/apps/api/scripts/bootstrap-legacy-demo-admin.cjs"
