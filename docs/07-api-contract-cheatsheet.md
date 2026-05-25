# API Contract Cheatsheet — Espacio Pro v1

> **Single-page handshake between backend and frontend.**
> All wire-level rules in one place. Anything you implement that contradicts this page is a bug.
> Companion: `01-domain-model.md` (entities), `04-api-design.md` (endpoints), `02-architecture.md` (auth).

---

## 1. URL & versioning

- **Base URL** (prod): `https://<funcapp>.azurewebsites.net`
- **Base URL** (local): `http://localhost:7071`
- **All endpoints** are prefixed: `/api/v1/...`
- Functions runtime adds the `/api/` prefix automatically. In `[Function]` `Route` attributes, write `v1/students` (not `api/v1/students`).

---

## 2. JSON casing

**camelCase on the wire, always.**

| Layer | Naming |
|---|---|
| C# properties (Domain/Application) | PascalCase |
| JSON over HTTP | **camelCase** |
| TypeScript types (frontend) | camelCase |

### Backend setup (`Program.cs`)

```csharp
builder.Services.Configure<JsonSerializerOptions>(options =>
{
    options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
    options.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
});
```

> Functions isolated worker with ASPNETCORE integration: same options applied via `ConfigureFunctionsWebApplication`.

### Frontend

No transform layer. Wire = TypeScript shape. If you ever see snake_case or PascalCase coming in, it's a backend bug — fix the backend, not the frontend.

### Exceptions (verbatim names)

These keys are kept verbatim because they're external conventions:

- `_etag` (Cosmos)
- `x-correlation-id` (HTTP header, lowercase)

---

## 3. Type discriminator values

Cosmos partition key is `/type`. Both containers (`master`, `operations`) use the same discriminator scheme.

| Entity | `type` value | Container |
|---|---|---|
| Catalog | `catalog` | `master` |
| Student | `student` | `master` |
| Teacher | `teacher` | `master` |
| Schedule | `schedule` | `master` |
| Enrollment | `enrollment` | `operations` |
| StudentPayment | `studentPayment` | `operations` |
| TeacherPayment | `teacherPayment` | `operations` |
| Expense | `expense` | `operations` |

**Format**: camelCase, singular, no underscores. Backend constants live in `EspacioPro.Domain.Common.EntityTypes` (`public static class EntityTypes { public const string Student = "student"; ... }`). Frontend mirrors them in `frontend/src/lib/api/types.ts` as a `const` map.

---

## 4. Date / time encoding

| Concept | Wire format | C# type | TS type |
|---|---|---|---|
| Calendar date | `"2026-05-10"` (ISO 8601 date) | `DateOnly` | `string` |
| Wall-clock time | `"18:30"` (24-hour `HH:mm`) | `TimeOnly` | `string` |
| Timestamp | `"2026-05-10T14:23:11.123Z"` (ISO 8601 UTC) | `DateTimeOffset` (UTC) | `string` |
| Month bucket | `"2026-05"` (ISO 8601 year-month, query param only) | `string` | `string` |

### Rules

- **Timestamps are always UTC.** Backend writes `DateTimeOffset.UtcNow.ToString("O")`. Frontend converts to local timezone only for display.
- **`DateOnly` and `TimeOnly`** serialize as their string forms via `System.Text.Json` (built-in in .NET 8+, native in .NET 10). No custom converters needed.
- **Frontend never sends Date objects** over the wire — always strings. Use `date-fns` or `dayjs` for parsing/formatting on display.
- **No timezone names** in payloads. UTC only on wire, local only on screen.

---

## 5. Enums on the wire

All enums serialize as **camelCase strings**, never as numbers.

### Backend

`JsonStringEnumConverter(JsonNamingPolicy.CamelCase)` registered globally (see §2). C# enum `EnrollmentStatus.Active` → wire `"active"`.

### Domain enums (English values)

| Enum | Values (wire format) |
|---|---|
| `DocType` | `"dni"`, `"ce"`, `"passport"` |
| `EnrollmentStatus` | `"active"`, `"completed"`, `"cancelled"`, `"pending"` |
| `ScheduleStatus` | `"active"`, `"inProgress"`, `"finished"`, `"cancelled"` |

> **Migration note**: legacy GAS used Spanish (`"Activo"`, etc.). The v1 backend uses English. UI translates via i18n map.

### Catalog items vs domain enums

Catalog items (`paymentMethods`, `courses`, `spaces`, `expenseCategories`, `weekdays`, `studentSources`) are **user-editable strings**, stored verbatim. They're **NOT enums**. They stay in Spanish because the admin edits them in UI. Example: `paymentMethod: "Yape"`, `course: "Melamina"`.

Rule of thumb: if it's an editable catalog → Spanish, stored as-is. If it's a code-level enum → English camelCase.

---

## 6. Errors — RFC 7807 + ASP.NET validation style

All error responses use `Content-Type: application/problem+json`.

### 6.1 Standard error envelope

```jsonc
{
  "type": "urn:espaciopro:problem:not-found",
  "title": "Resource not found",
  "status": 404,
  "detail": "Student with id 'abc' does not exist.",
  "instance": "/api/v1/students/abc",
  "correlationId": "8b3c-4f..."
}
```

### 6.2 Validation errors (HTTP 422)

ASP.NET-style: extra `errors` object keyed by field name, values are arrays of messages.

```jsonc
{
  "type": "urn:espaciopro:problem:validation",
  "title": "One or more validation errors occurred.",
  "status": 422,
  "detail": "See 'errors' for field-level details.",
  "instance": "/api/v1/students",
  "correlationId": "8b3c-4f...",
  "errors": {
    "firstName": ["The firstName field is required."],
    "docNumber": ["DocNumber must be 8 digits for DNI."]
  }
}
```

### 6.3 Canonical `type` URIs

Format: `urn:espaciopro:problem:<slug>`. Slugs are kebab-case.

| HTTP status | `type` URI | When |
|---|---|---|
| 400 | `urn:espaciopro:problem:bad-request` | Malformed request |
| 401 | `urn:espaciopro:problem:unauthorized` | Missing/invalid JWT |
| 403 | `urn:espaciopro:problem:forbidden` | JWT valid but role insufficient |
| 404 | `urn:espaciopro:problem:not-found` | Resource not found |
| 409 | `urn:espaciopro:problem:conflict` | Generic conflict |
| 409 | `urn:espaciopro:problem:duplicate` | Unique key violation (docNumber, enrollment dup) |
| 409 | `urn:espaciopro:problem:dependent-records` | Cannot soft-delete: active dependents |
| 412 | `urn:espaciopro:problem:precondition-failed` | `If-Match` etag mismatch |
| 422 | `urn:espaciopro:problem:validation` | Field-level validation |
| 500 | `urn:espaciopro:problem:internal` | Unhandled |

### 6.4 Backend

Use `EspacioPro.Application.Common.ProblemDetailsFactory` builders. Never throw raw exceptions out of Function handlers — map to `ProblemDetails` via middleware.

### 6.5 Frontend

```ts
import { isApiError, isNotFound, isValidation } from '@/lib/api';

try {
  await client.post('/students', body);
} catch (err) {
  if (isValidation(err)) {
    // err.problem.errors → Record<string, string[]>
  } else if (isNotFound(err)) { /* ... */ }
  else if (isApiError(err)) { /* generic */ }
  else throw err;
}
```

---

## 7. Concurrency control — `_etag` + `If-Match`

### Applies to (v1 scope)

- `Schedule` (PUT)
- `Enrollment` (PUT)

Other entities don't enforce optimistic concurrency in v1.

### Contract

1. Every entity in any response includes `_etag: "<cosmos-etag>"` at the root level.
2. For PUT on the entities above, the client **MUST** send `If-Match: <_etag-from-last-get>`.
3. If etag mismatches → backend returns **412 Precondition Failed** with `type: urn:espaciopro:problem:precondition-failed`.
4. Client refetches the latest version and reapplies user changes (or shows merge UI).

### Endpoints that ignore `If-Match`

All PUTs on entities NOT in the scope list above. Backend SHOULD NOT 412 on those; if header is sent, it's silently ignored.

### Frontend

```ts
await client.put(`/schedules/${id}`, body, { ifMatch: schedule._etag });
```

---

## 8. Pagination

### Request

- `?limit=<n>` (default 25, max 100)
- `?offset=<n>` (default 0)

### Response envelope (collection endpoints only)

```jsonc
{
  "items": [ /* ... */ ],
  "total": 142,
  "limit": 25,
  "offset": 50
}
```

> Non-paginated endpoints (e.g. `/catalogs`) return a bare array. Pagination envelope applies to `GET /students`, `GET /teachers`, `GET /schedules`, `GET /enrollments`, `GET /student-payments`, `GET /teacher-payments`, `GET /expenses`, and all nested collection endpoints.

### Frontend

```ts
const page = await client.get<Paginated<Student>>('/students', { params: { limit: 25, offset: 0 } });
// page.items, page.total, page.limit, page.offset
```

Type lives in `frontend/src/lib/api/types.ts`:

```ts
export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
```

---

## 9. Correlation ID

- **Header name**: `x-correlation-id` (lowercase).
- **Frontend behavior**: `client.ts` generates a UUIDv4 per request unless caller provides one in `options.headers['x-correlation-id']`.
- **Backend behavior**: middleware echoes the inbound id back in the response. If absent, backend generates one. The id is added to all log scopes (App Insights) for that request.
- **Why**: end-to-end tracing without correlation infrastructure cost.

---

## 10. Auth header

- **Header**: `Authorization: Bearer <jwt>`
- JWT comes from Clerk (RS256, validated via JWKS public endpoint).
- **Required claims** (configured in Clerk JWT template):
  - `sub` → `clerkUserId`
  - `email` → audit user email
  - `name` → audit user displayName
  - `role` → role gate (`admin` in v1; `seller`/`teacher` post-MVP)
- Health endpoint `/api/v1/health` is **anonymous** (no JWT required). Contract: `04-api-design.md` §5.9.

---

## 11. Soft delete

- **`DELETE /resource/{id}`** = soft delete → sets `active=false`, populates `deletedAt`/`deletedBy`. Returns `204 No Content`.
- **Restore** = `PUT /resource/{id}` with `active: true` in body.
- **List endpoints** default to `active=true` only. Opt-in: `?includeInactive=true`.
- Soft-deleted records still appear via direct GET `/resource/{id}` (returns 200 + `active: false`).

---

## 12. Required response headers

Every response includes:

- `content-type: application/json` (or `application/problem+json` for errors)
- `x-correlation-id: <uuid>`

PUT/DELETE on etag-tracked entities also include refreshed `_etag` inside the JSON body.

---

## 13. OpenAPI

- Backend auto-generates `openapi.json` at build time. Output: `backend/artifacts/openapi.json`.
- Frontend regenerates `frontend/src/lib/api/types.gen.ts` via `pnpm api:types`.
- Pipeline details: `docs/06-openapi-pipeline.md`.
- **Rule**: `types.gen.ts` is consumed-only — never edit by hand. Manual types live in `types.ts` (BaseEntity, Paginated, ProblemDetails, etc.) for shapes not covered by an endpoint contract.

---

## 14. Versioning

- URI versioning: `/api/v1/...`.
- Breaking changes within v1 are NOT allowed once a milestone ships. Additive changes only.
- v2 lives at `/api/v2/...` when the time comes (post-MVP roles).

---

## 15. PUT full-replace policy — what's mutable

PUT semantics in this API are **full replacement** (decision #3 in `04-api-design.md`). The client sends the entire entity. The server enforces a **whitelist of mutable fields** per entity. Fields outside the whitelist are **silently ignored** (NOT 400/422) — this keeps the front simple (it can `PUT entity` after a `GET entity` without scrubbing fields).

### 15.1 Universally immutable on PUT (any entity)

These are NEVER mutated via PUT, regardless of what the client sends:

| Field | Source | Notes |
|---|---|---|
| `id` | server (POST only) | GUID assigned at creation. PUT preserves it. |
| `type` | server | Discriminator. Set by repository on insert based on entity type. |
| `dedupKey` | server (Student/Teacher repos) | Auto-derived from `docType + docNumber`. |
| `createdAt` | server (POST only) | |
| `createdBy` | server (POST only) | `AuditUser` snapshot. Never re-snapshotted. |
| `_etag` | Cosmos | Server-managed. Client sends current value via `If-Match` header (where applicable). |

### 15.2 Server-managed on PUT (any entity)

These ARE updated by the server on every PUT (client-supplied values ignored):

| Field | Behavior |
|---|---|
| `updatedAt` | Set to `DateTimeOffset.UtcNow.ToString("O")`. |
| `updatedBy` | Re-snapshotted from current `ClaimsPrincipal`. |

### 15.3 `active` field — restore via PUT

`active` IS mutable via PUT — this is the documented "restore" path (cheatsheet §11):

- `active: true` on a soft-deleted entity restores it. Server clears `deletedAt` + `deletedBy` to `null` in the same write.
- `active: false` via PUT is **NOT supported** (returns 422 `validation` with message "Use DELETE to soft-delete an entity"). Forces clean separation between PUT (edit/restore) and DELETE (soft-delete) semantics.
- `deletedAt`, `deletedBy` are server-managed: set on DELETE, cleared on PUT-with-restore. Client values ignored.

### 15.4 Frozen snapshot fields (entity-specific)

Some snapshots are intentionally frozen and ignored on PUT (see `04-api-design.md` §4.2):

| Entity | Frozen fields |
|---|---|
| `StudentPayment` | `studentId`, `studentName`, `scheduleId`, `scheduleName` (set at POST from enrollment lookup, NEVER refreshed) |
| `TeacherPayment` | `teacherName`, `teacherDoc` (snapshot from teacher at POST) |
| `Expense` | `scheduleName` if `scheduleId` present (snapshot at POST) |

If the client sends different values for these, server silently keeps the original.

### 15.5 Refreshed snapshot fields on PUT (entity-specific)

These ARE re-snapshotted on PUT from the current source-of-truth doc:

| Entity | Field | Source |
|---|---|---|
| `Schedule` | `teacherName` | Read from current `Teacher` doc by `teacherId` |
| `Enrollment` | `studentName`, `studentDoc` | From `Student` doc |
| `Enrollment` | `scheduleName`, `schedulePrice` | From `Schedule` doc |

Stale acceptable in v1 (only refreshes when admin saves).

### 15.6 Frontend pattern

```ts
// Safe pattern: GET, mutate, PUT — server scrubs immutables
const student = await getStudent(id);
student.firstName = 'New';
await putStudent(id, student); // server ignores id/type/dedupKey/createdAt/etc.
```

No need to manually strip server-managed fields. The contract is "PUT what you got back from GET, with your edits applied".

---

## 16. Quick reference table

| Topic | Decision |
|---|---|
| Casing on wire | camelCase |
| Date format | `YYYY-MM-DD` string |
| Time format | `HH:mm` string |
| Timestamp format | ISO 8601 UTC string |
| Enums on wire | camelCase string |
| Status enum language | English |
| Catalog item language | Spanish (user-editable) |
| Error format | RFC 7807 + ASP.NET `errors` for 422 |
| Concurrency | `_etag` + `If-Match` on Schedule, Enrollment PUT only |
| Pagination | `limit/offset` + `{items, total, limit, offset}` envelope |
| Correlation | `x-correlation-id` header, frontend generates UUIDv4 |
| Auth header | `Authorization: Bearer <clerk-jwt>` |
| Soft delete | `DELETE` → 204, `PUT active=true` to restore |
| OpenAPI | auto-generated, `types.gen.ts` consumed by frontend |
| PUT scope | full replace; server ignores immutables (id, type, audit, dedupKey, frozen snapshots) — see §15 |
| Health | `GET /api/v1/health` anonymous, custom shape (NOT ProblemDetails) — see `04-api-design.md` §5.9 |
| CORS | `CORS_ORIGINS` env var; methods GET/POST/PUT/DELETE/OPTIONS; headers Authorization, Content-Type, x-correlation-id, If-Match — see `02-architecture.md` §8.1 |
| Validation | per-field rules in `01-domain-model.md` §12; failures → 422 `validation` |
| Errors per endpoint | `04-api-design.md` §8.5 |
