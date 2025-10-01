#!/usr/bin/env bash
set -euo pipefail

# Resolve project directory relative to this script so the service
# works no matter where the repo is cloned.
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$SCRIPT_DIR"

# Ensure common pnpm install locations are on PATH and pin NODE_ENV.
export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"
export NODE_ENV=production

echo "[i] Running pnpm install..."
pnpm install --frozen-lockfile

echo "[i] Building..."
pnpm build

echo "[i] Starting..."
exec pnpm start
