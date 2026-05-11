#!/usr/bin/env bash
#
# Espacio Pro — backend local launcher.
# Validates prerequisites and starts the Azure Functions host on :7071.
#
# Usage:
#   ./run.sh             # restore + func start
#   ./run.sh --no-restore # skip dotnet restore (faster on warm runs)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$SCRIPT_DIR/src/EspacioPro.Api"
PORT="${PORT:-7071}"

red()    { printf "\033[31m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
blue()   { printf "\033[34m%s\033[0m\n" "$*"; }

# 1. Tooling checks
blue "▶ Checking prerequisites…"
if ! command -v dotnet >/dev/null 2>&1; then
  red "✗ .NET SDK not found. Install .NET 10 SDK: https://dotnet.microsoft.com/download/dotnet/10.0"
  exit 1
fi
DOTNET_VERSION="$(dotnet --version 2>/dev/null || echo unknown)"
green "  ✓ dotnet $DOTNET_VERSION"

if ! command -v func >/dev/null 2>&1; then
  red "✗ Azure Functions Core Tools not found. Install v4:"
  red "    brew tap azure/functions && brew install azure-functions-core-tools@4"
  exit 1
fi
FUNC_VERSION="$(func --version 2>/dev/null || echo unknown)"
green "  ✓ func $FUNC_VERSION"

# 2. Config check
if [ ! -f "$API_DIR/local.settings.json" ]; then
  yellow "▶ local.settings.json missing — copying from example…"
  cp "$API_DIR/local.settings.json.example" "$API_DIR/local.settings.json"
  red   "✗ Edit $API_DIR/local.settings.json and fill in COSMOS_* and CLERK_* values, then re-run."
  red   "  (gitignored — never commit it)"
  exit 1
fi
green "  ✓ local.settings.json present"

# 3. Auth-mode hint (informational; the app validates at startup)
if grep -Eq '^[[:space:]]*"COSMOS_CONNECTION_STRING"[[:space:]]*:' "$API_DIR/local.settings.json"; then
  yellow "  • Cosmos auth: connection string (local-dev mode)"
elif command -v az >/dev/null 2>&1 && az account show >/dev/null 2>&1; then
  green  "  • Cosmos auth: Managed Identity / az login ($(az account show --query user.name -o tsv 2>/dev/null))"
else
  yellow "  • Cosmos auth: Managed Identity expected, but no az session detected."
  yellow "    Either run \`az login\` or set COSMOS_CONNECTION_STRING in local.settings.json."
fi

# 4. Port check
if lsof -ti:"$PORT" >/dev/null 2>&1; then
  yellow "▶ Port $PORT already in use — killing existing process…"
  lsof -ti:"$PORT" | xargs kill -9 2>/dev/null || true
fi

# Note: AzureWebJobsStorage is intentionally not configured. Our app is
# HTTP-triggers-only (no blob/queue/table/durable functions), so the host
# does not need a storage backend. host.json disables the health monitor
# to silence the periodic "webjobs.storage Unhealthy" warnings that the
# runtime emits even when storage is unused.

# 5. Restore (skippable)
if [ "${1:-}" != "--no-restore" ]; then
  blue "▶ dotnet restore"
  (cd "$SCRIPT_DIR" && dotnet restore)
fi

# 6. Launch
blue "▶ Starting Functions host on http://localhost:$PORT"
green "  Health: curl http://localhost:$PORT/api/v1/health"
green "  OpenAPI: curl http://localhost:$PORT/api/v1/openapi.yaml"
echo
cd "$API_DIR"
exec func start --port "$PORT"
