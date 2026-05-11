#!/usr/bin/env bash
#
# Espacio Pro — infrastructure deploy launcher.
#
# Wraps `az deployment sub` against infra/main.bicep + main.bicepparam.
# Default action is what-if (zero side effects). Pass --apply to commit.
#
# Usage:
#   ./deploy.sh                    # what-if (preview only)
#   ./deploy.sh --apply            # what-if then create
#   ./deploy.sh --apply --yes      # create without re-confirming what-if
#   ./deploy.sh --apply --name X   # custom deployment name
#   ./deploy.sh --help
#
# Override defaults via env:
#   ESPACIOPRO_SUBSCRIPTION_ID, ESPACIOPRO_LOCATION

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_FILE="$SCRIPT_DIR/main.bicep"
PARAM_FILE="$SCRIPT_DIR/main.bicepparam"

# Defaults match infra/main.bicepparam — keep in sync if changed there.
SUBSCRIPTION_ID="${ESPACIOPRO_SUBSCRIPTION_ID:-e3d59e44-d8a4-475a-a285-7433ca42b87f}"
LOCATION="${ESPACIOPRO_LOCATION:-eastus2}"
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

APPLY=false
SKIP_WHATIF=false
DEPLOYMENT_NAME=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)         APPLY=true; shift ;;
    --yes|-y)        SKIP_WHATIF=true; shift ;;
    --name)          DEPLOYMENT_NAME="${2:-}"; shift 2 ;;
    --help|-h)       usage; exit 0 ;;
    *)               red "✗ Unknown flag: $1"; usage; exit 2 ;;
  esac
done

if [[ -z "$DEPLOYMENT_NAME" ]]; then
  DEPLOYMENT_NAME="${DEFAULT_NAME_PREFIX}-$(date +%Y%m%d-%H%M%S)"
fi

# ----- prerequisite checks ----------------------------------------------------

blue "▶ Checking prerequisites…"

if ! command -v az >/dev/null 2>&1; then
  red "✗ Azure CLI not found. Install: https://learn.microsoft.com/cli/azure/install-azure-cli"
  exit 1
fi
green "  ✓ az $(az version --query '"azure-cli"' -o tsv 2>/dev/null || echo '?')"

if ! az bicep version >/dev/null 2>&1; then
  yellow "  • Bicep extension missing — installing…"
  az bicep install >/dev/null
fi
green "  ✓ bicep $(az bicep version 2>/dev/null | awk '{print $NF}' | head -1 || echo '?')"

if ! az account show >/dev/null 2>&1; then
  red "✗ Not logged into Azure. Run: az login"
  exit 1
fi
ACCOUNT_NAME="$(az account show --query user.name -o tsv 2>/dev/null)"
green "  ✓ logged in as $ACCOUNT_NAME"

if [[ ! -f "$TEMPLATE_FILE" ]]; then
  red "✗ Template not found: $TEMPLATE_FILE"
  exit 1
fi
if [[ ! -f "$PARAM_FILE" ]]; then
  red "✗ Param file not found: $PARAM_FILE"
  exit 1
fi
green "  ✓ template + params present"

# ----- select subscription ----------------------------------------------------

CURRENT_SUB="$(az account show --query id -o tsv)"
if [[ "$CURRENT_SUB" != "$SUBSCRIPTION_ID" ]]; then
  yellow "▶ Switching subscription: $CURRENT_SUB → $SUBSCRIPTION_ID"
  az account set --subscription "$SUBSCRIPTION_ID"
fi
green "  ✓ subscription $SUBSCRIPTION_ID"
green "  ✓ region        $LOCATION"
green "  ✓ deployment    $DEPLOYMENT_NAME"
echo

# ----- transpile (lint) -------------------------------------------------------

blue "▶ Linting Bicep (az bicep build)…"
az bicep build --file "$TEMPLATE_FILE" --stdout >/dev/null
green "  ✓ template compiles"
echo

# ----- what-if ----------------------------------------------------------------

if [[ "$SKIP_WHATIF" != "true" ]]; then
  blue "▶ Running what-if preview (no changes applied)…"
  az deployment sub what-if \
    --location "$LOCATION" \
    --template-file "$TEMPLATE_FILE" \
    --parameters "$PARAM_FILE" \
    --name "$DEPLOYMENT_NAME"
  echo
fi

# ----- apply ------------------------------------------------------------------

if [[ "$APPLY" != "true" ]]; then
  yellow "▶ Preview only. Re-run with --apply to commit:"
  yellow "    ./deploy.sh --apply"
  exit 0
fi

if [[ "$SKIP_WHATIF" != "true" ]]; then
  bold ""
  bold "▶ Apply the changes shown above?"
  read -r -p "  Type 'yes' to continue, anything else to abort: " CONFIRM
  if [[ "$CONFIRM" != "yes" ]]; then
    red "✗ Aborted by user."
    exit 1
  fi
fi

blue "▶ Creating deployment ${DEPLOYMENT_NAME}…"
az deployment sub create \
  --location "$LOCATION" \
  --template-file "$TEMPLATE_FILE" \
  --parameters "$PARAM_FILE" \
  --name "$DEPLOYMENT_NAME" \
  --output none

green "  ✓ deployment succeeded"
echo

# ----- print outputs ----------------------------------------------------------

blue "▶ Deployment outputs:"
az deployment sub show \
  --name "$DEPLOYMENT_NAME" \
  --query properties.outputs \
  --output jsonc

echo
green "▶ Done. Refresh local env vars with:"
green "    ./get-env.sh --deployment $DEPLOYMENT_NAME"
green "    ./get-env.sh --frontend   --deployment $DEPLOYMENT_NAME"
