# Espacio Pro — Backend

Azure Functions (.NET 10, isolated worker) with Clean Architecture.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local)
- Azure CLI with `az login` completed
- Your Azure account must have **Cosmos DB Built-in Data Contributor** role on the `shared-cosmos-nosql` account

## Project Structure

```
backend/
├── EspacioPro.slnx                     # .NET 10 XML solution format
├── src/
│   ├── EspacioPro.Domain/              # Entities, value objects, repo abstractions
│   ├── EspacioPro.Application/         # Use cases, interfaces, health service
│   ├── EspacioPro.Infrastructure/      # Cosmos client, Clerk JWT validator, auth
│   └── EspacioPro.Api/                 # Azure Functions host, middleware, DI wiring
├── tools/
│   └── EspacioPro.Seed/                # One-shot console: seeds the 8 catalogs
└── tests/
    └── EspacioPro.Tests/               # xUnit + FluentAssertions
```

## Local Setup

1. **Restore packages**

   ```bash
   cd backend
   dotnet restore
   ```

2. **Configure local settings**

   ```bash
   cp src/EspacioPro.Api/local.settings.json.example src/EspacioPro.Api/local.settings.json
   ```

   Edit `local.settings.json` and fill in:
   - **Cosmos auth — pick ONE**:
     - **Mode A — Managed Identity / `az login`** *(production-equivalent, recommended once you have RBAC set up)*: keep `COSMOS_ACCOUNT_ENDPOINT` + `COSMOS_DATABASE_NAME`, run `az login`, ensure your account has the **Cosmos DB Built-in Data Contributor** role on the dev account.
     - **Mode B — Connection string** *(local-dev convenience while RBAC isn't set up yet)*: uncomment `COSMOS_CONNECTION_STRING` and paste the dev account's primary connection string. **Never commit. Never use in production.**
   - `CLERK_JWKS_URL` — Clerk's public JWKS endpoint (`https://<your-instance>.clerk.accounts.dev/.well-known/jwks.json`)
   - `CLERK_ISSUER` — Clerk issuer URL (no trailing slash)
   - `CORS_ORIGINS` — comma-separated allowlist (default `http://localhost:3000`)

   > ⚠️ **`CLERK_SECRET_KEY` is intentionally NOT used in v1.** The backend validates JWTs against Clerk's public JWKS endpoint only. No Clerk secret should ever live in `local.settings.json` or in Azure App Settings.

3. **Run locally** *(recommended — handles port conflicts, validates config)*

   ```bash
   ./run.sh              # restore + func start
   ./run.sh --no-restore # skip restore on warm runs
   ```

   Or manually:

   ```bash
   cd src/EspacioPro.Api
   func start
   ```

4. **Health probe**

   ```bash
   curl http://localhost:7071/api/v1/health
   ```

   Expected response:
   ```json
   {
     "status": "healthy",
     "version": "1.0.0",
     "timestamp": "2026-05-10T21:00:00.0000000Z"
   }
   ```

## Seed catalogs

One-shot, idempotent. Creates the 8 catalogs from `docs/01-domain-model.md` §3.1
(`courses`, `levels`, `paymentMethods`, `expenseCategories`, `weekdays`, `studentSources`).
Existing catalog codes are skipped.

```bash
# Uses the same env vars as the API
export COSMOS_ACCOUNT_ENDPOINT="https://shared-cosmos-nosql.documents.azure.com:443/"
export COSMOS_DATABASE_NAME="espaciopro-dev"
az login   # ensures DefaultAzureCredential works

dotnet run --project tools/EspacioPro.Seed
```

Or pass overrides on the CLI:

```bash
dotnet run --project tools/EspacioPro.Seed -- \
  --COSMOS_ACCOUNT_ENDPOINT=https://... \
  --COSMOS_DATABASE_NAME=espaciopro-dev
```

Audit fields on seeded docs use a synthetic `system@espaciopro.local` user.

## Tests

```bash
cd backend
dotnet test
```

## OpenAPI

The hand-authored OpenAPI 3.1 spec lives at `src/EspacioPro.Api/openapi.yaml`
(single source of truth) and is served at runtime by the Functions host:

```bash
# YAML (raw)
curl http://localhost:7071/api/v1/openapi.yaml

# JSON (parsed and re-emitted, e.g. for openapi-typescript)
curl http://localhost:7071/api/v1/openapi.json
```

See `docs/06-openapi-pipeline.md` for the full pipeline (FE codegen, CI guard,
contribution rules).

## Auth

- **Clerk JWT (RS256)** validated via public JWKS endpoint — **no Clerk secret used in v1**. `CLERK_SECRET_KEY` is irrelevant to this backend.
- **Cosmos DB** — two auth modes:
  - **Production / preferred local**: `DefaultAzureCredential` (Managed Identity in Azure, `az login` locally). Requires `Cosmos DB Built-in Data Contributor` role.
  - **Local-dev fallback**: `COSMOS_CONNECTION_STRING` in `local.settings.json` (gitignored). Used only when set; production deployments must not have it.
- No Key Vault in v1.

## Conventions

- Backend code, namespaces, comments: **English only**.
- API routes: `/api/v1/{resource}` (URI versioning).
- Errors: RFC 7807 Problem Details (`application/problem+json`).
- Soft delete only (no hard delete in v1).
- See `docs/01-domain-model.md` and `.agent/conventions.md` for full rules.
