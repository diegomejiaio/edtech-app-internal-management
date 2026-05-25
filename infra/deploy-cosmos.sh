#!/usr/bin/env bash
#
# Espacio Pro — Cosmos DB database + containers deploy launcher.
#
# Wraps `az deployment group` against infra/modules/cosmos-database.bicep,
# targeted at the resource group that holds the PRE-EXISTING Cosmos NoSQL
# account (default: rg-shared-services / shared-cosmos-nosql).
#
# Use this BEFORE the main app deploy when:
#   - the Cosmos account already exists but the espaciopro/espaciopro-dev database does not,
#   - or the deployer for main.bicep does not have control-plane access to
#     the shared-services RG.
#
# Default action is what-if (zero side effects). Pass --apply to commit.
#
# Usage:
#   ./deploy-cosmos.sh                  # what-if (preview only)
#   ./deploy-cosmos.sh --dev            # what-if for espaciopro-dev
#   ./deploy-cosmos.sh --apply          # what-if then create
#   ./deploy-cosmos.sh --apply --dev    # create espaciopro-dev
#   ./deploy-cosmos.sh --apply --yes    # create without re-confirming what-if
#   ./deploy-cosmos.sh --apply --name X # custom deployment name
#   ./deploy-cosmos.sh --help
#
# Override defaults via env:
#   ESPACIOPRO_SUBSCRIPTION_ID   (default: e3d59e44-d8a4-475a-a285-7433ca42b87f)
#   ESPACIOPRO_SHARED_RG         (default: rg-shared-services)
#   ESPACIOPRO_COSMOS_ACCOUNT    (default: shared-cosmos-nosql)
#   ESPACIOPRO_COSMOS_DB         (default: espaciopro)
#
# Pre-requisite roles on the target RG (control plane):
#   - "Cosmos DB Operator" (preferred), or
#   - "Contributor"
# Data-plane RBAC for the Function App MI is configured separately by
# modules/role-assignment-cosmos.bicep.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_FILE="$SCRIPT_DIR/modules/cosmos-database.bicep"

# Defaults match infra/main.bicepparam — keep in sync if changed there.
SUBSCRIPTION_ID="${ESPACIOPRO_SUBSCRIPTION_ID:-e3d59e44-d8a4-475a-a285-7433ca42b87f}"
SHARED_RG="${ESPACIOPRO_SHARED_RG:-rg-shared-services}"
COSMOS_ACCOUNT="${ESPACIOPRO_COSMOS_ACCOUNT:-shared-cosmos-nosql}"
COSMOS_DB="${ESPACIOPRO_COSMOS_DB:-espaciopro}"
DEFAULT_NAME_PREFIX="espaciopro-cosmos"
TARGET_ENV="prod"

# Tags — kept inline (no Key Vault, no secrets).
TAGS_JSON='{"workload":"espaciopro","env":"prod","managedBy":"bicep"}'

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
    --dev)           COSMOS_DB="espaciopro-dev"; TARGET_ENV="dev"; DEFAULT_NAME_PREFIX="espaciopro-cosmos-dev"; shift ;;
    --yes|-y)        SKIP_WHATIF=true; shift ;;
    --name)          DEPLOYMENT_NAME="${2:-}"; shift 2 ;;
    --help|-h)       usage; exit 0 ;;
    *)               red "✗ Unknown flag: $1"; usage; exit 2 ;;
  esac
done

if [[ "$TARGET_ENV" == "dev" ]]; then
  TAGS_JSON='{"workload":"espaciopro","env":"dev","managedBy":"bicep"}'
fi

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
green "  ✓ template present"

# ----- select subscription ----------------------------------------------------

CURRENT_SUB="$(az account show --query id -o tsv)"
if [[ "$CURRENT_SUB" != "$SUBSCRIPTION_ID" ]]; then
  yellow "▶ Switching subscription: $CURRENT_SUB → $SUBSCRIPTION_ID"
  az account set --subscription "$SUBSCRIPTION_ID"
fi
green "  ✓ subscription   $SUBSCRIPTION_ID"
green "  ✓ resource group $SHARED_RG"
green "  ✓ cosmos account $COSMOS_ACCOUNT"
green "  ✓ database name  $COSMOS_DB"
green "  ✓ deployment     $DEPLOYMENT_NAME"
echo

# ----- verify target RG + Cosmos account exist --------------------------------

if ! az group show --name "$SHARED_RG" >/dev/null 2>&1; then
  red "✗ Resource group not found or not accessible: $SHARED_RG"
  red "  Verify the name and that your identity has at least Reader on it."
  exit 1
fi

if ! az cosmosdb show --name "$COSMOS_ACCOUNT" --resource-group "$SHARED_RG" >/dev/null 2>&1; then
  red "✗ Cosmos account not found: $COSMOS_ACCOUNT in $SHARED_RG"
  red "  This script does NOT create the account — it only deploys DB + containers."
  exit 1
fi
green "  ✓ shared Cosmos account reachable"
echo

# ----- transpile (lint) -------------------------------------------------------

blue "▶ Linting Bicep (az bicep build)…"
az bicep build --file "$TEMPLATE_FILE" --stdout >/dev/null
green "  ✓ template compiles"
echo

# ----- what-if ----------------------------------------------------------------

if [[ "$SKIP_WHATIF" != "true" ]]; then
  blue "▶ Running what-if preview (no changes applied)…"
  az deployment group what-if \
    --resource-group "$SHARED_RG" \
    --template-file "$TEMPLATE_FILE" \
    --parameters \
        cosmosAccountName="$COSMOS_ACCOUNT" \
        databaseName="$COSMOS_DB" \
        tags="$TAGS_JSON" \
    --name "$DEPLOYMENT_NAME"
  echo
fi

# ----- apply ------------------------------------------------------------------

if [[ "$APPLY" != "true" ]]; then
  yellow "▶ Preview only. Re-run with --apply to commit:"
  yellow "    ./deploy-cosmos.sh --apply"
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
az deployment group create \
  --resource-group "$SHARED_RG" \
  --template-file "$TEMPLATE_FILE" \
  --parameters \
      cosmosAccountName="$COSMOS_ACCOUNT" \
      databaseName="$COSMOS_DB" \
      tags="$TAGS_JSON" \
  --name "$DEPLOYMENT_NAME" \
  --output none

green "  ✓ deployment succeeded"
echo

# ----- print outputs ----------------------------------------------------------

blue "▶ Deployment outputs:"
az deployment group show \
  --resource-group "$SHARED_RG" \
  --name "$DEPLOYMENT_NAME" \
  --query properties.outputs \
  --output jsonc

echo
blue "▶ Verifying containers in account…"
az cosmosdb sql container list \
  --account-name "$COSMOS_ACCOUNT" \
  --resource-group "$SHARED_RG" \
  --database-name "$COSMOS_DB" \
  --query "[].{name:name, pk:resource.partitionKey.paths[0]}" \
  --output table

echo
green "▶ Done. Next steps:"
if [[ "$TARGET_ENV" == "dev" ]]; then
  green "    1. Point local.settings.json to COSMOS_DATABASE_NAME=$COSMOS_DB"
  green "    2. Seed dev data with the backend seeder before running E2E tests."
else
  green "    1. Run the main app deploy:    ./deploy.sh --apply"
  green "    2. Grant the Function App MI 'Cosmos DB Built-in Data Contributor'"
  green "       on $COSMOS_ACCOUNT (data plane). See modules/role-assignment-cosmos.bicep."
fi
