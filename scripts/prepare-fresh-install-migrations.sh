#!/usr/bin/env bash
# Build a separate Prisma migration history for EMPTY disposable installations.
# Never connects to a database or edits the inherited historical migration chain.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${1:?Usage: bash scripts/prepare-fresh-install-migrations.sh /path/to/baseline-candidate [output-dir]}"
OUT="${2:-$ROOT/.local-community/fresh-install-review}"
SRC="$(realpath "$SRC")"
OUT="$(realpath -m "$OUT")"
LOCAL="$ROOT/.local-community"
case "$OUT/" in "$LOCAL/"*) ;; *) echo "FAIL: OUTPUT_MUST_BE_LOCAL_COMMUNITY" >&2; exit 2;; esac
[[ "$SRC" != "$OUT" && "$SRC/" != "$OUT/"* ]] || { echo "FAIL: OVERLAPPING_PATHS" >&2; exit 2; }
[[ ! -e "$OUT" ]] || { echo "FAIL: OUTPUT_EXISTS" >&2; exit 2; }
[[ -f "$SRC/baseline.sql" && -s "$SRC/baseline.sql" && -f "$SRC/sha256.txt" ]] || { echo "FAIL: MISSING_BASELINE" >&2; exit 2; }
SCHEMA="$ROOT/apps/api/prisma/schema.prisma"
SCHEMA_HASH="$(sha256sum "$SCHEMA" | cut -d' ' -f1)"
SQL_HASH="$(sha256sum "$SRC/baseline.sql" | cut -d' ' -f1)"
grep -Fqx "$SCHEMA_HASH  $SCHEMA" "$SRC/sha256.txt" || { echo "FAIL: SCHEMA_CHANGED" >&2; exit 2; }
grep -Fqx "$SQL_HASH  $SRC/baseline.sql" "$SRC/sha256.txt" || { echo "FAIL: SQL_CHANGED" >&2; exit 2; }
umask 077
mkdir -p "$OUT/migrations/00000000000000_fresh_install_baseline"
cp "$SCHEMA" "$OUT/schema.prisma"
cp "$SRC/baseline.sql" "$OUT/migrations/00000000000000_fresh_install_baseline/migration.sql"
printf 'provider = "postgresql"\n' > "$OUT/migrations/migration_lock.toml"
cat > "$OUT/README.txt" <<'EOF'
REVIEW-ONLY isolated Prisma schema + migration history for a NEW, EMPTY database.
Do not run against the existing demo, original community, or any migrated DB.
This is not a production upgrade path or a replacement of historical migrations.
The reviewer must supply a separate disposable PostgreSQL DATABASE_URL and
verify a real migrate deploy, subsequent status/diff, and upgrade compatibility.
Do not run prisma migrate resolve. No database was contacted by this script.
EOF
echo "PASS: isolated unapplied migration bundle prepared at $OUT"
echo "schema_sha256=$SCHEMA_HASH"
echo "sql_sha256=$SQL_HASH"
