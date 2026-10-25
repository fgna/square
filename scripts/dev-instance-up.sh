#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
STATE="$ROOT/.local-community"
mkdir -p "$STATE"
chmod 700 "$STATE"
ENVFILE="$STATE/demo.env"
COMPOSE="$ROOT/docker-compose.local.yml"
fail() { echo "ERROR: $*" >&2; exit 1; }
command -v docker >/dev/null || fail "Docker is required"
docker info >/dev/null 2>&1 || fail "Docker daemon unavailable"
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 required"
# Load the version pinned by .nvmrc even in non-interactive shells.
# Do not require a manual "nvm use" before starting the versioned launcher.
NODE_VERSION="$(tr -d '[:space:]' < "$ROOT/.nvmrc")"
if ! command -v node >/dev/null 2>&1 ||
   [[ "$(node -p 'process.versions.node.split(".")[0]')" != "$NODE_VERSION" ]] ||
   ! command -v corepack >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  [[ -s "$NVM_DIR/nvm.sh" ]] || fail "Node $NODE_VERSION not available (NVM not found)"
  # shellcheck disable=SC1091
  source "$NVM_DIR/nvm.sh"
  nvm use "$NODE_VERSION" >/dev/null || fail "Node $NODE_VERSION not installed via NVM"
fi
command -v corepack >/dev/null || fail "Corepack unavailable for Node $NODE_VERSION"
[[ "$(node -p 'process.versions.node.split(".")[0]')" == "$NODE_VERSION" ]] || fail "Node $NODE_VERSION required"
command -v curl >/dev/null || fail "curl is required"
export COMMUNITY_WEB_PORT="${COMMUNITY_WEB_PORT:-4600}"
export COMMUNITY_API_PORT="${COMMUNITY_API_PORT:-4601}"
export COMMUNITY_HTTPS_PORT="${COMMUNITY_HTTPS_PORT:-4543}"
# Docker-published database ports must not collide with other local projects.
# Select ephemeral free ports unless the operator explicitly provided fixed ones.
free_port() {
  node -e 'const net=require("net");const s=net.createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'
}
export COMMUNITY_DB_PORT="${COMMUNITY_DB_PORT:-$(free_port)}"
export COMMUNITY_REDIS_PORT="${COMMUNITY_REDIS_PORT:-$(free_port)}"
# Extremely rare duplicate ephemeral choices: select another Redis port.
if [[ "$COMMUNITY_DB_PORT" == "$COMMUNITY_REDIS_PORT" ]]; then
  export COMMUNITY_REDIS_PORT="$(free_port)"
fi
for port in "$COMMUNITY_WEB_PORT" "$COMMUNITY_API_PORT" "$COMMUNITY_HTTPS_PORT" "$COMMUNITY_DB_PORT" "$COMMUNITY_REDIS_PORT"; do
  [[ "$port" =~ ^[0-9]+$ ]] && (( 10#$port >= 1024 && 10#$port <= 65535 )) || fail "Invalid development port: $port"
done
[[ "$(printf "%s\n" "$COMMUNITY_WEB_PORT" "$COMMUNITY_API_PORT" "$COMMUNITY_HTTPS_PORT" "$COMMUNITY_DB_PORT" "$COMMUNITY_REDIS_PORT" | sort -u | wc -l)" -eq 5 ]] || fail "Development ports must be distinct"
for port in "$COMMUNITY_WEB_PORT" "$COMMUNITY_API_PORT" "$COMMUNITY_HTTPS_PORT" "$COMMUNITY_DB_PORT" "$COMMUNITY_REDIS_PORT"; do
  if (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1; then
    fail "Port $port is occupied. Will not interfere with other applications."
  fi
done
if [[ ! -f "$ENVFILE" ]]; then
  umask 077
  pass="$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("hex"))')"
  jwt="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
  refresh="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
  {
    printf 'DEMO_DB_PASSWORD=%s\n' "$pass"
    printf 'JWT_SECRET=%s\nJWT_REFRESH_SECRET=%s\n' "$jwt" "$refresh"
  } > "$ENVFILE"
fi
chmod 600 "$ENVFILE"
set -a
# Generated values are hex-only; source exclusively our private generated file.
source "$ENVFILE"
set +a
export DATABASE_URL="postgresql://demo:${DEMO_DB_PASSWORD}@127.0.0.1:${COMMUNITY_DB_PORT}/community_core_demo?schema=local_demo"
export REDIS_URL="redis://127.0.0.1:${COMMUNITY_REDIS_PORT}"
LAN_IP="${COMMUNITY_LAN_IP:-192.168.1.121}"
[[ "$LAN_IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || fail "COMMUNITY_LAN_IP must be an IPv4 address"
if ! ip -4 -o addr show 2>/dev/null | grep -Fq "inet $LAN_IP/"; then
  fail "LAN address $LAN_IP is not assigned to this host. Set COMMUNITY_LAN_IP to its local IPv4 address."
fi
export API_PORT="$COMMUNITY_API_PORT"
export PORT="$COMMUNITY_WEB_PORT"
export HOSTNAME=127.0.0.1
export API_HOST=127.0.0.1
export COMMUNITY_LAN_IP="$LAN_IP"
export NODE_ENV=development
export CORS_ORIGINS="https://$LAN_IP:$COMMUNITY_HTTPS_PORT,http://127.0.0.1:$COMMUNITY_WEB_PORT"
export NEXT_PUBLIC_API_URL="https://$LAN_IP:$COMMUNITY_HTTPS_PORT"
export API_INTERNAL_URL="http://127.0.0.1:$COMMUNITY_API_PORT"
export NEXT_PUBLIC_APP_URL="https://$LAN_IP:$COMMUNITY_HTTPS_PORT"
export COMMUNITY_CONTENT_DIR="$ROOT/examples/neutral-method-pack"
# Explicitly expose an APK only when a developer generated it for this isolated instance.
if [[ -s "$ROOT/apps/web/debug-apk/community.apk" ]]; then
  export COMMUNITY_TEST_INSTANCE=true
  export COMMUNITY_ENABLE_DEBUG_APK_DOWNLOAD=true
  export COMMUNITY_DEBUG_APK_PATH="$ROOT/apps/web/debug-apk/community.apk"
fi
echo "Installing workspace dependencies (frozen lockfile)..."
corepack pnpm install --frozen-lockfile
echo "Starting or reusing only this demo’s namespaced PostgreSQL + Redis..."
docker compose --env-file "$ENVFILE" -f "$COMPOSE" up -d --wait postgres redis
echo "Generating client and applying schema to dedicated demo database..."
corepack pnpm --dir apps/api exec prisma generate
# Development-only isolated schema. Historical migrations currently contain an
# ordering error (CourseNote backfill uses Post.type before it exists).
# Never run db push against a production or existing customer schema.
echo "Applying current Prisma schema to disposable local_demo namespace..."
corepack pnpm --dir apps/api exec prisma db push
echo "Ensuring one default administrator for this isolated local demo..."
corepack pnpm --dir apps/api exec node scripts/bootstrap-demo-admin.cjs
echo "Building API for a deterministic Node entrypoint..."
# Nest deletes dist on each build; stale incremental TypeScript metadata can
# incorrectly skip re-emitting main.js after the directory was deleted.
find "$ROOT/apps/api" -maxdepth 2 -name "*.tsbuildinfo" -type f -delete
corepack pnpm --dir apps/api build
API_ENTRY=""
if [[ -d "$ROOT/apps/api/dist" ]]; then
  API_ENTRY="$(find "$ROOT/apps/api/dist" -type f -name main.js -print -quit)"
fi
[[ -n "$API_ENTRY" && -f "$API_ENTRY" ]] || fail "API build produced no main.js in apps/api/dist"
echo "Starting API from $API_ENTRY and Web (logs in .local-community)..."
nohup node "$API_ENTRY" >"$STATE/api.log" 2>&1 </dev/null &
echo "$!" > "$STATE/api.pid"
nohup corepack pnpm --dir apps/web exec next dev --hostname 127.0.0.1 --port "$COMMUNITY_WEB_PORT" >"$STATE/web.log" 2>&1 </dev/null &
echo "$!" > "$STATE/web.pid"
ready=0
for i in $(seq 1 90); do
  if curl --fail --silent --max-time 2 http://127.0.0.1:$COMMUNITY_API_PORT/health | node -e 'let x="";process.stdin.on("data",b=>x+=b).on("end",()=>{try{const d=JSON.parse(x);process.exit(d.status==="ok"&&d.services?.database==="ok"?0:1)}catch{process.exit(1)}})' >/dev/null 2>&1 &&
     curl --fail --silent --output /dev/null --max-time 5 http://127.0.0.1:$COMMUNITY_WEB_PORT/login; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "$ready" != 1 ]]; then
  echo "Startup not ready. Inspect $STATE/api.log and $STATE/web.log" >&2
  exit 1
fi
# The web route can be shadowed by stale Next.js rewrites or a second
# process. Never claim that APK publication succeeded without byte equality.
if [[ -s "$ROOT/apps/web/debug-apk/community.apk" ]]; then
  expected_apk_sha="$(sha256sum "$ROOT/apps/web/debug-apk/community.apk" | cut -d' ' -f1)"
  apk_response="$(mktemp)"
  if ! curl --silent --fail --max-time 30 "http://127.0.0.1:$COMMUNITY_WEB_PORT/api/download-app" -o "$apk_response"; then
    rm -f "$apk_response"
    fail "Local APK download endpoint failed despite staged APK"
  fi
  actual_apk_sha="$(sha256sum "$apk_response" | cut -d' ' -f1)"
  rm -f "$apk_response"
  if [[ "$expected_apk_sha" != "$actual_apk_sha" ]]; then
    fail "APK download mismatch: on-disk $expected_apk_sha, served $actual_apk_sha. Check duplicate Next.js processes and route rewrites; do not publish."
  fi
  echo "APK route byte equality: PASS"
fi
echo "Starting the HTTPS proxy on https://$LAN_IP:$COMMUNITY_HTTPS_PORT..."
docker compose --env-file "$ENVFILE" -f "$COMPOSE" up -d https
[[ "$(docker compose --env-file "$ENVFILE" -f "$COMPOSE" ps --status running -q https | wc -l)" -eq 1 ]] || fail "Core HTTPS container failed; check its logs"
tls_ready=0
for i in $(seq 1 30); do
  if curl --silent --insecure --fail --max-time 4 --output /dev/null "https://$LAN_IP:$COMMUNITY_HTTPS_PORT/login" &&
     curl --silent --insecure --fail --max-time 4 "https://$LAN_IP:$COMMUNITY_HTTPS_PORT/health" | node -e 'let x="";process.stdin.on("data",b=>x+=b).on("end",()=>{try{process.exit(JSON.parse(x).services?.database==="ok"?0:1)}catch{process.exit(1)}})' >/dev/null 2>&1; then
    tls_ready=1; break
  fi
  sleep 2
done
[[ "$tls_ready" == 1 ]] || fail "HTTPS gateway not ready; inspect docker compose -f docker-compose.local.yml logs https"
if [[ -s "$ROOT/apps/web/debug-apk/community.apk" ]]; then
  served_apk="$(mktemp)"
  if ! curl --noproxy '*' --insecure --silent --fail --max-time 30 "https://$LAN_IP:$COMMUNITY_HTTPS_PORT/api/download-app" -o "$served_apk"; then
    rm -f "$served_apk"; fail "HTTPS APK download failed"
  fi
  served_sha="$(sha256sum "$served_apk" | cut -d' ' -f1)"
  rm -f "$served_apk"
  [[ "$served_sha" == "$expected_apk_sha" ]] || fail "HTTPS APK mismatch: on-disk $expected_apk_sha, served $served_sha"
  echo "HTTPS APK byte equality: PASS"
fi
echo "HTTPS gateway ready (certificate trust on clients must still be configured)."
echo "Local isolated community: http://127.0.0.1:$COMMUNITY_WEB_PORT"
echo "LAN community (other devices): https://$LAN_IP:$COMMUNITY_HTTPS_PORT"
echo "HTTPS root certificate: docker compose -f docker-compose.local.yml exec -T https cat /data/caddy/pki/authorities/local/root.crt > .local-community/local-ca.crt"
echo "Install/trust this certificate on testing Android phones only after verifying its source."
echo "WARNING: HTTPS uses a LOCAL CA (not publicly trusted). Never port-forward demo ports."
echo "API: http://127.0.0.1:$COMMUNITY_API_PORT/health"
echo "Stop: bash scripts/dev-instance-down.sh"
