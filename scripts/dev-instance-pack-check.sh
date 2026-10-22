#!/usr/bin/env bash
# Read-only: validates caller-supplied content checkout; no private git access.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ "$#" == 1 ]] || { echo "Usage: bash scripts/dev-instance-pack-check.sh /absolute/path/to/content" >&2; exit 2; }
exec node "$ROOT/scripts/validate-instance-pack.mjs" "$1"
