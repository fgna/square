#!/usr/bin/env bash
# Generate a candidate fresh-install SQL baseline WITHOUT accessing any database.
# It does not modify historical migration directories, run migrate resolve, or deploy.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API="$ROOT/apps/api"
SCHEMA="$API/prisma/schema.prisma"
OUT="${1:-$ROOT/.local-community/baseline-candidate}"
case "$OUT" in
  /*) ;;
  *) OUT="$ROOT/$OUT" ;;
esac
OUT="$(realpath -m "$OUT")"
case "$OUT/" in
  "$ROOT/apps/api/prisma/migrations/"*|"$ROOT/apps/api/prisma/migrations/") echo "Refusing to write to historical migrations" >&2; exit 2 ;;
esac
[[ -f "$SCHEMA" ]] || { echo "Schema not found" >&2; exit 2; }
command -v corepack >/dev/null || { echo "Corepack missing: activate Node 22" >&2; exit 2; }
[[ "$(node -p 'process.versions.node.split(".")[0]')" == 22 ]] || { echo "Node 22 required" >&2; exit 2; }
[[ ! -e "$OUT" ]] || { echo "Output path exists; refusing overwrite: $OUT" >&2; exit 2; }
umask 077
mkdir -p "$OUT"
corepack pnpm --dir "$API" exec prisma migrate diff \
  --from-empty --to-schema-datamodel "$SCHEMA" --script > "$OUT/baseline.sql"
[[ -s "$OUT/baseline.sql" ]] || { echo "Generated baseline is empty" >&2; exit 1; }
sha256sum "$SCHEMA" "$OUT/baseline.sql" > "$OUT/sha256.txt"
cat > "$OUT/README.txt" <<'EOF'
Candidate from Prisma schema only; NOT APPLIED.
This is NOT a deployed Prisma migration history and is NOT production-approved.
Never copy into historical migrations or use prisma migrate resolve in an existing DB
without explicit reviewed migration history/upgrade compatibility design.
Validation requires isolated disposable PostgreSQL and an actual migrate deploy.
EOF
echo "Generated candidate: $OUT"
cat "$OUT/sha256.txt"
