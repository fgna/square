#!/usr/bin/env bash
# Read-only HTTP smoke check against an already running ISOLATED instance.
# No database writes, credentials, migrations, or production default URLs.
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <isolated-api-base-url> <isolated-web-base-url>" >&2
  echo "Example: $0 http://127.0.0.1:4301 http://127.0.0.1:4300" >&2
  exit 2
fi
API="${1%/}"
WEB="${2%/}"

for url in "$API" "$WEB"; do
  case "$url" in
    http://127.0.0.1:*|http://localhost:*|http://\[::1\]:*) ;;
    *) echo "Refusing non-loopback URL: $url" >&2; exit 2 ;;
  esac
done
for cmd in curl node; do
  command -v "$cmd" >/dev/null || { echo "Missing $cmd" >&2; exit 2; }
done

health="$(curl --silent --show-error --fail --max-time 10 "$API/health")"
printf '%s' "$health" | node -e '
let raw="";process.stdin.on("data",b=>raw+=b);process.stdin.on("end",()=>{
  let data;try{data=JSON.parse(raw)}catch{process.exit(1)}
  if(data.status!=="ok"||data.services?.database!=="ok"||data.services?.api!=="ok"){
    console.error("API health is not healthy");process.exit(1);
  }
  console.log("API and database health: PASS");
});'
web_status="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 "$WEB/login")"
if [ "$web_status" != "200" ]; then
  echo "Web login health FAILED (HTTP $web_status)" >&2
  exit 1
fi
echo "Web /login: PASS"
echo "LOOPBACK INSTANCE HTTP SMOKE PASS"
