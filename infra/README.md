# Infrastructure (Bicep) — Espacio Pro v1

AVM-first, modular Bicep for Espacio Pro v1 on Azure. Targets a single environment (`prod`) but is parametrized for future envs.

> **Workflow note**: this folder is the output of M0 Infra under Strict RPI per `docs/05-workflow-hve-rpi.md`. Do not edit modules without re-running Research → Plan → Implement.

---

## What this provisions

In `rg-espaciopro-prod` (created by `main.bicep`):

| Module | Resource | AVM? |
|---|---|---|
| `modules/monitoring.bicep` | Log Analytics workspace + Application Insights (workspace-backed) | ✅ |
| `modules/storage.bicep` | Storage Account + `app-package` blob container (Flex deployment) | ✅ |
| `modules/function-app.bicep` | App Service Plan **FC1 Linux** + Function App (.NET 10 isolated) + system MI + Storage Blob Data Owner role + diag settings | ❌ Direct ARM (Flex Consumption shape) |
| `modules/swa.bicep` | Static Web App (Free) | ✅ |

Cross-RG into the **pre-existing** `rg-shared-services`:

| Module | Resource | AVM? |
|---|---|---|
| `modules/cosmos-database.bicep` | SQL DB `espaciopro` + `master` container (PK `/type`, unique key `/dedupKey`) + `operations` container (PK `/type`, 3 composite indexes) on the existing `shared-cosmos-nosql` account | ❌ Custom (parent is `existing`) |
| `modules/role-assignment-cosmos.bicep` | `Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments` granting **Cosmos DB Built-in Data Contributor** to the Function App MI | ❌ No AVM equivalent |

> **NOT in v1**: Key Vault, Front Door, APIM, Private Endpoints, multi-region, custom backup. See `docs/08-acceptance-criteria.md` §4.

---

## Naming convention

CAF abbreviations + `<workload>-<env>-<regionCode>`:

| Resource | Pattern | Example |
|---|---|---|
| Function App | `func-<workload>-<env>-<region>` | `func-espaciopro-prod-eus2` |
| App Service Plan | `asp-<workload>-<env>-<region>` | `asp-espaciopro-prod-eus2` |
| Static Web App | `stapp-<workload>-<env>-<region>` | `stapp-espaciopro-prod-eus2` |
| App Insights | `appi-<workload>-<env>-<region>` | `appi-espaciopro-prod-eus2` |
| Log Analytics | `log-<workload>-<env>-<region>` | `log-espaciopro-prod-eus2` |
| Storage Account | `st<workload><env><region><sha>` | `stespacioproprodeus2…` (24-char limit; suffix from `uniqueString(rg)`) |

---

## Tags

Minimal set (per design decision Q5):

```
workload  = espaciopro
env       = prod
managedBy = bicep
```

Applied at the RG level and propagated to all resources.

---

## Prerequisites

- **Azure CLI** ≥ 2.60 with the `bicep` extension (`az bicep upgrade`).
- **Subscription**: `e3d59e44-d8a4-475a-a285-7433ca42b87f`.
- **Pre-existing**:
  - RG `rg-shared-services` (in any region).
  - Cosmos NoSQL account `shared-cosmos-nosql` in that RG, **serverless** capacity mode.
- **Deployer permissions**:
  - Subscription: `Contributor` (creates RG + child resources).
  - `rg-shared-services`: `User Access Administrator` or `Owner` (needed for the cross-RG Cosmos data-plane role assignment + Cosmos child resources).
- **Clerk**: dev or prod instance with a public JWKS endpoint. Update `clerkJwksUrl` and `clerkIssuer` in `main.bicepparam` before deploying.

---

## Deploy

There are two helper scripts. **Run `deploy-cosmos.sh` first** (only needed once,
or whenever the schema changes), then `deploy.sh` for the app stack.

### 1. Cosmos DB database + containers — `deploy-cosmos.sh`

Targets the **pre-existing** `shared-cosmos-nosql` account in `rg-shared-services`
and creates the `espaciopro` database with the `master` and `operations`
containers. This is split out because the deployer for the main app stack
typically does not have control-plane permissions on the shared-services RG.

```bash
cd infra

# Preview only
./deploy-cosmos.sh

# Apply (interactive confirmation)
./deploy-cosmos.sh --apply

# CI mode
./deploy-cosmos.sh --apply --yes
```

Override defaults via env:
`ESPACIOPRO_SUBSCRIPTION_ID`, `ESPACIOPRO_SHARED_RG`,
`ESPACIOPRO_COSMOS_ACCOUNT`, `ESPACIOPRO_COSMOS_DB`.

Required role on `rg-shared-services`: **Cosmos DB Operator** or **Contributor**.

### 2. App stack (Functions + SWA + monitoring) — `deploy.sh`

Wrapper around `az deployment sub` against `main.bicep` + `main.bicepparam`.
Handles prerequisite checks, subscription switching, lint, what-if preview, and
the final apply with confirmation:

```bash
cd infra

# Preview only (default — zero side effects)
./deploy.sh

# Preview + apply (interactive confirmation after what-if)
./deploy.sh --apply

# Apply without re-confirming (CI mode)
./deploy.sh --apply --yes

# Custom deployment name
./deploy.sh --apply --name my-experiment-001
```

Override defaults via env: `ESPACIOPRO_SUBSCRIPTION_ID`, `ESPACIOPRO_LOCATION`.

If you prefer raw `az` commands, the equivalents are:

```bash
az account set --subscription e3d59e44-d8a4-475a-a285-7433ca42b87f
az bicep build --file infra/main.bicep
az deployment sub what-if --location eastus2 \
  --template-file infra/main.bicep --parameters infra/main.bicepparam
az deployment sub create --name espaciopro-prod-$(date +%Y%m%d-%H%M%S) \
  --location eastus2 --template-file infra/main.bicep --parameters infra/main.bicepparam
```

> The deployment is **idempotent** — re-running `--apply` is safe and only emits diffs.

---

## Post-deploy validation

Use `infra/get-env.sh` to read deployment outputs in a frontend/backend-shaped
format:

```bash
cd infra

# Print all env vars (frontend + backend reference + URLs) for the latest deployment
./get-env.sh

# Pin to a specific deployment
./get-env.sh --deployment espaciopro-prod-20260510-180000

# Idempotently patch frontend/.env.local (only NEXT_PUBLIC_API_URL — preserves
# Clerk publishable key + dev mode flag the user manages manually)
./get-env.sh --frontend
```

Then probe the health endpoint (anonymous, exercises Cosmos via MI):

```bash
curl https://func-espaciopro-prod-eus2.azurewebsites.net/api/v1/health
```

Expected: `200 OK` with `{ "status": "ok", "timestamp": "...", "version": "...", "dependencies": { "cosmos": "ok" } }`.

If `dependencies.cosmos` is `"unreachable"`, the role assignment hasn't propagated — wait 60–90s and retry.

---

## Updating CORS after first deploy

The SWA hostname (`<random>.azurestaticapps.net`) is only known after `swa.bicep` runs. To allow the deployed frontend to call the API:

1. Read the SWA hostname:
   ```bash
   az deployment sub show --name <deployment-name> \
     --query properties.outputs.swaHostname.value -o tsv
   ```
2. Edit `main.bicepparam` →  `corsOrigins = 'http://localhost:3000,https://<swa-hostname>'`
3. Re-run the `az deployment sub create` command above.

---

## Storage auth model (no shared keys)

`AzureWebJobsStorage` uses identity-based access:

```
AzureWebJobsStorage__accountName = <storage>
AzureWebJobsStorage__credential  = managedidentity
```

The Function App's system-assigned MI is granted `Storage Blob Data Owner` on the storage account by `function-app.bicep`. No connection strings or account keys are stored anywhere.

---

## App settings wired into the Function App

| Key | Source |
|---|---|
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | `monitoring.outputs.appInsightsConnectionString` |
| `AzureWebJobsStorage__accountName` | storage account name |
| `AzureWebJobsStorage__credential` | `managedidentity` (literal) |
| `COSMOS_ACCOUNT_ENDPOINT` | `cosmos-database.outputs.cosmosAccountEndpoint` |
| `COSMOS_DATABASE_NAME` | `cosmos-database.outputs.databaseName` |
| `CLERK_JWKS_URL` | bicepparam |
| `CLERK_ISSUER` | bicepparam |
| `CORS_ORIGINS` | bicepparam |

These names are read by `backend/src/EspacioPro.Api/Program.cs` and the middleware. **Renaming any of them is a coordinated change** across `main.bicepparam`, `function-app.bicep`, `Program.cs`, `local.settings.json.example`, and `tools/EspacioPro.Seed/Program.cs`.

---

## Cosmos design (locked in arch §10.1)

`master` container (PK `/type`):
- Unique key path: `/dedupKey`
- `dedupKey` is a **synthetic** field set ONLY by `Student` and `Teacher` repos as `"{type}:{docType}:{docNumber}"`.
- `Catalog` and `Schedule` repos must **omit** the field entirely from JSON (e.g. `[JsonIgnore(Condition = WhenWritingNull)]`). Cosmos treats missing-field docs as not colliding.
- Excluded index paths: `/notes/*`, `/email/*`, `/specialty/*`, `/items/*/value/*`.
- Composite: `(type ASC, dedupKey ASC)`.

`operations` container (PK `/type`):
- No unique key.
- Excluded index paths: `/notes/*`, `/description/*`, `/receiptNumber/*`, `/concept/*`.
- Composite indexes:
  - `(type, scheduleId, status)` — enrollment list-by-schedule.
  - `(type, enrollmentId, date DESC)` — payment history per enrollment.
  - `(type, scheduleId, date ASC)` — dashboard month queries (M9).

> Unique keys are **immutable** post-creation. Modifying `master.uniqueKeyPolicy` requires re-creating the container (data loss).

---

## Module dependency graph

```
                ┌────────────┐
                │ monitoring │
                └─────┬──────┘
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   ┌─────────┐   ┌─────────┐   ┌─────────────────┐
   │ storage │   │   swa   │   │ cosmosDatabase  │   (cross-RG)
   └────┬────┘   └─────────┘   └────────┬────────┘
        │                               │
        └──────────┬────────────────────┘
                   ▼
           ┌──────────────┐
           │ functionApp  │  (incl. Storage Blob Data Owner role assignment)
           └──────┬───────┘
                  │ principalId
                  ▼
        ┌────────────────────────┐
        │ roleAssignmentCosmos   │  (cross-RG)
        └────────────────────────┘
```

---

## What's NOT here (and why)

- **No `local.settings.json` analogue for Bicep.** Local dev uses connection-string fallback (see `backend/run.sh`), not the deployed Cosmos.
- **No `linkedBackend` from SWA → Function App.** SWA Free doesn't support it; the SPA calls the Function App directly via `NEXT_PUBLIC_API_URL`.
- **No diagnostic settings on the Cosmos account.** Diag settings on a cross-RG existing resource require Monitoring Contributor on `rg-shared-services` and are out of scope for v1; configure manually if needed.
- **No `repositoryToken` on the SWA.** Generate the deploy token post-deploy via `az staticwebapp secrets list` and store it as a GitHub Actions secret (no secrets in source).
