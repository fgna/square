#!/usr/bin/env bash
# Disposable local-only Prisma migration smoke for the generic task attempts.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container="square-task-attempts-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# Install local workspace binaries if this checkout has not been bootstrapped.
# Prisma is a project devDependency and is intentionally not installed globally.
if [[ ! -x "$root/apps/api/node_modules/.bin/prisma" ]]; then
  echo "Local Prisma CLI missing; installing lockfile-pinned workspace dependencies."
  (cd "$root" && bash scripts/dev-pnpm.sh install --frozen-lockfile)
fi
[[ -x "$root/apps/api/node_modules/.bin/prisma" ]] || {
  echo "Prisma CLI still unavailable after dependency install" >&2
  exit 1
}
command -v docker >/dev/null || { echo "Docker is required" >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker daemon is unavailable" >&2; exit 1; }

# No mounts, named volumes, existing ports, or shared database credentials.
docker run --rm -d --name "$container" -e POSTGRES_USER=square_test \
  -e POSTGRES_PASSWORD=square_test -e POSTGRES_DB=square_test \
  -p 127.0.0.1::5432 postgres:16-alpine >/dev/null
for i in $(seq 1 60); do
  if docker exec "$container" pg_isready -U square_test -d square_test >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$container" pg_isready -U square_test -d square_test >/dev/null
port="$(docker port "$container" 5432/tcp | sed -n 's/.*://p' | head -1)"
[[ "$port" =~ ^[0-9]+$ ]] || { echo "Could not resolve ephemeral port" >&2; exit 1; }
export DATABASE_URL="postgresql://square_test:square_test@127.0.0.1:${port}/square_test?schema=public"

cd "$root"
bash scripts/dev-pnpm.sh --filter @community/core-api exec prisma migrate deploy
# Ensure the new table, member foreign key and idempotency constraint exist.
docker exec "$container" psql -U square_test -d square_test -v ON_ERROR_STOP=1 -Atc \
  'SELECT (to_regclass('"'"'public."TaskAttempt"'"'"') IS NOT NULL)
          AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '"'"'TaskAttempt_userId_fkey'"'"')
          AND EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = '"'"'TaskAttempt_userId_idempotencyKey_key'"'"');' \
  | grep -qx t
echo "PASS: disposable PostgreSQL migration and TaskAttempt constraints"
