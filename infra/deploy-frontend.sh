#!/bin/bash
# ============================================================================
# PROCUREMENT AGENT POC — Frontend Deploy (Next.js → ACR → Container Apps)
# ============================================================================
# Usage:
#   ./infra/deploy-frontend.sh               # Build, push, and update CA
#   ./infra/deploy-frontend.sh --no-cache    # Clean Docker build (no layer cache)
#   ./infra/deploy-frontend.sh --skip-build  # Skip build, push latest, update CA
#
# What this script does:
#   1. Checks az login + Docker running
#   2. Builds the Next.js Docker image (multi-stage, linux/amd64)
#   3. Pushes to ACR with :latest and :<git-sha> tags
#   4. Updates the Container App image + env vars via `az containerapp update`
#      (no full Bicep redeploy needed — faster iteration)
#
# Environment variables (two categories — read the comments carefully):
#
#   BUILD-TIME (NEXT_PUBLIC_* — baked into the JS bundle by Next.js):
#     NEXT_PUBLIC_DEV_MODE    Bypass auth. Default: true (PoC). Must be a
#                             --build-arg; setting it in Container Apps env
#                             vars at runtime has NO effect on the bundle.
#
#   RUNTIME (plain server-side — read by Next.js Route Handlers in Node.js):
#     MAF_BASE_URL            Internal URL of the MAF ai-service.
#     MCP_SERVER_URL          Internal URL of the MCP server (HTTP REST API).
#     MAF_AUTH_TOKEN          Optional bearer token for MAF. Default: empty.
#
#   Override any variable before running:
#     MCP_SERVER_URL=http://my-custom-url ./infra/deploy-frontend.sh
#
# Requirements:
#   - az CLI logged in (az login)
#   - Docker Desktop running
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
FRONTEND_DIR="${REPO_ROOT}/frontend"

# ── Config ───────────────────────────────────────────────────────────────────
ACR_NAME="azacrshared"
RG_SHARED="rg-shared-services"
RG_APP="rg-procurement-agent-poc"
CA_NAME="ca-frontend-poc01"
IMAGE_NAME="procurement-frontend"

# ── Build-time env vars (NEXT_PUBLIC_* — baked into the JS bundle) ────────────
# These MUST be passed as --build-arg to docker build.
# Setting them in Container Apps env vars at runtime has NO effect on the bundle.
NEXT_PUBLIC_DEV_MODE="${NEXT_PUBLIC_DEV_MODE:-true}"

# ── Runtime env vars (server-side — injected into Node.js process at startup) ─
# These are set on the Container App and read by Next.js Route Handlers.
# Safe to change without rebuilding the image.
MAF_BASE_URL="${MAF_BASE_URL:-http://ca-ai-service-poc01}"
MCP_SERVER_URL="${MCP_SERVER_URL:-http://ca-mcp-server-poc01}"
MAF_AUTH_TOKEN="${MAF_AUTH_TOKEN:-}"

# ── Parse flags ───────────────────────────────────────────────────────────────
SKIP_BUILD=false
NO_CACHE=false
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --no-cache)   NO_CACHE=true ;;
    *) echo -e "${RED}Unknown argument: $arg${NC}"; echo "Usage: $0 [--no-cache] [--skip-build]"; exit 1 ;;
  esac
done

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Procurement Agent PoC — Frontend Deploy${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# ── 1. Azure login check ─────────────────────────────────────────────────────
if ! az account show &>/dev/null; then
  echo -e "${YELLOW}No Azure session found. Logging in...${NC}"
  az login
fi

SUBSCRIPTION=$(az account show --query name -o tsv)
echo -e "${YELLOW}Subscription: ${SUBSCRIPTION}${NC}"
echo ""

# ── 2. Resolve ACR login server ───────────────────────────────────────────────
echo -e "${CYAN}Resolving ACR login server...${NC}"
ACR_LOGIN_SERVER=$(az acr show \
  --name "$ACR_NAME" \
  --resource-group "$RG_SHARED" \
  --query loginServer -o tsv)
echo -e "  ACR: ${ACR_LOGIN_SERVER}"
echo ""

# ── 3. Git SHA tag ────────────────────────────────────────────────────────────
GIT_SHA=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")
IMAGE_LATEST="${ACR_LOGIN_SERVER}/${IMAGE_NAME}:latest"
IMAGE_SHA="${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${GIT_SHA}"

# ── 4. Build & push ───────────────────────────────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
  echo -e "${CYAN}Checking Docker...${NC}"
  if ! docker info &>/dev/null; then
    echo -e "${RED}Docker is not running. Please start Docker Desktop.${NC}"
    exit 1
  fi

  BUILD_FLAGS="--platform linux/amd64 --file ${FRONTEND_DIR}/Dockerfile --tag ${IMAGE_LATEST} --tag ${IMAGE_SHA}"
  BUILD_FLAGS="${BUILD_FLAGS} --build-arg NEXT_PUBLIC_DEV_MODE=${NEXT_PUBLIC_DEV_MODE}"
  if [ "$NO_CACHE" = true ]; then
    BUILD_FLAGS="${BUILD_FLAGS} --no-cache"
    echo -e "${CYAN}Building Docker image (linux/amd64, no cache)...${NC}"
  else
    echo -e "${CYAN}Building Docker image (linux/amd64)...${NC}"
  fi
  echo -e "  Context:    frontend/"
  echo -e "  Dockerfile: frontend/Dockerfile"
  echo -e "  Tags:       :latest  :${GIT_SHA}"
  echo -e "  Build args: NEXT_PUBLIC_DEV_MODE=${NEXT_PUBLIC_DEV_MODE}"
  echo ""

  docker build $BUILD_FLAGS "${FRONTEND_DIR}"
  echo -e "${GREEN}  Build complete.${NC}"
  echo ""

  # ── 5. Docker login to ACR ────────────────────────────────────────────────
  echo -e "${CYAN}Logging in to ACR (admin user)...${NC}"
  ACR_PASS=$(az acr credential show \
    --name "$ACR_NAME" \
    --resource-group "$RG_SHARED" \
    --query "passwords[0].value" -o tsv)
  echo "$ACR_PASS" | docker login "$ACR_LOGIN_SERVER" \
    --username "$ACR_NAME" \
    --password-stdin
  echo ""

  # ── 6. Push images ────────────────────────────────────────────────────────
  echo -e "${CYAN}Pushing images to ACR...${NC}"
  docker push "${IMAGE_LATEST}"
  docker push "${IMAGE_SHA}"
  echo -e "${GREEN}  Push complete.${NC}"
  echo ""
else
  echo -e "${YELLOW}Skipping build (--skip-build).${NC}"
  echo ""
fi

# ── 7. Update Container App image + env vars ─────────────────────────────────
#
# Always declare the full set of runtime env vars so each deploy is idempotent.
# --set-env-vars replaces ALL env vars in the revision template — nothing is
# inherited silently from a previous revision.
#
# Runtime vars (server-side — safe to change without a rebuild):
#   MAF_BASE_URL     → proxied by /api/maf/* route handlers
#   MCP_SERVER_URL   → proxied by /api/procurement/* route handlers
#   MAF_AUTH_TOKEN   → optional bearer token for MAF
#
# Build-time vars (NEXT_PUBLIC_*) are baked into the bundle at docker build
# and listed here only for documentation — they have NO runtime effect.
echo -e "${CYAN}Updating Container App...${NC}"
echo -e "  Container App:  ${CA_NAME}"
echo -e "  Image:          ${IMAGE_LATEST}"
echo -e "  MAF_BASE_URL:   ${MAF_BASE_URL}"
echo -e "  MCP_SERVER_URL: ${MCP_SERVER_URL}"
echo ""

ENV_VARS="NODE_ENV=production"
ENV_VARS="${ENV_VARS} PORT=3000"
ENV_VARS="${ENV_VARS} HOST=0.0.0.0"
ENV_VARS="${ENV_VARS} MAF_BASE_URL=${MAF_BASE_URL}"
ENV_VARS="${ENV_VARS} MCP_SERVER_URL=${MCP_SERVER_URL}"
# Only set MAF_AUTH_TOKEN if non-empty to avoid overwriting a secret-backed var
if [ -n "${MAF_AUTH_TOKEN}" ]; then
  ENV_VARS="${ENV_VARS} MAF_AUTH_TOKEN=${MAF_AUTH_TOKEN}"
fi

az containerapp update \
  --name "$CA_NAME" \
  --resource-group "$RG_APP" \
  --image "${IMAGE_LATEST}" \
  --set-env-vars ${ENV_VARS} \
  --output none

echo -e "${GREEN}  Container App updated.${NC}"
echo ""

# ── 8. Print frontend URL ─────────────────────────────────────────────────────
FRONTEND_FQDN=$(az containerapp show \
  --name "$CA_NAME" \
  --resource-group "$RG_APP" \
  --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null || true)

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Done.${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
[ -n "$FRONTEND_FQDN" ] && echo -e "  ${BOLD}https://${FRONTEND_FQDN}${NC}"
echo ""
