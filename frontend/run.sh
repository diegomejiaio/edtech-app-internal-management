#!/usr/bin/env bash
#
# Espacio Pro — frontend local launcher.
# Kills any process on :3000, cleans .next cache, and starts next dev.
#
# Usage:
#   ./run.sh             # clean + dev
#   ./run.sh --no-clean  # skip .next cache removal (faster on warm runs)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-3000}"

red()    { printf "\033[31m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
blue()   { printf "\033[34m%s\033[0m\n" "$*"; }

# 1. Tooling checks
blue "▶ Checking prerequisites…"
if ! command -v node >/dev/null 2>&1; then
  red "✗ Node.js not found. Install Node 20+: https://nodejs.org"
  exit 1
fi
NODE_VERSION="$(node --version 2>/dev/null || echo unknown)"
green "  ✓ node $NODE_VERSION"

if ! command -v pnpm >/dev/null 2>&1; then
  red "✗ pnpm not found. Install: npm i -g pnpm"
  exit 1
fi
PNPM_VERSION="$(pnpm --version 2>/dev/null || echo unknown)"
green "  ✓ pnpm $PNPM_VERSION"

# 2. Config check
if [ ! -f "$SCRIPT_DIR/.env.local" ]; then
  yellow "▶ .env.local missing — copying from example…"
  cp "$SCRIPT_DIR/.env.local.example" "$SCRIPT_DIR/.env.local"
  red   "✗ Edit $SCRIPT_DIR/.env.local and fill in NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, then re-run."
  exit 1
fi
green "  ✓ .env.local present"

if ! grep -q 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_' "$SCRIPT_DIR/.env.local" 2>/dev/null; then
  yellow "  ⚠ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY may not be set in .env.local"
fi

# 3. Kill existing process on port
if lsof -ti:"$PORT" >/dev/null 2>&1; then
  yellow "▶ Port $PORT already in use — killing existing process…"
  lsof -ti:"$PORT" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# 4. Install dependencies (if needed)
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  blue "▶ pnpm install"
  (cd "$SCRIPT_DIR" && pnpm install --frozen-lockfile)
fi

# 5. Clean .next cache (skippable)
if [ "${1:-}" != "--no-clean" ]; then
  if [ -d "$SCRIPT_DIR/.next" ]; then
    blue "▶ Cleaning .next cache…"
    rm -rf "$SCRIPT_DIR/.next"
  fi
fi

# 6. Launch
blue "▶ Starting Next.js dev server on http://localhost:$PORT"
green "  App:    http://localhost:$PORT"
green "  API at: ${NEXT_PUBLIC_API_URL:-http://localhost:7071}"
echo
cd "$SCRIPT_DIR"
exec pnpm dev --port "$PORT"
