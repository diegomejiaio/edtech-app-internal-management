# API Design + Data Modeling — Espacio Pro v1

> Companion to `01-domain-model.md` and `02-architecture.md`.
> Closes design phase before code. Aligned with [Microsoft Web API Design Best Practices](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design).
>
> **For wire-level conventions** (casing, dates, enums, errors, etag, correlation, pagination envelope): see **`07-api-contract-cheatsheet.md`**. This document covers endpoint catalog, query plans, and RU costs.

---

## 1. Decisions (locked)

| # | Decision | Rationale |
|---|---|---|
| 1 | **URI versioning** `/api/v1/{resource}` from day 0 | Cacheable, explicit routing, low cost now vs migration cost later when `seller`/`teacher` roles arrive. |
| 2 | **No HATEOAS** in v1 | Single internal client (own Next.js front) consumes typed API client. Hypermedia adds noise without value. RMM Level 2. |
| 3 | **PUT (full replace) only** for updates in v1 | Entities are small (≤10 fields). Front always has full doc in memory. PATCH added per-endpoint only when concurrent partial-edit pain appears. |
| 4 | **Pagination**: `?limit=25&offset=0`, max-limit=100, defaults always present. Response envelope `{items, total, limit, offset}` (cheatsheet §8). | MS recommended explicit. Cosmos continuation token wrapped behind offset for v1. |
| 5 | **Filtering**: flat query params (`?status=active&scheduleId=X`) | No DSL/OData. UI knows its filters. |
| 6 | **Sorting**: single field, `?sort=createdAt:desc` | Multi-sort = future work. |
| 7 | **No field selection** in v1 | Docs are small, no real over-fetching. |
| 8 | **Sync responses** (no async/202) | All ops < 100ms with Cosmos PK queries. |
| 9 | **Errors**: RFC 7807 Problem Details (`application/problem+json`). 422 includes ASP.NET-style `errors: { field: [msgs] }` map (cheatsheet §6). | Already in `02-architecture.md`. |
| 10 | **Correlation**: `x-correlation-id` accepted from client, generated if missing, propagated to logs and downstream (cheatsheet §9) | App Insights end-to-end tracing, zero cost. |
| 11 | **No multi-tenancy** | Single tenant per PRD. |
| 12 | **OpenAPI spec** auto-generated from .NET code | Contract-as-code, frontend consumes generated types. |
| 13 | **Soft delete** is a `DELETE` verb (returns 204). To restore, use `PUT` with `active: true`. | Keeps DELETE idiomatic. |
| 14 | **Default list filter**: `active=true` only. Opt-in `?includeInactive=true`. | Matches PRD M2/M3. |
| 15 | **JSON casing on wire**: camelCase always (cheatsheet §2). Status enums in English (`active`, `inProgress`, etc.). Catalog items in Spanish (user-editable). | Standard JSON convention + clear separation of code-level vs user-data. |
| 16 | **Date encoding** (cheatsheet §4): calendar dates `YYYY-MM-DD`, times `HH:mm`, timestamps ISO 8601 UTC. Frontend treats all as strings. | Round-trip safe, no timezone bugs. |
| 17 | **Concurrency control**: Cosmos `_etag` + `If-Match` enforced ONLY on `Schedule` and `Enrollment` PUT (cheatsheet §7). Other PUTs ignore `If-Match`. | Scoped to entities with realistic edit-conflict risk. |
| 18 | **Frontend list UX**: list pages use accumulated "Cargar más" pagination via React Query infinite queries over the v1 `limit/offset` contract. Cursor pagination remains future work if datasets grow. | Matches the MerkiCont UX pattern without changing the v1 backend contract. |

---

## 2. URI conventions

- Base: `https://<funcapp>.azurewebsites.net/api/v1`
- Resource collections: plural lowercase (`students`, `schedules`, `enrollments`, `student-payments`, `teacher-payments`, `expenses`, `catalogs`).
- Nested collections (resource composition, max 1 level deep per MS guidance):
  - `/api/v1/schedules/{id}/enrollments` — enrollments of a schedule
  - `/api/v1/students/{id}/enrollments` — enrollments of a student
  - `/api/v1/enrollments/{id}/payments` — payments of an enrollment
- **Operational endpoints** (non-resource, used sparingly per MS):
  - `/api/v1/schedules/{id}/dashboard` — composite view (BFF endpoint)
  - `/api/v1/student-payments/debtors?scheduleId=X&month=YYYY-MM` — debtors report

---

## 3. HTTP method conventions

| Method | Status codes used | Idempotent |
|---|---|---|
| `GET` collection | 200, 204 (empty), 400 | yes |
| `GET` item | 200, 404 | yes |
| `POST` collection | 201 (with `Location` header), 400, 409 (dup), 422 (validation) | no |
| `PUT` item | 200, 404, 409 (concurrent), 422 | yes |
| `DELETE` item | 204, 404, 409 (cannot delete: dependent active records) | yes |

**Always returned headers**:
- `x-correlation-id` (echoed or generated)
- `Content-Type: application/json` or `application/problem+json` for errors

---

## 4. Cosmos data modeling — denormalization strategy

### 4.1 Why denormalize

Cosmos NoSQL pushes denormalization for read efficiency. Joins are expensive (cross-partition fan-out). Snapshots embedded at write time eliminate read-time lookups.

### 4.2 Snapshot pattern

Each "foreign key" is paired with snapshot fields when the FK is shown in lists/details. The snapshot is **frozen at write time** of the owning doc and **NOT auto-refreshed** when the source changes.

| Owner doc | FK | Embedded snapshot fields | Refresh strategy |
|---|---|---|---|
| `Enrollment` | `studentId` | `studentName` (full name), `studentDoc` (`docType+docNumber`) | Refreshed on enrollment PUT. Stale acceptable for v1. |
| `Enrollment` | `scheduleId` | `scheduleName` (e.g. "Melamina · Intermedio · L-V 18:00"), `schedulePrice` | `scheduleName` refreshed on enrollment PUT. `schedulePrice` is the **negotiated price** (defaults to schedule price, editable, NOT auto-refreshed). |
| `StudentPayment` | `enrollmentId` | `studentName`, `studentId`, `scheduleId`, `scheduleName` | Frozen forever (payment is historical fact). |
| `TeacherPayment` | `teacherId` | `teacherName`, `teacherDoc` | Frozen forever. |
| `Expense` | `scheduleId?` | `scheduleName?` | Frozen forever. |
| `Schedule` | `teacherId` | `teacherName` | Refreshed on schedule PUT. |

**Trade-off**: when Student name is edited, existing Enrollments show old name until next PUT. Acceptable per PRD (audit pattern same as `AuditUser`).

### 4.3 Counters — NOT denormalized

`Schedule.enrolledActiveCount` stays **computed at read time** (not stored), per `01-domain-model.md`. Reason: maintaining live counter requires transactional consistency across containers (`master` ↔ `operations`) which Cosmos doesn't support without stored procs. Cost of a `COUNT` query on `enrollments` filtered by `scheduleId` is ~3 RU. Acceptable.

### 4.4 Composite keys for queries

To avoid cross-partition queries, leverage `/type` PK:

- All entities discriminate by `type` field → single-partition queries.
- For dashboard `enrollments by scheduleId`: query is single-partition (`type='enrollment'`) with `WHERE c.scheduleId=@id`. No issue at v1 scale.

---

## 5. Endpoints catalog (per entity)

Status codes follow §3. All collection endpoints support `?limit`, `?offset`, `?sort`, `?includeInactive`. Listed only domain-specific filters.

### 5.1 `/api/v1/catalogs`

| Method | URI | Description | Notes |
|---|---|---|---|
| GET | `/catalogs` | List all catalog docs (1 per code) | No pagination (≤10 docs) |
| GET | `/catalogs/{code}` | Get single catalog by code | `code` is unique (e.g. `paymentMethods`) |
| PUT | `/catalogs/{code}` | Replace items array | Body: `{ items: [{value, order, active}, ...] }` |
| POST | `/catalogs/{code}/items` | Append a new item | Body: `{value, order?}`. Returns 201. |
| DELETE | `/catalogs/{code}/items/{value}` | Soft-disable item (`active=false` inside array) | Returns 204. |

> Catalogs CRUD is per-item (not per-doc) because UI edits items, not whole catalog. Bulk PUT supported for power-edit.

### 5.2 `/api/v1/students`

| Method | URI | Filters | Notes |
|---|---|---|---|
| GET | `/students` | `?search=<name-or-doc>&docType=DNI` | Full-text on `firstName+lastName+docNumber` (LIKE in Cosmos) |
| GET | `/students/{id}` | — | Includes derived `enrollmentCount`, `lastPaymentDate` |
| POST | `/students` | — | Returns 409 if `docType+docNumber` already active |
| PUT | `/students/{id}` | — | Full replace |
| DELETE | `/students/{id}` | — | 409 if has active enrollments |
| GET | `/students/{id}/enrollments` | `?status=active` | List enrollments with snapshot of schedule |

### 5.3 `/api/v1/teachers`

| Method | URI | Filters | Notes |
|---|---|---|---|
| GET | `/teachers` | `?search=<name-or-doc>&specialty=...` | |
| GET | `/teachers/{id}` | — | |
| POST | `/teachers` | — | 409 if `docType+docNumber` dup |
| PUT | `/teachers/{id}` | — | |
| DELETE | `/teachers/{id}` | — | 409 if assigned to active schedule |
| GET | `/teachers/{id}/payments` | `?from=YYYY-MM-DD&to=YYYY-MM-DD` | |
| GET | `/teachers/{id}/schedules` | `?status=active` | |

### 5.4 `/api/v1/schedules`

| Method | URI | Filters | Notes |
|---|---|---|---|
| GET | `/schedules` | `?status=active&teacherId=X&course=Melamina&startDateFrom=YYYY-MM-DD&startDateTo=YYYY-MM-DD` | Each item includes `enrolledActiveCount`, `occupancyPct`, `teacherName` |
| GET | `/schedules/{id}` | — | Same composition |
| POST | `/schedules` | — | Validates `teacherId`, course/level/weekday catalogs, and generates sessions from course duration metadata |
| PUT | `/schedules/{id}` | — | Regenerates only when safe; 409 if existing attendance/finalized sessions would be overwritten |
| DELETE | `/schedules/{id}` | — | 409 if active enrollments |
| GET | `/schedules/{id}/enrollments` | `?status=active` | Includes derived `amount`, `paidAmount`, `pendingAmount` |
| GET | `/schedules/{id}/sessions` | `?limit=25&offset=0&from=YYYY-MM-DD&to=YYYY-MM-DD&status=scheduled` | Embedded generated sessions; load-more pagination |
| GET | `/schedules/{scheduleId}/sessions/{sessionId}` | — | Single generated session |
| PUT | `/schedules/{scheduleId}/sessions/{sessionId}` | `If-Match` | ETag-protected reschedule (date/time), status, attendance update; returns updated session plus schedule ETag |
| DELETE | `/schedules/{scheduleId}/sessions/{sessionId}` | `If-Match` | Soft-deletes one embedded session; reprojects `projectedEndDate`/`sessionCount` |
| GET | `/schedules/{id}/dashboard` | `?month=YYYY-MM` (default current) | **BFF**: composite of schedule + enrollments + paid/debtor flag per enrollment for the month |
| GET | `/sessions` | `?date=YYYY-MM-DD` (default today, America/Lima) | Cross-schedule: all active schedules' embedded sessions on a date, flattened with parent context (scheduleCode, scheduleStartDate, course, level, teacherName, time, status). Includes every status. Powers the Telegram agent's "clases de hoy" |

### 5.5 `/api/v1/enrollments`

| Method | URI | Filters | Notes |
|---|---|---|---|
| GET | `/enrollments` | `?studentId=X&scheduleId=Y&status=active` | Use nested URIs when possible |
| GET | `/enrollments/{id}` | — | Includes student + schedule snapshots |
| POST | `/enrollments` | — | 409 if `studentId+scheduleId+status=active+active=true` exists |
| PUT | `/enrollments/{id}` | — | Status transitions free |
| DELETE | `/enrollments/{id}` | — | Soft delete, payments preserved |
| GET | `/enrollments/{id}/payments` | `?from&to` | |

### 5.6 `/api/v1/student-payments`

| Method | URI | Filters | Notes |
|---|---|---|---|
| GET | `/student-payments` | `?enrollmentId=X&from=YYYY-MM-DD&to=YYYY-MM-DD&studentId=Y` | |
| GET | `/student-payments/{id}` | — | |
| POST | `/student-payments` | — | Validates `enrollmentId` exists+active |
| PUT | `/student-payments/{id}` | — | |
| DELETE | `/student-payments/{id}` | — | |
| GET | `/student-payments/debtors` | `?scheduleId=X&month=YYYY-MM` (both required) | **Operational endpoint**, see §6.2 |

### 5.7 `/api/v1/teacher-payments`

| Method | URI | Filters | Notes |
|---|---|---|---|
| GET | `/teacher-payments` | `?teacherId=X&from&to` | |
| GET | `/teacher-payments/{id}` | — | |
| POST | `/teacher-payments` | — | |
| PUT | `/teacher-payments/{id}` | — | |
| DELETE | `/teacher-payments/{id}` | — | |

### 5.8 `/api/v1/expenses`

| Method | URI | Filters | Notes |
|---|---|---|---|
| GET | `/expenses` | `?from&to&category=Materiales&scheduleId=X` | |
| GET | `/expenses/{id}` | — | |
| POST | `/expenses` | — | |
| PUT | `/expenses/{id}` | — | |
| DELETE | `/expenses/{id}` | — | |

---

### 5.9 `/api/v1/health` (anonymous)

| Method | URI | Notes |
|---|---|---|
| GET | `/health` | No JWT required. Used by smoke tests, uptime monitors, and operational checks. |

**Response shape (200)**:

```jsonc
{
  "status": "ok",
  "timestamp": "2026-05-10T14:23:11.123Z",
  "version": "1.0.0",
  "dependencies": {
    "cosmos": "ok"
  }
}
```

**Response shape (503)**:

```jsonc
{
  "status": "degraded",
  "timestamp": "2026-05-10T14:23:11.123Z",
  "version": "1.0.0",
  "dependencies": {
    "cosmos": "error: timeout after 2000ms"
  }
}
```

**Rules**
- `status` is `"ok"` if all dependencies pass; `"degraded"` if any fails. Never `"down"` (Function App reaching the handler proves the runtime is up).
- `version` reads from assembly version (`Assembly.GetExecutingAssembly().GetName().Version`).
- `dependencies.cosmos` performs a cheap `ReadAsync` on the database account (`CosmosClient.ReadAccountAsync()`) with a 2s timeout. Cost: ~1 RU.
- Returns **HTTP 200 with `status: "ok"`** when healthy.
- Returns **HTTP 503 with `status: "degraded"`** if any dependency check fails. Body still uses the same shape (NOT ProblemDetails — health is its own contract).
- Cached: NO. Each call hits Cosmos. Acceptable because the endpoint is hit infrequently (uptime monitors poll every 1-5 min).
- CORS: included in `CORS_ORIGINS` policy like any other endpoint.
- OpenAPI: documented like any other Function (`[OpenApiOperation]` + responses for 200/503).

---

### 5.10 `/api/v1/agent/threads` (internal — Telegram agent)

Persists the Telegram `chatId → Foundry threadId` mapping so the agent's conversation survives
Function worker recycles (the in-memory cache on Flex Consumption is volatile). Called only by the
Telegram agent via its `X-Agent-Key` admin bypass; all endpoints are `[RequireRole("admin")]`.

| Method | URI | Notes |
|---|---|---|
| GET | `/agent/threads/{chatId}` | Returns the persisted mapping or 404 (a missing mapping is expected for a new chat). |
| PUT | `/agent/threads/{chatId}` | Upserts the mapping; resets the native Cosmos TTL (sliding 7-day window). Body: `{ "threadId": "thread_..." }`. |
| DELETE | `/agent/threads/{chatId}` | Hard-deletes the mapping (idempotent). Triggered by the `/nuevo` reset command. |

**Storage**: `operations` container, `type = "agentThread"`, `id = chatId` (point-readable by key).

**Rules**
- Ephemeral state: stored with a native Cosmos `ttl` (604800s = 7 days) so idle mappings auto-expire.
  The `operations` container has `defaultTtl: -1` (TTL enabled, infinite default), so only documents
  that set their own `ttl` expire — existing business documents are unaffected.
- **Hard delete** (not soft delete): the mapping carries no audit value once the conversation is reset,
  so `/nuevo` removes the document instead of flagging `active = false`. This is the single intentional
  deviation from the soft-delete-only rule, justified by the document being ephemeral session state.
- Response shape (200): `{ "chatId": 123, "threadId": "thread_...", "updatedAt": "ISO-8601" }`.

---

## 6. Critical query designs

### 6.1 Schedule dashboard (`GET /schedules/{id}/dashboard?month=YYYY-MM`)

**Use case**: M9 dashboard. Single screen with schedule info + enrolled students + paid/debtor status for the month.

**Query plan**:
```
1. Q1: SELECT * FROM master c WHERE c.type='schedule' AND c.id=@id          [point read, ~1 RU]
2. Q2: SELECT * FROM operations c WHERE c.type='enrollment'
       AND c.scheduleId=@id AND c.status='active' AND c.active=true        [single-partition, ~3-5 RU]
3. Q3: SELECT c.enrollmentId, MAX(c.date) as lastDate
       FROM operations c WHERE c.type='studentPayment'
       AND c.enrollmentId IN (@e1, @e2, ...) AND c.active=true
       AND c.date >= @monthStart AND c.date <= @monthEnd
       GROUP BY c.enrollmentId                                              [single-partition, ~5-10 RU]
4. Q4: SELECT c.enrollmentId, SUM(c.amount) as totalAmount
       FROM operations c WHERE c.type='studentPayment'
       AND c.enrollmentId IN (@e1, @e2, ...) AND c.active=true
       GROUP BY c.enrollmentId                                              [single-partition, ~5-10 RU]
5. In-memory: join enrollments + payment dates + payment totals → response shape
```

**Response shape**:
```jsonc
{
  "schedule": { /* full schedule with teacherName snapshot */ },
  "month": "2026-05",
  "enrollments": [
    {
      "enrollmentId": "...",
      "studentId": "...",
      "studentName": "Diego Mejia",
      "studentDoc": "DNI 12345678",
      "amount": 250.00,
      "paidAmount": 150.00,
      "pendingAmount": 100.00,
      "paidThisMonth": true,
      "lastPaymentDate": "2026-05-03"
    },
    ...
  ],
  "summary": {
    "enrolled": 12,
    "paid": 9,
    "debtors": 3,
    "occupancyPct": 0.80,
    "sessions": 8,
    "completedSessions": 2,
    "pendingSessions": 6,
    "expectedAmount": 3000.00,
    "paidAmount": 2400.00,
    "pendingAmount": 600.00
  }
}
```

> Total ~15-25 RU per dashboard load. Cosmos serverless = ~$0 at this scale.

### 6.2 Debtors (`GET /student-payments/debtors?scheduleId=X&month=YYYY-MM`)

Subset of dashboard data. Same query plan steps 2-3, returns only `paidThisMonth=false` rows.

**Why separate endpoint**: documented in PRD M6 explicitly. Front may call it from a "debtor list" view that's not the full dashboard.

### 6.3 Student history (`GET /students/{id}/enrollments` + payments per enrollment)

**Use case**: M3 "ver historial".

**Query plan**:
```
1. Q1: SELECT * FROM operations c WHERE c.type='enrollment'
       AND c.studentId=@id                                                  [single-partition, ~5 RU]
2. Q2 (lazy, per enrollment expanded by user): GET /enrollments/{id}/payments
```

Front renders enrollments collapsed; expand on click → fires Q2. Avoids fan-out.

---

## 7. Vista UI → Endpoint → Query mapping

| Vista frontend | Endpoint(s) llamado(s) | Cosmos queries | RU estimado |
|---|---|---|---|
| Login (Clerk hosted) | — | — | 0 |
| Dashboard horario | `GET /schedules?status=active&startDateFrom=YYYY-MM-DD&startDateTo=YYYY-MM-DD` (selector) + `GET /schedules/{id}/dashboard?month=...` | 3 queries | ~15 RU |
| Listar alumnos | `GET /students?search=...&limit=25` | 1 query | ~5 RU |
| Detalle alumno | `GET /students/{id}` + `GET /students/{id}/enrollments` | 2 queries | ~8 RU |
| Crear inscripción | `POST /enrollments` (incluye dedup check server-side) | 1 query (existence) + 1 insert | ~10 RU |
| Crear pago alumno | `POST /student-payments` | 1 insert | ~5 RU |
| Listar deudores | `GET /student-payments/debtors?...` | 2 queries | ~10 RU |
| Listar horarios | `GET /schedules?status=active` | 1 query (con teacherName snapshot, sin extra lookup) | ~5 RU |
| Crear horario | `POST /schedules` | 1 insert (valida teacher existe en `master`) | ~6 RU |
| Listar profesores | `GET /teachers` | 1 query | ~5 RU |
| Crear pago profesor | `POST /teacher-payments` | 1 insert | ~5 RU |
| Catálogos (config screen) | `GET /catalogs` | 1 query | ~3 RU |
| Editar catálogo | `PUT /catalogs/{code}` | 1 replace | ~5 RU |

**Cost ceiling**: típica sesión admin de 10 min ≈ 200-300 RU. Cosmos serverless cobra ~$0.25 por millón de RU → **una sesión cuesta < $0.0001**.

---

## 8. OpenAPI specification

See **`docs/06-openapi-pipeline.md`** for the full generator pipeline (backend MSBuild target → `backend/artifacts/openapi.json` → frontend `openapi-typescript` → `types.gen.ts`).

Key rules:
- Every `[Function]` MUST have `[OpenApiOperation]`, `[OpenApiParameter]`, `[OpenApiRequestBody]` (when applicable), and `[OpenApiResponseWithBody]` for every documented status code.
- `types.gen.ts` is consumed-only on frontend — never hand-edit.
- Spec served at runtime at `/api/openapi/v3.json` (no auth).

---

## 8.5 Errors per endpoint (canonical map)

Extends cheatsheet §6.3 (canonical `type` URIs). For every endpoint, the table below lists the **specific** error responses it can return beyond the always-applicable ones.

**Always applicable to authenticated endpoints** (omit from per-endpoint tables):
- `401` `urn:espaciopro:problem:unauthorized` — missing/invalid/expired JWT
- `403` `urn:espaciopro:problem:forbidden` — JWT valid, role ≠ `admin`
- `500` `urn:espaciopro:problem:internal` — unhandled

**Always applicable to write endpoints (POST/PUT)**:
- `400` `urn:espaciopro:problem:bad-request` — malformed JSON / missing Content-Type
- `422` `urn:espaciopro:problem:validation` — field-level validation failure (see `01-domain-model.md` §12)

**Always applicable to PUT/DELETE on Schedule/Enrollment** (etag-tracked, see cheatsheet §7):
- `412` `urn:espaciopro:problem:precondition-failed` — `If-Match` header mismatch

### 8.5.1 Catalogs

| Endpoint | Status | Type URI | When |
|---|---|---|---|
| `GET /catalogs` | — | — | Always 200 (empty array if cold) |
| `GET /catalogs/{code}` | 404 | `not-found` | Catalog code does not exist |
| `PUT /catalogs/{code}` | 404 | `not-found` | Catalog code does not exist |
| `POST /catalogs/{code}/items` | 404 | `not-found` | Catalog code does not exist |
| `POST /catalogs/{code}/items` | 409 | `duplicate` | `value` already exists in catalog (case-insensitive) |
| `DELETE /catalogs/{code}/items/{value}` | 404 | `not-found` | Catalog code OR item value not found |

### 8.5.2 Students

| Endpoint | Status | Type URI | When |
|---|---|---|---|
| `GET /students/{id}` | 404 | `not-found` | Student id does not exist |
| `POST /students` | 409 | `duplicate` | `(docType, docNumber)` already exists active |
| `PUT /students/{id}` | 404 | `not-found` | id does not exist |
| `PUT /students/{id}` | 409 | `duplicate` | `(docType, docNumber)` change collides with another active student |
| `DELETE /students/{id}` | 404 | `not-found` | id does not exist |
| `DELETE /students/{id}` | 409 | `dependent-records` | Student has ≥1 active enrollment |

### 8.5.3 Teachers

| Endpoint | Status | Type URI | When |
|---|---|---|---|
| `GET /teachers/{id}` | 404 | `not-found` | id does not exist |
| `POST /teachers` | 409 | `duplicate` | `(docType, docNumber)` already exists active |
| `PUT /teachers/{id}` | 404 | `not-found` | id does not exist |
| `PUT /teachers/{id}` | 409 | `duplicate` | dedup collision on update |
| `DELETE /teachers/{id}` | 404 | `not-found` | id does not exist |
| `DELETE /teachers/{id}` | 409 | `dependent-records` | Teacher assigned to a Schedule with `status` ∈ {`active`, `inProgress`} |

### 8.5.4 Schedules

| Endpoint | Status | Type URI | When |
|---|---|---|---|
| `GET /schedules/{id}` | 404 | `not-found` | id does not exist |
| `POST /schedules` | 422 | `validation` | `teacherId` not found OR not active (errors map: `{ teacherId: [...] }`) |
| `PUT /schedules/{id}` | 404 | `not-found` | id does not exist |
| `DELETE /schedules/{id}` | 404 | `not-found` | id does not exist |
| `DELETE /schedules/{id}` | 409 | `dependent-records` | Schedule has ≥1 active enrollment |
| `GET /schedules/{id}/dashboard` | 404 | `not-found` | Schedule id does not exist |
| `GET /schedules/{id}/dashboard` | 422 | `validation` | `month` malformed |

### 8.5.5 Enrollments

| Endpoint | Status | Type URI | When |
|---|---|---|---|
| `GET /enrollments/{id}` | 404 | `not-found` | id does not exist |
| `POST /enrollments` | 409 | `duplicate` | `(studentId, scheduleId)` already has an `active+active=true` enrollment |
| `POST /enrollments` | 422 | `validation` | `studentId` or `scheduleId` not found / inactive |
| `PUT /enrollments/{id}` | 404 | `not-found` | id does not exist |
| `DELETE /enrollments/{id}` | 404 | `not-found` | id does not exist |
| `DELETE /enrollments/{id}` | — | — | Soft delete always succeeds (payments preserved). |

### 8.5.6 Student Payments

| Endpoint | Status | Type URI | When |
|---|---|---|---|
| `GET /student-payments/{id}` | 404 | `not-found` | id does not exist |
| `POST /student-payments` | 422 | `validation` | `enrollmentId` not found / inactive, or `receiptNumber` missing when `hasReceipt=true` |
| `PUT /student-payments/{id}` | 404 | `not-found` | id does not exist |
| `DELETE /student-payments/{id}` | 404 | `not-found` | id does not exist |
| `GET /student-payments/debtors` | 422 | `validation` | `scheduleId` or `month` missing/malformed |

### 8.5.7 Teacher Payments

| Endpoint | Status | Type URI | When |
|---|---|---|---|
| `GET /teacher-payments/{id}` | 404 | `not-found` | id does not exist |
| `POST /teacher-payments` | 422 | `validation` | `teacherId` not found / inactive |
| `PUT /teacher-payments/{id}` | 404 | `not-found` | id does not exist |
| `DELETE /teacher-payments/{id}` | 404 | `not-found` | id does not exist |

### 8.5.8 Expenses

| Endpoint | Status | Type URI | When |
|---|---|---|---|
| `GET /expenses/{id}` | 404 | `not-found` | id does not exist |
| `POST /expenses` | 422 | `validation` | `category` / `paymentMethod` not in catalog, or `scheduleId` (when present) not found |
| `PUT /expenses/{id}` | 404 | `not-found` | id does not exist |
| `DELETE /expenses/{id}` | 404 | `not-found` | id does not exist |

### 8.5.9 Health

| Endpoint | Status | Type URI | When |
|---|---|---|---|
| `GET /health` | 503 | (custom shape, NOT ProblemDetails — see §5.9) | Any dependency check fails |

---

## 9. Open items (resolve in M0/M1)

- **Concurrency control**: scope locked to `Schedule` and `Enrollment` PUT (cheatsheet §7). Other PUTs ignore `If-Match`. Implementation: backend reads `_etag` from JSON body or `If-Match` header, passes to Cosmos `ItemRequestOptions.IfMatchEtag`, maps Cosmos `412 PreconditionFailed` to HTTP 412 with `urn:espaciopro:problem:precondition-failed`.
- **Bulk operations**: PRD no las pide. Si surgen (ej: bulk import de alumnos), endpoint dedicado tipo `POST /students/batch` con body `{items: [...]}` y response `{created, errors}`.
- **Rate limiting**: no aplica v1 (single client interno). Function App Consumption tiene límites naturales.

---

## 10. Future work (post-v1)

- HATEOAS si llegan 3rd party clients.
- PATCH (JSON Merge Patch) para campos hot (`Schedule.status`).
- GraphQL si emerge dolor real de over-fetching con múltiples roles + clientes.
- WebHooks para notificar al front de cambios (SignalR / Azure Web PubSub).
- Field selection (`?fields=id,name`) si dashboards crecen en complejidad.
