#!/usr/bin/env bash
#
# Espacio Pro — environment variable refresh.
#
# Reads outputs from the latest (or named) Bicep subscription deployment and
# emits them as KEY=VALUE blocks for the frontend and as a reference summary
# for the backend. Optionally patches frontend/.env.local idempotently.
#
# The backend's deployed app settings live in the Function App (set by Bicep).
# Local backend dev still uses backend/src/EspacioPro.Api/local.settings.json
# with a connection-string fallback — this script does NOT overwrite that file.
#
# Usage:
#   ./get-env.sh                          # print all env vars to stdout
#   ./get-env.sh --frontend               # also patch frontend/.env.local
#   ./get-env.sh --deployment <name>      # use a specific deployment name
#   ./get-env.sh --help
#
# Override defaults via env:
#   ESPACIOPRO_SUBSCRIPTION_ID

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_ENV_FILE="$REPO_ROOT/frontend/.env.local"

SUBSCRIPTION_ID="${ESPACIOPRO_SUBSCRIPTION_ID:-e3d59e44-d8a4-475a-a285-7433ca42b87f}"
DEFAULT_NAME_PREFIX="espaciopro-prod"

red()    { printf "\033[31m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
blue()   { printf "\033[34m%s\033[0m\n" "$*"; }
bold()   { printf "\033[1m%s\033[0m\n" "$*"; }

usage() {
  awk 'NR>1 && /^[^#]/ { exit } NR>1 { sub(/^# ?/, ""); print }' "${BASH_SOURCE[0]}"
}

# ----- arg parsing ------------------------------------------------------------

PATCH_FRONTEND=false
DEPLOYMENT_NAME=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --frontend)      PATCH_FRONTEND=true; shift ;;
    --deployment)    DEPLOYMENT_NAME="${2:-}"; shift 2 ;;
    --help|-h)       usage; exit 0 ;;
    *)               red "✗ Unknown flag: $1"; usage; exit 2 ;;
  esac
done

# ----- prerequisite checks ----------------------------------------------------

if ! command -v az >/dev/null 2>&1; then
  red "✗ Azure CLI not found. Install: https://learn.microsoft.com/cli/azure/install-azure-cli"
  exit 1
fi

if ! az account show >/dev/null 2>&1; then
  red "✗ Not logged into Azure. Run: az login"
  exit 1
fi

CURRENT_SUB="$(az account show --query id -o tsv)"
if [[ "$CURRENT_SUB" != "$SUBSCRIPTION_ID" ]]; then
  yellow "▶ Switching subscription: $CURRENT_SUB → $SUBSCRIPTION_ID"
  az account set --subscription "$SUBSCRIPTION_ID"
fi

# ----- locate latest deployment if not provided -------------------------------

if [[ -z "$DEPLOYMENT_NAME" ]]; then
  blue "▶ Finding latest sub deployment matching '${DEFAULT_NAME_PREFIX}-*'…"
  DEPLOYMENT_NAME="$(
    az deployment sub list \
      --query "[?starts_with(name, '${DEFAULT_NAME_PREFIX}-')] | sort_by(@, &properties.timestamp) | [-1].name" \
      -o tsv 2>/dev/null || true
  )"
  if [[ -z "$DEPLOYMENT_NAME" ]]; then
    red "✗ No deployment found with prefix '${DEFAULT_NAME_PREFIX}-'."
    red "  Run ./deploy.sh --apply first, or pass --deployment <name>."
    exit 1
  fi
fi
green "  ✓ deployment: $DEPLOYMENT_NAME"

# ----- read outputs once ------------------------------------------------------

OUTPUTS_JSON="$(
  az deployment sub show \
    --name "$DEPLOYMENT_NAME" \
    --query properties.outputs \
    -o json 2>/dev/null
)"

if [[ -z "$OUTPUTS_JSON" || "$OUTPUTS_JSON" == "null" ]]; then
  red "✗ Deployment '$DEPLOYMENT_NAME' has no outputs (still in progress, failed, or invalid name)."
  exit 1
fi

# Tiny inline JSON reader (jq if present, otherwise python3).
read_output() {
  local key="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$OUTPUTS_JSON" | jq -r --arg k "$key" '.[$k].value // empty'
  else
    printf '%s' "$OUTPUTS_JSON" | python3 -c "
import json, sys
data = json.load(sys.stdin)
v = data.get('$key', {}).get('value', '')
print(v if v is not None else '')
"
  fi
}

FUNC_HOSTNAME="$(read_output functionAppHostname)"
SWA_HOSTNAME="$(read_output swaHostname)"
COSMOS_ENDPOINT="$(read_output cosmosAccountEndpoint)"
COSMOS_DB="$(read_output cosmosDatabaseName)"
APPI_CONN="$(read_output appInsightsConnectionString)"
STORAGE_NAME="$(read_output storageAccountName)"
FUNC_PRINCIPAL="$(read_output functionAppPrincipalId)"

if [[ -z "$FUNC_HOSTNAME" ]]; then
  red "✗ Could not read functionAppHostname from deployment outputs."
  exit 1
fi

API_URL="https://$FUNC_HOSTNAME"
SWA_URL="https://$SWA_HOSTNAME"

# ----- print structured output ------------------------------------------------

echo
bold "===================================================================="
bold " Frontend  → frontend/.env.local"
bold "===================================================================="
cat <<EOF
NEXT_PUBLIC_API_URL=$API_URL
NEXT_PUBLIC_API_VERSION=v1
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=  # set manually from Clerk dashboard
NEXT_PUBLIC_DEV_MODE=false
EOF

echo
bold "===================================================================="
bold " Backend (deployed)  → already wired by Bicep into the Function App"
bold "===================================================================="
cat <<EOF
COSMOS_ACCOUNT_ENDPOINT=$COSMOS_ENDPOINT
COSMOS_DATABASE_NAME=$COSMOS_DB
CLERK_JWKS_URL=                # see infra/main.bicepparam
CLERK_ISSUER=                  # see infra/main.bicepparam
CORS_ORIGINS=$SWA_URL,http://localhost:3000
APPLICATIONINSIGHTS_CONNECTION_STRING=$APPI_CONN
AzureWebJobsStorage__accountName=$STORAGE_NAME
AzureWebJobsStorage__credential=managedidentity
EOF

echo
bold "===================================================================="
bold " Deployed URLs"
bold "===================================================================="
green "  Function App:  $API_URL"
green "  Health probe:  curl $API_URL/api/v1/health"
green "  Static Web:    $SWA_URL"
green "  Func MI obj:   $FUNC_PRINCIPAL"
echo

# ----- optional: patch frontend/.env.local ------------------------------------

if [[ "$PATCH_FRONTEND" == "true" ]]; then
  blue "▶ Patching ${FRONTEND_ENV_FILE}…"

  if [[ ! -f "$FRONTEND_ENV_FILE" ]]; then
    yellow "  • $FRONTEND_ENV_FILE missing — creating from .env.local.example"
    cp "$REPO_ROOT/frontend/.env.local.example" "$FRONTEND_ENV_FILE"
  fi

  # Idempotent in-place update of NEXT_PUBLIC_API_URL only.
  # Preserves any user-managed keys (Clerk publishable, dev mode, etc.).
  TMP="$FRONTEND_ENV_FILE.tmp.$$"
  awk -v new="NEXT_PUBLIC_API_URL=$API_URL" '
    BEGIN { found = 0 }
    /^NEXT_PUBLIC_API_URL=/ { print new; found = 1; next }
    { print }
    END { if (!found) print new }
  ' "$FRONTEND_ENV_FILE" > "$TMP"
  mv "$TMP" "$FRONTEND_ENV_FILE"

  green "  ✓ NEXT_PUBLIC_API_URL = $API_URL"
  yellow "  • Other keys (Clerk publishable, dev mode) left untouched."
fi
