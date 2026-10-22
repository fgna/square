#!/usr/bin/env bash
# Read-only smoke for an ALREADY RUNNING, explicitly selected isolated Core.
# No Docker actions, DB migrations, file writes, login, or secret reads.
set -euo pipefail
usage() {
  echo "Usage: bash scripts/check-running-instance.sh http://127.0.0.1:API_PORT http://127.0.0.1:WEB_PORT" >&2
  exit 2
}
[[ $# -eq 2 ]] || usage
command -v curl >/dev/null || { echo "FAIL: CURL_UNAVAILABLE" >&2; exit 1; }
command -v node >/dev/null || { echo "FAIL: NODE_UNAVAILABLE" >&2; exit 1; }
for value in "$1" "$2"; do
  # Accept localhost only; prohibit remote hosts, credentials, URL paths,
  # queries and hostnames resolving unpredictably through DNS.
  [[ "$value" =~ ^http://(127\.0\.0\.1|localhost):([0-9]{2,5})$ ]] || usage
  port="${BASH_REMATCH[2]}"
  (( 10#$port > 0 && 10#$port <= 65535 )) || usage
done
api="$1"
web="$2"
health="$(curl --noproxy '*' --fail --silent --show-error --max-time 8 --max-filesize 65536 "$api/health")" ||
  { echo 'FAIL: API_HEALTH_UNREACHABLE' >&2; exit 1; }
printf '%s' "$health" | node -e '
let raw = "";
process.stdin.on("data", b => raw += b);
process.stdin.on("end", () => {
  try {
    const x = JSON.parse(raw);
    if (x.status !== "ok" || x.services?.database !== "ok") process.exit(1);
  } catch { process.exit(1); }
});' || { echo 'FAIL: API_HEALTH_NOT_READY' >&2; exit 1; }
echo 'PASS: API healthy with database reported ready'
status="$(curl --noproxy '*' --silent --show-error --max-time 12 --output /dev/null --write-out '%{http_code}' "$web/login")" ||
  { echo 'FAIL: WEB_LOGIN_UNREACHABLE' >&2; exit 1; }
case "$status" in
  200) echo 'PASS: Web login page HTTP 200' ;;
  *) echo "FAIL: WEB_LOGIN_HTTP_$status" >&2; exit 1 ;;
esac
echo 'PASS: read-only runtime smoke; authenticated browser flows NOT verified'
