#!/usr/bin/env bash
# Repository-owned pnpm entrypoint. Works in non-interactive shells where NVM
# is installed but not loaded; never installs or changes global Node versions.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_VERSION="$(tr -d '[:space:]' < "$ROOT/.nvmrc")"
has_node() {
  command -v node >/dev/null 2>&1 &&
    [[ "$(node -p 'process.versions.node.split(".")[0]')" == "$NODE_VERSION" ]]
}
if ! has_node || ! command -v corepack >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    echo "Node $NODE_VERSION and Corepack not found. Install/use Node $NODE_VERSION via NVM." >&2
    exit 1
  fi
  # shellcheck disable=SC1091
  source "$NVM_DIR/nvm.sh"
  nvm use "$NODE_VERSION" >/dev/null
fi
has_node || { echo "Required Node $NODE_VERSION is unavailable" >&2; exit 1; }
command -v corepack >/dev/null 2>&1 || { echo "Corepack unavailable in selected Node installation" >&2; exit 1; }
cd "$ROOT"
exec corepack pnpm "$@"
