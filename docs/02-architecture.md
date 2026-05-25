# Architecture — Espacio Pro v1

> Companion to `08-acceptance-criteria.md`, `01-domain-model.md`, and `04-api-design.md`.
> Diagrams live in `03-uml/` as Markdown with Mermaid fences (renderizados en GitHub/VSCode nativamente).

---

## 1. System overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          End user (admin)                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│   Static Web App (SWA Free)                                      │
│   Next.js 16 static export                                       │
│   ─ Clerk SDK (sign-in, JWT in memory)                           │
│   ─ shadcn/ui + Tailwind                                         │
│   ─ NO middleware, NO route handlers                             │
└─────────┬─────────────────────────────────────┬─────────────────┘
          │ JWT Bearer                          │ Auth flows
          ▼                                     ▼
┌──────────────────────────────┐      ┌──────────────────────┐
│  Function App (Consumption)  │      │       Clerk          │
│  .NET 10 isolated worker     │◀────▶│   (JWKS endpoint —   │
│  ─ HTTP triggers per domain  │      │    public, no key)   │
│  ─ ClerkJwtValidator         │      └──────────────────────┘
│  ─ RequireRole(...)          │
│  ─ System-assigned MI        │
└─────────┬────────────────────┘
          │ Cosmos SDK (AAD via MI,
          │ NO connection string)
          ▼
┌──────────────────────────────────────────────┐
│   Cosmos NoSQL Serverless (shared account)   │
│   rg: rg-shared-services                     │
│   account: shared-cosmos-nosql               │
│   db: espaciopro       (prod)                │
│   db: espaciopro-dev   (local dev)           │
│   ├─ master      PK /type                    │
│   └─ operations  PK /type                    │
└──────────────────────────────────────────────┘
```

> **No Key Vault in v1**. Every Clerk config (`CLERK_JWKS_URL`, `CLERK_ISSUER`) is a public URL/string and lives in plain App Settings. Clerk Secret Key is NOT required because backend never calls Clerk Backend API in v1. Cosmos en producción usa Managed Identity → sin connection string. Para dev local también se prefiere `az login` + `DefaultAzureCredential`; existe un fallback opcional vía `COSMOS_CONNECTION_STRING` (sólo en `local.settings.json`, gitignored) para desarrolladores que aún no tienen RBAC asignado — prohibido en producción.

See `03-uml/component.md` for diagram form.

---

## 2. Resource layout (Azure)

| Resource group | Resources | Why separated |
|----------------|-----------|---------------|
| `rg-shared-services` | Cosmos DB account `shared-cosmos-nosql` (compartido entre proyectos personales) | Pre-existente, NO se toca desde el Bicep de este proyecto. Solo se referencia. |
| `rg-espaciopro-prod` | Function App (Flex Consumption FC1), Storage Account, App Service Plan (FC1), Static Web App, App Insights, Log Analytics workspace | Recreable sin perder datos |

Single subscription. Single region (`eastus2` por default, override via Bicep param).

### Bicep responsibility split

- `rg-shared-services` → fuera del scope del Bicep de este proyecto. Asumido pre-existente.
- `rg-espaciopro-prod` → todo el Bicep del repo despliega aquí.
- **Cross-RG concerns**: el role assignment "Function App MI → Cosmos data plane" se hace contra `shared-cosmos-nosql` desde el Bicep de prod. Requiere que el deployer tenga `User Access Administrator` (o `Owner`) sobre el RG compartido.

---

## 3. Auth flow

1. User abre la SWA → Clerk SDK detecta sin sesión → redirect a Clerk hosted page.
2. Login OK → Clerk emite JWT con claims (`sub`, `email`, custom `role`).
3. Front almacena JWT en memoria (Clerk maneja refresh).
4. Cada request a Functions: `Authorization: Bearer <jwt>`.
5. `ClerkJwtValidator` (middleware en Functions):
   - Descarga JWKS de `CLERK_JWKS_URL` (URL pública, no requiere secret) y lo cachea en memoria (TTL 1h).
   - Valida firma RS256, `iss`, `exp` (audience validation OFF en v1: Clerk JWTs no incluyen `aud` por default).
   - Inyecta `ClaimsPrincipal` en el contexto.
6. `[RequireRole("admin")]` revisa claim `role` → 403 si no coincide.

> **No secret key needed**. Clerk JWT validation es 100% asimétrica con clave pública vía JWKS. La Clerk Secret Key (`sk_live_...`) solo haría falta si el backend llamara Clerk Backend API (listar users, leer metadata, revocar sesiones). En v1 no lo hace, por eso no hay Key Vault.

Ver `03-uml/sequence-auth.md`.

### Clerk env vars (App Settings, plano)

| Var | Tipo | Origen |
|-----|------|--------|
| `CLERK_JWKS_URL` | URL pública | Clerk Dashboard → API keys |
| `CLERK_ISSUER` | URL pública | Clerk Dashboard → JWT templates |

### Roles claim

Clerk Dashboard → Sessions → Custom claims:
```json
{
  "role": "{{user.public_metadata.role}}"
}
```
`public_metadata.role` se setea manualmente en Clerk admin (`admin` para v1).

---

## 4. Backend layout

Layered architecture (Clean / Onion). Four projects in a single `.slnx` solution.

```
backend/
├── EspacioPro.slnx                       .NET 10 XML solution format
├── .gitignore                            bin/, obj/, local.settings.json, .vs/
├── README.md                             local run instructions
├── src/
│   ├── EspacioPro.Domain/                no external deps
│   │   ├── Common/
│   │   │   ├── BaseEntity.cs             Id, Type, Active, audit + ETag (JsonIgnore)
│   │   │   └── AuditUser.cs              sealed record { ClerkUserId, Email, DisplayName }
│   │   ├── Abstractions/
│   │   │   └── IRepository<T>.cs         GetById, GetAll, Create, Update, SoftDelete
│   │   └── Entities/
│   │       ├── Catalog.cs                + CatalogItem (inline array)
│   │       ├── Student.cs                (post-MVP)
│   │       └── ... (one per aggregate)
│   │
│   ├── EspacioPro.Application/           refs Domain
│   │   ├── Abstractions/
│   │   │   ├── IClerkJwtValidator.cs     ValidateAsync(token) → ClaimsPrincipal
│   │   │   └── ICurrentUser.cs           GetAuditUser() → AuditUser snapshot
│   │   ├── Common/
│   │   │   ├── ProblemDetailsFactory.cs  RFC 7807 builders
│   │   │   └── UnauthorizedException.cs
│   │   └── Health/
│   │       └── HealthService.cs          GET v1/health
│   │
│   ├── EspacioPro.Infrastructure/        refs Domain + Application
│   │   ├── Cosmos/
│   │   │   ├── CosmosClientFactory.cs    DefaultAzureCredential + System.Text.Json
│   │   │   ├── CosmosOptions.cs          { Endpoint, Database }
│   │   │   ├── CosmosRepository<T>.cs    base impl: audit auto-populate, soft delete, ETag
│   │   │   └── Repositories/
│   │   │       └── CatalogRepository.cs  + GetByCodeAsync
│   │   └── Auth/
│   │       ├── ClerkJwtValidator.cs      JWKS fetch, RS256 validate, IMemoryCache 1h
│   │       ├── ClerkOptions.cs           { JwksUrl, Issuer }
│   │       └── CurrentUserAccessor.cs    reads claims from IHttpContextAccessor
│   │
│   └── EspacioPro.Api/                   refs Application + Infrastructure
│       ├── Program.cs                    HostBuilder DI: Cosmos singleton, options,
│       │                                 IMemoryCache, IHttpContextAccessor,
│       │                                 IClerkJwtValidator, ICurrentUser, repositories,
│       │                                 middleware order: CorrelationId → JwtAuth
│       ├── host.json                     extensionBundle v4
│       ├── local.settings.json.example   COSMOS_*, CLERK_*, CORS_ORIGINS
│       ├── Functions/
│       │   ├── HealthFunction.cs         GET v1/health (anonymous)
│       │   └── CatalogFunction.cs        GET/PUT/POST/DELETE v1/catalogs[/{code}[/items[/{value}]]]
│       ├── Middleware/
│       │   ├── CorrelationIdMiddleware.cs   x-correlation-id accept/generate/echo
│       │   └── JwtAuthMiddleware.cs         enforces [RequireRole] via reflection
│       └── Attributes/
│           └── RequireRoleAttribute.cs   declarative role gate
└── tests/
    └── .gitkeep                          (xUnit + Moq later)
```

### Conventions

- **Layered**: Domain (entities, abstractions) → Application (use cases, DTOs) → Infrastructure (Cosmos, Auth) → Api (Functions host).
- **One Function class per aggregate root**. All endpoints under `/api/v1/...` (URI versioning, see `04-api-design.md`).
- **Auth**: protected functions carry `[RequireRole("admin")]`. `JwtAuthMiddleware` resolves it via reflection (cached per entry point), validates Bearer token via `IClerkJwtValidator`, sets `httpContext.User`. Functions without the attribute pass through (anonymous).
- **Correlation**: `CorrelationIdMiddleware` runs first. Accepts/generates `x-correlation-id`, echoes on response, adds to logger scope.
- **Errors**: RFC 7807 Problem Details (`Application/Common/ProblemDetailsFactory`), serialized as `application/problem+json`.
- **All entities inherit `BaseEntity`**: `Id`, `Type`, `Active`, `CreatedAt/By`, `UpdatedAt/By`, `DeletedAt?/By?`, `ETag` (`[JsonIgnore]`, populated from `ItemResponse.ETag`).
- **Audit auto-populated** by `CosmosRepository<T>` base class via `ICurrentUser` (extracts `AuditUser` snapshot from `ClaimsPrincipal` on `IHttpContextAccessor.HttpContext.User`). Domain code never writes audit fields.
- **Repositories** inherit `CosmosRepository<T>`, declare `ContainerName` (`master`/`operations`) and `TypeDiscriminator` (e.g. `"catalog"`). Custom queries use exposed `protected Container`.
- **Cosmos serializer**: System.Text.Json (via `CosmosClientOptions.UseSystemTextJsonSerializerWithOptions`) — `[JsonPropertyName]` and `[JsonIgnore]` on entities are honored.
- **`CosmosClient` singleton**, repositories scoped (depend on `ICurrentUser`).
- **Optimistic concurrency**: `Update` and `SoftDelete` send `If-Match: <etag>` when ETag is present.


---

## 5. Frontend layout

```
frontend/
├── next.config.ts                  output: 'export'
├── src/
│   ├── app/
│   │   ├── layout.tsx              ClerkProvider, AuthGate
│   │   ├── page.tsx                Dashboard por horario
│   │   ├── students/
│   │   ├── teachers/
│   │   ├── schedules/
│   │   ├── enrollments/
│   │   ├── payments/
│   │   ├── teacher-payments/
│   │   ├── expenses/
│   │   └── catalogs/
│   ├── lib/
│   │   ├── api/                    Typed clients per domain
│   │   ├── auth/                   Clerk hooks + JWT injection
│   │   └── i18n/                   ES strings (single locale, but extracted)
│   ├── components/                 shadcn/ui + custom
│   └── hooks/
└── public/
```

### Conventions

- Code (variables, functions, files): **EN** (`StudentsTable`, `useStudents`, `getStudents()`).
- Visible strings: **ES**, in `lib/i18n/es.ts` (no librería i18n en v1, solo objeto plano para que mañana sea fácil migrar).
- API client: 1 module per domain (`lib/api/students.ts`), tipos generados/manuales en `lib/api/types.ts`.
- Auth: hook `useAuthFetch()` que inyecta JWT + maneja 401/403.

---

## 6. Data flow critical paths

### 6.1 Crear inscripción con pago inicial

Ver `03-uml/sequence-enroll.md`. Resumen:

1. Front → `POST /api/v1/enrollments { studentId, scheduleId, enrollmentDate, status: "active" }`.
2. Backend:
   - Valida JWT + role.
   - Query: `SELECT * FROM c WHERE c.type='enrollment' AND c.studentId=@s AND c.scheduleId=@sch AND c.status='active' AND c.active=true`.
   - Si existe → 409 Conflict.
   - Si no → insert (con snapshots `studentName`, `scheduleName` denormalizados; ver `04-api-design.md` §4).
3. Si front envió pago inicial: `POST /api/v1/student-payments { enrollmentId, ... }` (llamada separada).

> Decisión: 2 calls separados, NO un endpoint atómico. Más simple, error en pago no bloquea inscripción. Trade-off aceptado.

### 6.2 Calcular deudores

Ver `03-uml/sequence-debtors.md`. Resumen:

1. Front → `GET /api/v1/student-payments/debtors?scheduleId=X&month=YYYY-MM`.
2. Backend ejecuta 2 queries:
   - Q1: `enrollments` activos del horario.
   - Q2: `studentPayments` activos del mes para esos `enrollmentIds` (`WHERE c.type='studentPayment' AND c.enrollmentId IN (...) AND c.date >= @start AND c.date <= @end AND c.active=true`).
3. Diff en memoria → lista de deudores con `lastPaymentDate?` (otra query opcional o se cachea).
4. Front renderiza.

> RU optimization queda como future work si la operación supera 1000 RUs.

---

## 7. State machines

Ver `03-uml/state-enrollment.md` y `03-uml/state-schedule.md`. Resumen libre:

- **Enrollment**: cualquier transición permitida por admin. v1 no enforza grafo.
- **Schedule**: idem.

Future: log de auditoría con before/after. Out of scope v1.

---

## 8. Operational

### 8.1 CORS policy

Configurada en dos capas: runtime CORS de Azure Functions para `OPTIONS` preflight y `CorsMiddleware` en `EspacioPro.Api/Program.cs` para respuestas reales, incluyendo errores de auth/problem details.

| Setting | Value | Notas |
|---|---|---|
| Allowed origins | `CORS_ORIGINS` env var, comma-separated. **Local**: `http://localhost:3000`. **Prod**: URL de la SWA (`https://<swa-name>.azurestaticapps.net` y custom domain si existe). | Wildcards `*` prohibidos (no compatible con `Authorization`). |
| Allowed methods | `GET, POST, PUT, DELETE, OPTIONS` | |
| Allowed headers | `Authorization, Content-Type, x-correlation-id, If-Match` | Mínimo necesario para los contratos del cheatsheet. |
| Exposed headers | `x-correlation-id, ETag, Location` | `ETag` por si en el futuro movemos `_etag` al header en vez del body. `Location` para 201 POSTs. |
| Allow credentials | `false` | JWT viaja en `Authorization`, no en cookies. Cookies no se usan. |
| Preflight max age | `3600` (1h) | Reduce OPTIONS round-trips. |

Implementación:
```csharp
// Bicep siteConfig.cors.allowedOrigins = split(corsOrigins, ',')
// Bicep app setting AzureWebJobsFeatureFlags = EnableWorkerIndexing
worker.UseMiddleware<EspacioPro.Api.Middleware.CorsMiddleware>();

[Function("CorsPreflight")]
[HttpTrigger(AuthorizationLevel.Anonymous, "options", Route = "{*path}")]
// Applies Access-Control-Allow-* headers and returns 204.
```

> El JWT validation middleware **NO** exige token sobre requests `OPTIONS` (preflight). En Flex Consumption + isolated worker, `EnableWorkerIndexing` debe mantenerse para que el runtime respete el CORS configurado al responder preflights.

### 8.2 Logs

- **Logs**: Application Insights vía `ILogger<T>`. Sampling default. Sin custom telemetry en v1.
- **Secrets**: ninguno en v1 (ver sec 1, 3). Cosmos = MI, Clerk = todo público.
- **Backup**: Cosmos serverless trae backup automático (8h, 30 días). Suficiente para v1.
- **Cost ceiling esperado**: < $5 USD/mes (Cosmos serverless + SWA Free + Function Consumption + Storage mínimo).

---

## 9. Local dev

```bash
# Backend (recomendado)
cd backend
./run.sh                    # valida prereqs, arranca func start en :7071

# Backend (manual)
cd backend/src/EspacioPro.Api
func start                  # auth a Cosmos via az login + DefaultAzureCredential, DB lógica espaciopro-dev

# Frontend
cd frontend
pnpm dev                    # next dev en :3000, NEXT_PUBLIC_API_URL=http://localhost:7071/api
```

`local.settings.json` (gitignored) contiene:
```jsonc
{
  "Values": {
    // Cosmos auth — pick ONE
    "COSMOS_ACCOUNT_ENDPOINT": "https://<your-cosmos-account>.documents.azure.com:443/",
    "COSMOS_DATABASE_NAME": "espaciopro-dev",
    // Local-dev fallback (NO usar en prod):
    // "COSMOS_CONNECTION_STRING": "AccountEndpoint=...;AccountKey=...;",

    "CLERK_JWKS_URL": "https://...clerk.accounts.dev/.well-known/jwks.json",
    "CLERK_ISSUER": "https://...clerk.accounts.dev",
    "CORS_ORIGINS": "http://localhost:3000",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true"
  }
}
```

`DefaultAzureCredential` usa `az login` en local → tu user debe tener `Cosmos DB Built-in Data Contributor` sobre la cuenta de Cosmos. Si todavía no tenés RBAC asignado, podés usar el fallback `COSMOS_CONNECTION_STRING` (sólo dev, ver §8.1).

CORS local: ver §8.1 (env var `CORS_ORIGINS=http://localhost:3000`).

---

## 10. Resolved architectural items (M0 entry point)

### 10.1 Cosmos unique key strategy

**Problem**: container `master` holds 4 entity types (`catalog`, `student`, `teacher`, `schedule`). The dedup invariant is `(docType, docNumber)` for `student` and `teacher` only. Cosmos unique keys are defined at container level over JSON paths and apply to **every** document in the container — `catalog` and `schedule` don't have those fields.

**Considered paths**:

| Path | Description | Verdict |
|---|---|---|
| **A** | Unique key on `/docType, /docNumber` over the whole container. `catalog`/`schedule` simply don't have those paths → Cosmos treats them as `null` → all `null+null` documents collide. | ❌ Breaks: only one `catalog` doc could exist before unique key violation. |
| **B** | Split `master` into 4 containers (one per entity). Apply unique key only on student/teacher containers. | ❌ Inflates cost (more provisioned RU/serverless allocations) and breaks the 2-container architecture. Overkill. |
| **C** | Single `master` container with unique key on a **synthetic dedup field** populated only on student/teacher: `dedupKey = type + ':' + docType + ':' + docNumber`. Stored as `/dedupKey`. Other entities omit the field. | ✅ Cosmos allows nullable unique key paths — multiple docs with `dedupKey = null` (catalog, schedule) coexist. |

**Decision: Path C.**

- Unique key: `/dedupKey` on container `master`.
- Backend `CosmosRepository<Student>` and `CosmosRepository<Teacher>` populate `dedupKey` automatically before insert/update:
  ```
  dedupKey = $"{type}:{docType}:{docNumber}"
  // e.g. "student:dni:12345678", "teacher:ce:ABC123456"
  ```
- Other repositories never set the field → JSON omits it → Cosmos treats as null → no collision.
- On Cosmos `409 Conflict` from unique key violation, backend returns HTTP `409` with `urn:espaciopro:problem:duplicate` and a message resolving the offending field for the user.
- Bicep M0 must define this unique key from the **first** deploy. Unique keys are immutable post-creation.

### 10.2 Indexing policy

**Default Cosmos policy** indexes every JSON path. For master/operations containers this over-indexes large fields (`notes`, `description`) that are never used in `WHERE` clauses, paying RU on every write.

**Decision**:

- Container `master`: custom indexing policy that **excludes**:
  - `/notes/*`
  - `/email/*` (only displayed, never filtered)
  - `/specialty/*` (Teacher; only displayed)
  - `/items/[]/value/*` text body of catalog items (catalog filtering is by `code`, items are read whole)
- Container `operations`: custom indexing policy that **excludes**:
  - `/notes/*`
  - `/description/*`
  - `/receiptNumber/*`
  - `/concept/*` (TeacherPayment)
- **Composite indexes** added for hot queries:
  - `master`: `(type ASC, dedupKey ASC)` — speeds dedup checks during student/teacher creation.
  - `operations`: `(type ASC, scheduleId ASC, status ASC)` — speeds enrollment list-by-schedule.
  - `operations`: `(type ASC, enrollmentId ASC, date DESC)` — speeds payment history per enrollment.
  - `operations`: `(type ASC, scheduleId ASC, date ASC)` — speeds dashboard month queries.

> Composite indexes affect read RU only (writes pay the same). Each composite costs ~0.5 RU per write; typical doc has 1-2 composites = +1 RU per write, vs ~10-20 RU saved per query. Net positive.

Implementation: defined in Bicep alongside container creation. Re-applying the policy after data exists is a Cosmos online operation (no downtime).

### 10.3 Frontend catalog cache

**Problem**: catalogs are read on almost every form (dropdowns for `paymentMethods`, `courses`, etc.). Naive approach = 8 catalog reads per page load.

**Decision**:

- Frontend caches catalogs in a Zustand store (or React Context) loaded on app boot via `GET /api/v1/catalogs` (single call, returns all 8).
- **TTL**: 15 minutes. After TTL expiry, next consumer triggers a background refetch (stale-while-revalidate).
- **Invalidation on CUD**:
  - When admin edits a catalog via `PUT /catalogs/{code}` or `POST /catalogs/{code}/items` or `DELETE /catalogs/{code}/items/{value}`, the API client clears the in-memory cache for **that code only** and triggers a refetch.
  - Other browser tabs do NOT auto-refresh in v1 (single-admin scenario). Future work: BroadcastChannel API for cross-tab sync.
- **No localStorage persistence** in v1. Cache is in-memory only — page reload triggers fresh load. Acceptable cost: 1 catalog read per session start (~3 RU).

Implementation lives in `frontend/src/lib/api/catalogs.ts` + a Zustand slice in `frontend/src/lib/stores/catalogs.ts`.

---

## 11. Future work (post-v1)

- **Key Vault** + Clerk Secret Key cuando se necesite Clerk Backend API (ej: enlazar `Teacher.clerkUserId` cuando llegue rol `teacher`).
- **Dashboard global** (totales mes, utilidad, deudores totales).
- **Migración** del Sheet GAS si se decide mantener histórico.
