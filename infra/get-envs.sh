#!/usr/bin/env bash
# ── get-envs.sh ─────────────────────────────────────────────────────
# Pulls secrets/endpoints from Azure and writes .env files for local dev.
#
# Usage:
#   chmod +x infra/get-envs.sh
#   ./infra/get-envs.sh
#
# Prerequisites: az login (with access to both RGs)
# ────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────
SHARED_RG="rg-shared-services"
POC_RG="rg-procurement-agent-poc"
AI_SERVICES_NAME="aifoundrysharedservices00001"
KEY_VAULT_NAME="kv-shared-services-00001"
SEARCH_NAME="search-procurement-poc01"
CHAT_DEPLOYMENT="gpt-4.1"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AI_SERVICE_ENV="$PROJECT_ROOT/backend/ai-service/.env"
MCP_SERVER_ENV="$PROJECT_ROOT/backend/mcp-server/.env"

echo "==> Fetching Azure credentials..."

# Azure OpenAI endpoint
AZURE_OPENAI_ENDPOINT=$(az cognitiveservices account show \
  --name "$AI_SERVICES_NAME" \
  --resource-group "$SHARED_RG" \
  --query "properties.endpoint" -o tsv)

# Azure OpenAI key (from Key Vault if secret exists, else direct)
AZURE_OPENAI_API_KEY=$(az keyvault secret show \
  --vault-name "$KEY_VAULT_NAME" \
  --name "procurement-ai-services-key" \
  --query "value" -o tsv 2>/dev/null) || \
AZURE_OPENAI_API_KEY=$(az cognitiveservices account keys list \
  --name "$AI_SERVICES_NAME" \
  --resource-group "$SHARED_RG" \
  --query "key1" -o tsv)

# AI Search (optional — may not exist yet)
AZURE_SEARCH_ENDPOINT=""
AZURE_SEARCH_API_KEY=""
if az search service show --name "$SEARCH_NAME" --resource-group "$POC_RG" &>/dev/null; then
  AZURE_SEARCH_ENDPOINT="https://${SEARCH_NAME}.search.windows.net"
  AZURE_SEARCH_API_KEY=$(az keyvault secret show \
    --vault-name "$KEY_VAULT_NAME" \
    --name "procurement-search-key" \
    --query "value" -o tsv 2>/dev/null) || \
  AZURE_SEARCH_API_KEY=$(az search admin-key show \
    --service-name "$SEARCH_NAME" \
    --resource-group "$POC_RG" \
    --query "primaryKey" -o tsv 2>/dev/null) || \
  AZURE_SEARCH_API_KEY=""
fi

# ── Write ai-service .env ──────────────────────────────────────────
cat > "$AI_SERVICE_ENV" <<EOF
# Azure OpenAI — auto-loaded by AzureOpenAIChatClient
AZURE_OPENAI_ENDPOINT=$AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_CHAT_DEPLOYMENT_NAME=$CHAT_DEPLOYMENT
AZURE_OPENAI_API_KEY=$AZURE_OPENAI_API_KEY

# Azure AI Search (for Contract Auditor RAG)
AZURE_SEARCH_ENDPOINT=$AZURE_SEARCH_ENDPOINT
AZURE_SEARCH_INDEX=contracts
AZURE_SEARCH_API_KEY=$AZURE_SEARCH_API_KEY
EOF

echo "==> Wrote $AI_SERVICE_ENV"

# ── Write mcp-server .env ──────────────────────────────────────────
cat > "$MCP_SERVER_ENV" <<EOF
# MCP Server Port
MCP_SERVER_PORT=8081
EOF

echo "==> Wrote $MCP_SERVER_ENV"

echo "==> Done. Review .env files before running the app."
