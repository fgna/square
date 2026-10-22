#!/usr/bin/env bash
# Read-only health snapshot for the isolated community demo. No secrets printed.
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
echo "=== REVISION ==="
git rev-parse --short HEAD
echo "=== NODE ==="
node --version 2>/dev/null || true
echo "=== DEMO CONTAINERS (READ ONLY) ==="
if command -v docker >/dev/null 2>&1; then
  docker ps --filter 'name=community-core-local-demo' --format '{{.Names}} {{.Status}} {{.Ports}}' 2>&1 || true
else
  echo 'docker unavailable'
fi
echo "=== PORT LISTENERS ==="
for port in 4300 4301 4443 5439 6389; do
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :$port )" | tail -n +2 | sed "s/^/port $port /"
  fi
done
echo "=== LOCAL HTTP ==="
for path in 'http://127.0.0.1:4301/health' 'http://127.0.0.1:4300/login'; do
  status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 4 "$path" 2>/dev/null)" || status='UNREACHABLE'
  echo "$path => $status"
done
echo "=== LAN HTTPS (IF CONFIGURED) ==="
if [[ -n "${COMMUNITY_LAN_IP:-}" ]]; then
  for path in login health; do
    status="$(curl -ksS -o /dev/null -w '%{http_code}' --max-time 4 "https://$COMMUNITY_LAN_IP:4443/$path" 2>/dev/null)" || status='UNREACHABLE'
    echo "https://$COMMUNITY_LAN_IP:4443/$path => $status"
  done
else
  echo 'Set COMMUNITY_LAN_IP to your LAN IPv4 to check the HTTPS URL'
fi
echo '=== LOG FILE PRESENCE (NO CONTENT) ==='
for file in .local-community/api.log .local-community/web.log; do
  [[ -f "$file" ]] && echo "$file present" || echo "$file missing"
done
echo 'Read-only check completed. Do not paste credentials or raw logs.'
