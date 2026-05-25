#!/usr/bin/env bash
#
# Espacio Pro — application code deploy (backend + frontend).
#
# Publishes the .NET backend to Azure Function App (Flex Consumption OneDeploy)
# and the Next.js static export to Azure Static Web App.
#
# Idempotent — safe to re-run. Default action is dry-run (prints what it would
# do). Pass --apply to actually deploy.
#
# Usage:
#   ./deploy-app.sh                       # dry-run (preview only)
#   ./deploy-app.sh --apply               # build + deploy both
#   ./deploy-app.sh --apply --backend     # backend only
#   ./deploy-app.sh --apply --frontend    # frontend only
#   ./deploy-app.sh --apply --skip-build  # deploy from previous build artifacts
#   ./deploy-app.sh --help
#
# Prerequisites:
#   - az login (logged in)
#   - infra deployed (./deploy.sh --apply)
#   - dotnet SDK 10+
#   - pnpm, node 20+
#   - SWA CLI: npm i -g @azure/static-web-apps-cli
#
# Override defaults via env:
#   ESPACIOPRO_SUBSCRIPTION_ID, ESPACIOPRO_RG, ESPACIOPRO_FUNC_NAME,
#   ESPACIOPRO_SWA_NAME

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
BACKEND_API_DIR="$BACKEND_DIR/src/EspacioPro.Api"
FRONTEND_DIR="$REPO_ROOT/frontend"

# Defaults match Bicep naming convention:
#   func-{workload}-{env}-{regionCode}
#   stapp-{workload}-{env}-{regionCode}
SUBSCRIPTION_ID="${ESPACIOPRO_SUBSCRIPTION_ID:-e3d59e44-d8a4-475a-a285-7433ca42b87f}"
RG="${ESPACIOPRO_RG:-rg-espaciopro-prod}"
FUNC_NAME="${ESPACIOPRO_FUNC_NAME:-func-espaciopro-prod-eus2}"
SWA_NAME="${ESPACIOPRO_SWA_NAME:-stapp-espaciopro-prod-eus2}"
DEPLOYMENT_PREFIX="${ESPACIOPRO_DEPLOYMENT_PREFIX:-espaciopro-prod}"

# Temp dirs (cleaned up on exit)
PUBLISH_DIR="$BACKEND_DIR/.publish"
ZIP_PATH="$BACKEND_DIR/.publish.zip"

red()    { printf "\033[31m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
blue()   { printf "\033[34m%s\033[0m\n" "$*"; }
bold()   { printf "\033[1m%s\033[0m\n" "$*"; }

usage() {
  awk 'NR>1 && /^[^#]/ { exit } NR>1 { sub(/^# ?/, ""); print }' "${BASH_SOURCE[0]}"
}

cleanup() {
  rm -rf "$PUBLISH_DIR" "$ZIP_PATH" 2>/dev/null || true
}
trap cleanup EXIT

latest_deployment_output() {
  local key="$1"

  az deployment sub list \
    --query "[?starts_with(name, '${DEPLOYMENT_PREFIX}-') && properties.provisioningState=='Succeeded'] | sort_by(@, &properties.timestamp) | [-1].properties.outputs.${key}.value" \
    -o tsv 2>/dev/null || true
}

resolve_function_hostname() {
  local expected_prefix hostname
  expected_prefix="$FUNC_NAME."

  hostname="$(az functionapp show --name "$FUNC_NAME" --resource-group "$RG" \
    --query defaultHostName -o tsv 2>/dev/null || true)"

  if [[ -n "$hostname" ]]; then
    printf '%s\n' "$hostname"
    return 0
  fi

  hostname="$(az functionapp show --name "$FUNC_NAME" --resource-group "$RG" \
    --query "hostNames[0]" -o tsv 2>/dev/null || true)"

  if [[ -n "$hostname" ]]; then
    printf '%s\n' "$hostname"
    return 0
  fi

  hostname="$(latest_deployment_output functionAppHostname)"

  if [[ -n "$hostname" && "${hostname#"$expected_prefix"}" == "$hostname" ]]; then
    yellow "  ⚠ Ignoring deployment output functionAppHostname=$hostname (does not match $FUNC_NAME)" >&2
    return 0
  fi

  printf '%s\n' "$hostname"
}

resolve_swa_hostname() {
  local hostname

  hostname="$(az staticwebapp show --name "$SWA_NAME" --resource-group "$RG" \
    --query defaultHostname -o tsv 2>/dev/null || true)"

  if [[ -n "$hostname" ]]; then
    printf '%s\n' "$hostname"
    return 0
  fi

  latest_deployment_output swaHostname
}

# ----- arg parsing ------------------------------------------------------------

APPLY=false
DEPLOY_BACKEND=true
DEPLOY_FRONTEND=true
SKIP_BUILD=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)         APPLY=true; shift ;;
    --backend)       DEPLOY_FRONTEND=false; shift ;;
    --frontend)      DEPLOY_BACKEND=false; shift ;;
    --skip-build)    SKIP_BUILD=true; shift ;;
    --help|-h)       usage; exit 0 ;;
    *)               red "✗ Unknown flag: $1"; usage; exit 2 ;;
  esac
done

# ----- prerequisite checks ----------------------------------------------------

blue "▶ Checking prerequisites…"

if ! command -v az >/dev/null 2>&1; then
  red "✗ Azure CLI not found."
  exit 1
fi
green "  ✓ az $(az version --query '"azure-cli"' -o tsv 2>/dev/null || echo '?')"

if ! az account show >/dev/null 2>&1; then
  red "✗ Not logged into Azure. Run: az login"
  exit 1
fi
ACCOUNT_NAME="$(az account show --query user.name -o tsv 2>/dev/null)"
green "  ✓ logged in as $ACCOUNT_NAME"

if [[ "$DEPLOY_BACKEND" == "true" ]]; then
  if ! command -v dotnet >/dev/null 2>&1; then
    red "✗ .NET SDK not found."
    exit 1
  fi
  green "  ✓ dotnet $(dotnet --version 2>/dev/null || echo '?')"
fi

if [[ "$DEPLOY_FRONTEND" == "true" ]]; then
  if ! command -v node >/dev/null 2>&1; then
    red "✗ Node.js not found."
    exit 1
  fi
  green "  ✓ node $(node --version 2>/dev/null || echo '?')"

  if ! command -v pnpm >/dev/null 2>&1; then
    red "✗ pnpm not found."
    exit 1
  fi
  green "  ✓ pnpm $(pnpm --version 2>/dev/null || echo '?')"

  if ! command -v swa >/dev/null 2>&1; then
    red "✗ SWA CLI not found. Install: npm i -g @azure/static-web-apps-cli"
    exit 1
  fi
  green "  ✓ swa $(swa --version 2>/dev/null || echo '?')"
fi

# ----- select subscription ----------------------------------------------------

CURRENT_SUB="$(az account show --query id -o tsv)"
if [[ "$CURRENT_SUB" != "$SUBSCRIPTION_ID" ]]; then
  yellow "▶ Switching subscription: $CURRENT_SUB → $SUBSCRIPTION_ID"
  az account set --subscription "$SUBSCRIPTION_ID"
fi

# ----- verify resources exist -------------------------------------------------

blue "▶ Verifying Azure resources…"

if ! az group show --name "$RG" >/dev/null 2>&1; then
  red "✗ Resource group not found: $RG"
  red "  Run ./deploy.sh --apply first."
  exit 1
fi
green "  ✓ resource group $RG"

if [[ "$DEPLOY_BACKEND" == "true" || "$DEPLOY_FRONTEND" == "true" ]]; then
  if ! az functionapp show --name "$FUNC_NAME" --resource-group "$RG" >/dev/null 2>&1; then
    red "✗ Function App not found: $FUNC_NAME in $RG"
    red "  Run ./deploy.sh --apply first."
    exit 1
  fi
  FUNC_HOSTNAME="$(resolve_function_hostname)"
  if [[ -z "$FUNC_HOSTNAME" ]]; then
    red "✗ Could not resolve Function App hostname for $FUNC_NAME."
    red "  Re-run infra deploy or inspect latest deployment outputs:"
    red "    az deployment sub show --name <deployment-name> --query properties.outputs.functionAppHostname.value -o tsv"
    exit 1
  fi
  green "  ✓ Function App: $FUNC_NAME ($FUNC_HOSTNAME)"
fi

if [[ "$DEPLOY_FRONTEND" == "true" ]]; then
  if ! az staticwebapp show --name "$SWA_NAME" --resource-group "$RG" >/dev/null 2>&1; then
    red "✗ Static Web App not found: $SWA_NAME in $RG"
    red "  Run ./deploy.sh --apply first."
    exit 1
  fi
  SWA_HOSTNAME="$(resolve_swa_hostname)"
  if [[ -z "$SWA_HOSTNAME" ]]; then
    red "✗ Could not resolve Static Web App hostname for $SWA_NAME."
    red "  Re-run infra deploy or inspect latest deployment outputs:"
    red "    az deployment sub show --name <deployment-name> --query properties.outputs.swaHostname.value -o tsv"
    exit 1
  fi
  green "  ✓ Static Web App: $SWA_NAME ($SWA_HOSTNAME)"
fi
echo

# ----- dry-run summary --------------------------------------------------------

bold "===================================================================="
bold " Deploy plan"
bold "===================================================================="
echo
if [[ "$DEPLOY_BACKEND" == "true" ]]; then
  echo "  Backend:  dotnet publish → OneDeploy zip → $FUNC_NAME"
  echo "            Health probe:  https://$FUNC_HOSTNAME/api/v1/health"
fi
if [[ "$DEPLOY_FRONTEND" == "true" ]]; then
  echo "  Frontend: pnpm build (static export) → swa deploy → $SWA_NAME"
  echo "            URL:           https://$SWA_HOSTNAME"
  echo "            API URL:       https://$FUNC_HOSTNAME"
fi
if [[ "$SKIP_BUILD" == "true" ]]; then
  yellow "  ⚠ --skip-build: using previous build artifacts"
fi
echo

if [[ "$APPLY" != "true" ]]; then
  yellow "▶ Dry-run only. Re-run with --apply to deploy:"
  yellow "    ./deploy-app.sh --apply"
  exit 0
fi

# ==============================================================================
# BACKEND DEPLOY
# ==============================================================================

if [[ "$DEPLOY_BACKEND" == "true" ]]; then
  blue "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  blue " BACKEND: Building + deploying .NET to $FUNC_NAME"
  blue "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [[ "$SKIP_BUILD" != "true" ]]; then
    blue "▶ dotnet publish (Release)…"
    rm -rf "$PUBLISH_DIR"
    dotnet publish "$BACKEND_API_DIR/EspacioPro.Api.csproj" \
      -c Release \
      -o "$PUBLISH_DIR" \
      --nologo \
      -v quiet
    green "  ✓ published to $PUBLISH_DIR"

    blue "▶ Creating zip package…"
    rm -f "$ZIP_PATH"
    (cd "$PUBLISH_DIR" && zip -r -q "$ZIP_PATH" .)
    ZIP_SIZE="$(du -h "$ZIP_PATH" | cut -f1)"
    green "  ✓ $ZIP_PATH ($ZIP_SIZE)"
  else
    if [[ ! -f "$ZIP_PATH" ]]; then
      red "✗ --skip-build but no zip found at $ZIP_PATH"
      exit 1
    fi
    yellow "  • Reusing existing $ZIP_PATH"
  fi

  blue "▶ Deploying to Function App (OneDeploy zip)…"
  az functionapp deployment source config-zip \
    --resource-group "$RG" \
    --name "$FUNC_NAME" \
    --src "$ZIP_PATH" \
    --timeout 600 \
    --output none
  green "  ✓ Backend deployed"

  blue "▶ Waiting for Function App to restart…"
  sleep 10

  blue "▶ Health check…"
  HEALTH_URL="https://$FUNC_HOSTNAME/api/v1/health"
  HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$HEALTH_URL" || echo "000")"
  if [[ "$HTTP_CODE" == "200" ]]; then
    green "  ✓ Health OK (HTTP $HTTP_CODE)"
    curl -s "$HEALTH_URL" | head -c 200
    echo
  else
    yellow "  ⚠ Health returned HTTP $HTTP_CODE (cold start may take up to 60s)"
    yellow "    Retry manually: curl $HEALTH_URL"
  fi
  echo
fi

# ==============================================================================
# FRONTEND DEPLOY
# ==============================================================================

if [[ "$DEPLOY_FRONTEND" == "true" ]]; then
  blue "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  blue " FRONTEND: Building + deploying Next.js to $SWA_NAME"
  blue "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  API_URL="https://$FUNC_HOSTNAME"

  if [[ "$SKIP_BUILD" != "true" ]]; then
    blue "▶ Installing dependencies…"
    (cd "$FRONTEND_DIR" && pnpm install --frozen-lockfile --silent)
    green "  ✓ dependencies installed"

    blue "▶ Building Next.js static export…"
    if [[ -n "${API_URL:-}" ]]; then
      green "  • NEXT_PUBLIC_API_URL=$API_URL"
    fi

    # Inject API URL at build time (NEXT_PUBLIC_* are embedded during build).
    # This overrides .env.production without modifying the file.
    (cd "$FRONTEND_DIR" && \
      NEXT_PUBLIC_API_URL="${API_URL:-}" \
      NEXT_PUBLIC_API_VERSION="v1" \
      NEXT_PUBLIC_DEV_MODE="false" \
      pnpm build)

    if [[ ! -d "$FRONTEND_DIR/out" ]]; then
      red "✗ Build did not produce out/ directory."
      red "  Verify next.config.ts has output: 'export'."
      exit 1
    fi
    green "  ✓ static export → frontend/out/"
  else
    if [[ ! -d "$FRONTEND_DIR/out" ]]; then
      red "✗ --skip-build but no out/ directory found."
      exit 1
    fi
    yellow "  • Reusing existing frontend/out/"
  fi

  # Get SWA deployment token
  blue "▶ Retrieving SWA deployment token…"
  SWA_TOKEN="$(az staticwebapp secrets list \
    --name "$SWA_NAME" \
    --resource-group "$RG" \
    --query properties.apiKey \
    -o tsv 2>/dev/null)"

  if [[ -z "$SWA_TOKEN" ]]; then
    red "✗ Could not retrieve SWA deployment token."
    red "  Ensure you have Contributor on $SWA_NAME."
    exit 1
  fi
  green "  ✓ deployment token retrieved"

  blue "▶ Deploying to Static Web App…"
  swa deploy "$FRONTEND_DIR/out" \
    --deployment-token "$SWA_TOKEN" \
    --env production \
    2>&1 | grep -E "(Deploying|deployed|✔|error|Error)" || true
  green "  ✓ Frontend deployed"

  echo
  green "  URL: https://$SWA_HOSTNAME"
fi

# ==============================================================================
# POST-DEPLOY REMINDERS
# ==============================================================================

echo
bold "===================================================================="
bold " Deploy complete"
bold "===================================================================="

if [[ "$DEPLOY_BACKEND" == "true" ]]; then
  green "  Backend:   https://$FUNC_HOSTNAME/api/v1/health"
fi
if [[ "$DEPLOY_FRONTEND" == "true" ]]; then
  green "  Frontend:  https://$SWA_HOSTNAME"
fi
echo

yellow "▶ Post-deploy checklist:"
if [[ "$DEPLOY_FRONTEND" == "true" ]]; then
  yellow "  1. Verify CORS_ORIGINS includes the SWA hostname in Bicep params:"
  yellow "       corsOrigins = 'https://$SWA_HOSTNAME,http://localhost:3000'"
  yellow "     Then re-run: ./deploy.sh --apply"
  yellow "  2. Test end-to-end: login via Clerk → call a protected API endpoint"
  yellow "  3. If first deploy, seed catalog data in Cosmos (no script yet)"
else
  yellow "  1. Test end-to-end: login via Clerk → call a protected API endpoint"
  yellow "  2. If first deploy, seed catalog data in Cosmos (no script yet)"
fi
