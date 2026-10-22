#!/usr/bin/env bash
# Provision the default administrator for the isolated Core demo without
# starting/stopping services, changing schema, or touching other instances.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE="$ROOT/.local-community"
ENVFILE="$STATE/demo.env"
if [[ ! -r "$ENVFILE" ]]; then
  echo "Legacy demo detected: using the existing isolated PostgreSQL container."
  exec bash "$ROOT/scripts/dev-instance-admin-legacy.sh"
fi
[[ -d "$ROOT/apps/api/node_modules" || -d "$ROOT/node_modules" ]] || {
  echo "Dependencies missing: install the versioned workspace first" >&2; exit 1;
}
export DATABASE_URL=""
# This file is created by scripts/dev-instance-up.sh with hex-only random values.
set -a
source "$ENVFILE"
set +a
: "${DEMO_DB_PASSWORD:?Missing demo database password}"
export DATABASE_URL="postgresql://demo:${DEMO_DB_PASSWORD}@127.0.0.1:5439/community_core_demo?schema=local_demo"
export NODE_ENV=development
cd "$ROOT/apps/api"
node scripts/bootstrap-demo-admin.cjs
echo "Admin login: https://${COMMUNITY_LAN_IP:-192.168.1.121}:4443/login"
echo "Credentials, if newly provisioned: $STATE/admin-credentials.txt"
