#!/bin/bash
# ============================================================================
# PROCUREMENT AGENT POC — Build locally & Push to ACR
# ============================================================================
# Usage:
#   ./infra/build-push.sh                        # Build and push all services
#   ./infra/build-push.sh mcp-server             # Build and push a single service
#   ./infra/build-push.sh ai-service             # Build and push a single service
#   ./infra/build-push.sh frontend               # Build and push the Next.js frontend
#   ./infra/build-push.sh --deploy               # Build all + run Bicep deploy
#   ./infra/build-push.sh mcp-server --deploy    # Build mcp-server + run Bicep deploy
#
# Prerequisites:
#   - Docker Desktop running
#   - az CLI logged in (az login)
# ============================================================================

set -eo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ACR_NAME="azacrshared"
RG_SHARED="rg-shared-services"

ALL_SERVICES=(mcp-server ai-service frontend)

# ── Build-time args ────────────────────────────────────────────────────────────
# NEXT_PUBLIC_* vars are baked into the JS bundle by Next.js at build time.
# Setting them in Container Apps env vars at runtime has NO effect on the bundle.
NEXT_PUBLIC_DEV_MODE="${NEXT_PUBLIC_DEV_MODE:-true}"

# ─────────────────────────────────────────────────────────────────────────────
# Parse args — separate --deploy flag from service names
# ─────────────────────────────────────────────────────────────────────────────
RUN_DEPLOY=false
SERVICES_TO_BUILD=()

for arg in "$@"; do
  if [[ "$arg" == "--deploy" ]]; then
    RUN_DEPLOY=true
  elif [[ "$arg" == "mcp-server" || "$arg" == "ai-service" || "$arg" == "frontend" ]]; then
    SERVICES_TO_BUILD+=("$arg")
  else
    echo -e "${RED}Unknown argument: '${arg}'${NC}"
    echo "Available services: ${ALL_SERVICES[*]}"
    echo "Available flags: --deploy"
    exit 1
  fi
done

if [ "${#SERVICES_TO_BUILD[@]}" -eq 0 ]; then
  SERVICES_TO_BUILD=("${ALL_SERVICES[@]}")
fi

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Procurement Agent PoC — Local Build & Push to ACR${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Azure login check
# ─────────────────────────────────────────────────────────────────────────────
if ! az account show &>/dev/null; then
  echo -e "${YELLOW}No Azure session found. Logging in...${NC}"
  az login
fi

SUBSCRIPTION=$(az account show --query name -o tsv)
echo -e "${YELLOW}Subscription: ${SUBSCRIPTION}${NC}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Resolve ACR login server
# ─────────────────────────────────────────────────────────────────────────────
echo -e "${CYAN}Resolving ACR login server...${NC}"
ACR_LOGIN_SERVER=$(az acr show \
  --name "$ACR_NAME" \
  --resource-group "$RG_SHARED" \
  --query loginServer -o tsv)
echo -e "  ACR: ${ACR_LOGIN_SERVER}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Docker login using admin credentials
# RBAC token exchange doesn't work for external (#EXT#) accounts.
# Admin user credentials stored in ACR always work for push/pull.
# ─────────────────────────────────────────────────────────────────────────────
echo -e "${CYAN}Logging in to ACR (admin user)...${NC}"
ACR_PASS=$(az acr credential show --name "$ACR_NAME" --resource-group "$RG_SHARED" --query "passwords[0].value" -o tsv)
echo "$ACR_PASS" | docker login "$ACR_LOGIN_SERVER" \
  --username "$ACR_NAME" \
  --password-stdin
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Git SHA tag
# ─────────────────────────────────────────────────────────────────────────────
GIT_SHA=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo -e "${CYAN}Git SHA: ${GIT_SHA}${NC}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Build & push each service
#
# backend services: context = backend/, dockerfile = backend/<svc>/Dockerfile
# frontend:         context = frontend/, dockerfile = frontend/Dockerfile
# ─────────────────────────────────────────────────────────────────────────────
PUSHED_IMAGES=()
FAILED_SERVICES=()

for svc in "${SERVICES_TO_BUILD[@]}"; do
  image_name="procurement-${svc}"
  image_latest="${ACR_LOGIN_SERVER}/${image_name}:latest"
  image_sha="${ACR_LOGIN_SERVER}/${image_name}:${GIT_SHA}"

  if [[ "$svc" == "frontend" ]]; then
    build_context="${REPO_ROOT}/frontend"
    dockerfile="${build_context}/Dockerfile"
    context_label="frontend/"
    dockerfile_label="frontend/Dockerfile"
  else
    build_context="${REPO_ROOT}/backend"
    dockerfile="${build_context}/${svc}/Dockerfile"
    context_label="backend/"
    dockerfile_label="backend/${svc}/Dockerfile"
  fi

  echo -e "${BOLD}─────────────────────────────────────────────────────────────${NC}"
  echo -e "${BOLD}  Service: ${image_name}${NC}"
  echo -e "  Context:    ${context_label}"
  echo -e "  Dockerfile: ${dockerfile_label}"
  echo -e "  Tags:       :latest  :${GIT_SHA}"
  if [[ "$svc" == "frontend" ]]; then
    echo -e "  Build args: NEXT_PUBLIC_DEV_MODE=${NEXT_PUBLIC_DEV_MODE}"
  fi
  echo ""

  # Extra build args per service
  extra_build_args=()
  if [[ "$svc" == "frontend" ]]; then
    extra_build_args+=(--build-arg "NEXT_PUBLIC_DEV_MODE=${NEXT_PUBLIC_DEV_MODE}")
  fi

  if docker build \
    --platform linux/amd64 \
    --file "${dockerfile}" \
    --tag "${image_latest}" \
    --tag "${image_sha}" \
    "${extra_build_args[@]}" \
    "${build_context}" \
    && docker push "${image_latest}" \
    && docker push "${image_sha}"; then
    echo -e "${GREEN}  ✓ Pushed: ${image_latest}${NC}"
    echo -e "${GREEN}  ✓ Pushed: ${image_sha}${NC}"
    PUSHED_IMAGES+=("$image_latest")
  else
    echo -e "${RED}  ✗ FAILED: ${image_name}${NC}"
    FAILED_SERVICES+=("$svc")
  fi

  echo ""
done

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Summary${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ "${#PUSHED_IMAGES[@]}" -gt 0 ]; then
  echo -e "${GREEN}Pushed images:${NC}"
  for img in "${PUSHED_IMAGES[@]}"; do
    echo -e "  ${GREEN}✓${NC} ${img}"
  done
  echo ""
fi

if [ "${#FAILED_SERVICES[@]}" -gt 0 ]; then
  echo -e "${RED}Failed services:${NC}"
  for svc in "${FAILED_SERVICES[@]}"; do
    echo -e "  ${RED}✗${NC} ${svc}"
  done
  echo ""
  exit 1
fi

echo -e "${GREEN}All images pushed.${NC}"
echo ""

if [ "$RUN_DEPLOY" = false ]; then
  echo -e "${CYAN}Tip: run with --deploy to also execute the Bicep deploy:${NC}"
  echo "  ./infra/build-push.sh --deploy"
  echo ""
  exit 0
fi

# ── Resolve secrets from Azure ────────────────────────────────────────────────
echo -e "${CYAN}Resolving secrets from Azure...${NC}"

# ACR_PASS was already fetched above for docker login — reuse it
echo -e "  ACR_PASS      ${GREEN}✓${NC}"

AI_KEY=$(az cognitiveservices account keys list \
  --name aifoundrysharedservices00001 \
  --resource-group rg-shared-services \
  --query key1 -o tsv)
echo -e "  AI_KEY        ${GREEN}✓${NC}"

SEARCH_KEY=$(az search admin-key show \
  --service-name search-procurement-poc01 \
  --resource-group rg-procurement-agent-poc \
  --query primaryKey -o tsv 2>/dev/null || true)
echo -e "  SEARCH_KEY    ${GREEN}✓${NC}"

COSMOS_KEY=$(az cosmosdb keys list \
  --name shared-cosmos-nosql \
  --resource-group rg-shared-services \
  --type keys \
  --query primaryMasterKey -o tsv)
echo -e "  COSMOS_KEY    ${GREEN}✓${NC}"

MCP_KEY=$(az containerapp secret show \
  --name "ca-mcp-server-poc01" \
  --resource-group "rg-procurement-agent-poc" \
  --query "value[?name=='mcp-api-key'].value | [0]" \
  -o tsv 2>/dev/null || true)

if [ -z "$MCP_KEY" ]; then
  # Fallback: read from local .env
  ENV_FILE="${REPO_ROOT}/backend/mcp-server/.env"
  if [ -f "$ENV_FILE" ]; then
    MCP_KEY=$(grep -E '^API_KEY=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '[:space:]')
  fi
fi

if [ -z "$MCP_KEY" ]; then
  echo -e "  ${YELLOW}MCP_KEY not found in Azure or backend/mcp-server/.env. Enter the MCP server API key:${NC}"
  read -r -s MCP_KEY
  echo ""
  if [ -z "$MCP_KEY" ]; then
    echo -e "${RED}MCP_KEY is required. Aborting.${NC}"
    exit 1
  fi
fi
echo -e "  MCP_KEY       ${GREEN}✓${NC}"

echo ""

# ── Run Bicep deploy ──────────────────────────────────────────────────────────
echo -e "${CYAN}Running Bicep deploy...${NC}"
echo ""

az deployment group create \
  --resource-group rg-procurement-agent-poc \
  --template-file "${REPO_ROOT}/infra/main.bicep" \
  --parameters "${REPO_ROOT}/infra/main.bicepparam" \
    acrAdminPassword="$ACR_PASS" \
    aiServicesKey="$AI_KEY" \
    searchKey="$SEARCH_KEY" \
    cosmosKey="$COSMOS_KEY" \
    mcpApiKey="$MCP_KEY" \
    frontendImage="${ACR_LOGIN_SERVER}/procurement-frontend:latest"

echo ""
echo -e "${GREEN}Deploy complete.${NC}"
echo ""

