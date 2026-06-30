# Domain Model — Espacio Pro v1

> Source of truth for entities, fields, business rules and ES/EN glossary.
> Derived from GAS audit + PRD decisions.
> API surface and denormalization strategy: `04-api-design.md`.

---

## 1. Glossary ES ↔ EN

| ES (UI) | EN (code, API, DB) |
|---------|--------------------|
| Alumno | Student |
| Profesor | Teacher |
| Horario | Schedule |
| Inscripción | Enrollment |
| Pago de alumno | StudentPayment |
| Pago de profesor | TeacherPayment |
| Gasto | Expense |
| Catálogo / Datos Maestros | Catalog |
| Curso | Course (catalog item) |
| Nivel | Level (catalog item) |
| Medio de pago | Payment method |
| Categoría de gasto | Expense category |
| Estado | Status |
| Cuota | Installment |
| Boleta / N° Boleta | Receipt / Receipt number |
| Fuente | Source |
| Día (semana) | Weekday |
| Activo (soft delete flag) | Active |
| Deudor | Debtor |

---

## 2. Common fields (every entity)

All entities inherit from `BaseEntity`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` (GUID) | Generated in backend |
| `type` | `string` | Discriminator + Cosmos partition key |
| `active` | `bool` | Soft delete (`false` = deleted) |
| `createdAt` | `string` (ISO 8601 UTC) | Set on insert |
| `createdBy` | `AuditUser` | Snapshot of user at insert time |
| `updatedAt` | `string` (ISO 8601 UTC) | Set on every update |
| `updatedBy` | `AuditUser` | Snapshot of user at last update |
| `deletedAt` | `string?` (ISO 8601 UTC) | Set when `active` flips to `false` |
| `deletedBy` | `AuditUser?` | Snapshot at soft-delete time |

### `AuditUser` (value object — embedded snapshot)

```jsonc
{
  "clerkUserId": "user_2abc...",
  "email": "diego@espaciopro.pe",
  "displayName": "Diego Mejia"
}
```

**Why snapshot, not reference**: zero calls to Clerk Backend API (= no Secret Key = no Key Vault in v1). If user changes their name in Clerk later, historical records keep the old name — this is **standard audit behavior**, not a bug.

**Population**: backend `AuditContext` extracts these from the `ClaimsPrincipal` derived from the Clerk JWT. Repositories set `createdBy/updatedBy/deletedBy` automatically — domain code never writes them manually.

**Required JWT claims** (configure in Clerk JWT template):
- `sub` → `clerkUserId`
- `email` → `email`
- `name` → `displayName`

---

## 3. Entities

### 3.1 Catalog (`type: "catalog"`) — container `master`

One document per catalog. F1 model: items as inline array.

```jsonc
{
  "id": "<guid>",
  "type": "catalog",
  "code": "paymentMethods",
  "items": [
    { "value": "Yape", "order": 1, "active": true, "metadata": null },
    { "value": "Transferencia", "order": 2, "active": true },
    { "value": "Efectivo", "order": 3, "active": true }
  ],
  "active": true,
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Catalog codes seeded at install** (legacy GAS catalogs plus v1 UI catalogs):

| code | Initial items |
|------|---------------|
| `courses` | Melamina, Drywall |
| `levels` | Principiante, Intermedio, Profesional |
| `spaces` | Empty at seed; admin adds classroom/workshop spaces from UI |
| `paymentMethods` | Yape, Transferencia, Efectivo |
| `expenseCategories` | Materiales, Alquiler, Marketing, Servicios, Equipos, Otros |
| `enrollmentStatuses` | (NOT a catalog — domain enum `EnrollmentStatus`: `active`, `completed`, `cancelled`, `pending`. Removed from catalogs.) |
| `scheduleStatuses` | (NOT a catalog — domain enum `ScheduleStatus`: `active`, `inProgress`, `finished`, `cancelled`. Removed from catalogs.) |
| `weekdays` | L, Ma, Mi, J, V, S, D, LMiV, MaJ, L-V, SD |
| `studentSources` | Instagram, Tiktok, Referido, Facebook |

`courses` items may include `metadata.durationHoursByLevel`, e.g.
`{ "durationHoursByLevel": { "Principiante": 16, "Intermedio": 24, "Profesional": 32 } }`.
Schedules use this metadata to generate bounded class sessions from course duration.

> Catalog items can be added/edited/disabled via UI. **Status values are NOT catalogs in v1** — they are code-level enums (`EnrollmentStatus`, `ScheduleStatus`) with English values on the wire (see `07-api-contract-cheatsheet.md` §5). UI translates them to Spanish via i18n map. Reason: status transitions are tied to business rules (debtors query, dashboard filters) — making them editable would break those rules silently.

---

### 3.2 Student (`type: "student"`) — container `master`

```jsonc
{
  "id": "<guid>",
  "type": "student",
  "code": "EST-7Q3K9",        // short business code, auto-generated on create (read-only)
  "firstName": "string",
  "lastName": "string",
  "docType": "dni" | "ce" | "passport",
  "docNumber": "string",
  "phone": "string?",
  "email": "string?",
  "source": "string?",        // catalog studentSources
  "notes": "string?",
  "active": true
}
```

**Rules**
- Dedup: `docType + docNumber` unique among `active=true`. On create, returns **409 Conflict** (`urn:espaciopro:problem:duplicate`) per `04-api-design.md` §5.2. Cosmos enforces via container unique key over `/dedupKey` (synthetic field, see `02-architecture.md` §10.1).
- `dedupKey` is **populated automatically by the repository** as `"student:<docType>:<docNumber>"`. Never set by domain code or in the API payload (read-only on the wire).
- Soft delete only.
- `docNumber` validation (server-side, returns 422 on fail):
  - `dni`: exactly 8 digits, `^\d{8}$`.
  - `ce`: 9–20 alphanumerics, `^[A-Za-z0-9]{9,20}$`.
  - `passport`: 6–20 alphanumerics, `^[A-Za-z0-9]{6,20}$`.
- `email` (when present): RFC 5322 minimal regex.
- `phone` (when present): free-form, server stores as-is. UI may normalize.

---

### 3.3 Teacher (`type: "teacher"`) — container `master`

```jsonc
{
  "id": "<guid>",
  "type": "teacher",
  "code": "PRO-7Q3K9",        // short business code, auto-generated on create (read-only)
  "firstName": "string",
  "lastName": "string",
  "docType": "dni" | "ce" | "passport",
  "docNumber": "string",
  "phone": "string?",
  "email": "string?",
  "specialty": "string?",
  "clerkUserId": "string?",   // populated post-MVP for teacher login
  "active": true
}
```

**Rules**
- `docType + docNumber` unique among `active=true`. Same `dedupKey` strategy as Student (`02-architecture.md` §10.1) — repository auto-populates `dedupKey = "teacher:<docType>:<docNumber>"`. Same `docNumber` validation regex as Student (see §3.2).
- Soft delete only. Active teachers cannot be deleted if assigned to a `Schedule` with `status` in (`active`, `inProgress`).

---

### 3.4 Schedule (`type: "schedule"`) — container `master`

```jsonc
{
  "id": "<guid>",
  "type": "schedule",
  "code": "HOR-7Q3K9",         // short business code, auto-generated on create (read-only)
  "course": "string",         // catalog courses
  "level": "string",          // catalog levels
  "teacherId": "<guid>",
  "teacherName": "string",    // snapshot, refreshed on PUT
  "weekdays": "string",       // catalog weekdays (e.g. "L-V")
  "startTime": "HH:mm",
  "endTime": "HH:mm",
  "price": number,
  "capacity": number,
  "status": "active" | "inProgress" | "finished" | "cancelled",
  "startDate": "YYYY-MM-DD",
  "courseDurationHours": 16,
  "projectedEndDate": "YYYY-MM-DD",
  "sessions": [
    {
      "id": "<guid>",
      "sequenceNumber": 1,
      "date": "YYYY-MM-DD",
      "startTime": "HH:mm",
      "endTime": "HH:mm",
      "status": "scheduled" | "completed" | "cancelled",
      "attendance": [
        {
          "enrollmentId": "<guid>",
          "studentId": "<guid>",
          "studentName": "string",
          "status": "pending" | "present" | "absent" | "late",
          "notes": "string?"
        }
      ],
      "active": true
    }
  ],
  "active": true
}
```

**Computed at read time** (not stored):
- `enrolledActiveCount` = count of `Enrollment` with `scheduleId=this.id AND status='active' AND active=true`
- `occupancyPct` = `enrolledActiveCount / capacity`
- `sessionCount` = count of active embedded sessions.

**Short business code (`code`)**
- Human-friendly unique identifier (e.g. `HOR-7Q3K9`) generated server-side on create, **read-only on the wire**. Distinct from the GUID `id`; used in the UI and by the Telegram agent to refer to a schedule unambiguously.
- Format: prefix `HOR-` + 5 [Crockford Base32](https://www.crockford.com/base32.html) characters (digits + uppercase letters, excluding `I`, `L`, `O`, `U` to avoid visual/typing ambiguity). Generated by the reusable `ShortCodeGenerator` (`EspacioPro.Domain.Common`) — designed so other entities can adopt the same scheme.
- Uniqueness is enforced atomically: the repository overrides `dedupKey = code`, so the `master` container's unique key on `/dedupKey` rejects collisions. Generation pre-probes existing codes (including soft-deleted) and retries on collision. Legacy schedules created before `code` existed fall back to `dedupKey = id` and are backfilled via the seed tool (`--backfill-codes`).

**Session generation**
- On schedule create, sessions are generated from `courseDurationHours`, `weekdays`, `startDate`, `startTime`, and `endTime`.
- `sessionsNeeded = ceil(courseDurationHours / (endTime - startTime))`.
- Date walking starts at `startDate` and includes only days matched by the canonical weekday code.
- `projectedEndDate` is the last active generated session date.
- Regeneration on timing/course changes is rejected with 409 when existing sessions are completed/cancelled or have recorded attendance.

---

### 3.5 Enrollment (`type: "enrollment"`) — container `operations`

```jsonc
{
  "id": "<guid>",
  "type": "enrollment",
  "code": "INS-7Q3K9",        // short business code, auto-generated on create (read-only)
  "studentId": "<guid>",
  "studentName": "string",      // snapshot (denorm), refreshed on PUT
  "studentDoc": "string",       // snapshot "DNI 12345678"
  "scheduleId": "<guid>",
  "scheduleName": "string",     // snapshot "Melamina · Intermedio · L-V 18:00"
  "schedulePrice": number,      // negotiated price (defaults to schedule price, editable; NOT auto-refreshed)
  "enrollmentDate": "YYYY-MM-DD",
  "status": "active" | "completed" | "cancelled" | "pending",
  "active": true
}
```

> Snapshots `studentName/studentDoc/scheduleName` evitan joins en el dashboard. Se refrescan cuando se hace `PUT /enrollments/{id}`. Stale aceptable (mismo patrón que `AuditUser`). **`schedulePrice` es el precio negociado de la inscripción** (lo que el alumno debe): toma por defecto el precio del horario al crear, es **editable** (descuentos/packs) y **NO** se auto-refresca desde el horario. Detalle: `04-api-design.md` §4.

**Computed at read time** (not stored):
- `amount` = `schedulePrice` snapshot.
- `paidAmount` = sum of active `StudentPayment.amount` for the enrollment across all dates.
- `pendingAmount` = `max(amount - paidAmount, 0)`.

**Rules**
- On create: reject if exists `Enrollment` with same `studentId + scheduleId AND status='active' AND active=true`. (NEW vs GAS — GAS no validaba.)
- Status transitions: free (admin can set any). Audit log out of scope v1.
- Soft delete keeps payments addressable.

---

### 3.6 StudentPayment (`type: "studentPayment"`) — container `operations`

```jsonc
{
  "id": "<guid>",
  "type": "studentPayment",
  "code": "PAG-7Q3K9",        // short business code, auto-generated on create (read-only)
  "enrollmentId": "<guid>",
  "studentId": "<guid>",         // snapshot, frozen
  "studentName": "string",       // snapshot, frozen (historical record)
  "scheduleId": "<guid>",        // snapshot, frozen
  "scheduleName": "string",      // snapshot, frozen
  "date": "YYYY-MM-DD",
  "amount": number,
  "installmentNumber": number,   // free, not auto-calculated
  "paymentMethod": "string",     // catalog paymentMethods
  "hasReceipt": boolean,
  "receiptNumber": "string?",
  "notes": "string?",
  "active": true
}
```

> Snapshots aquí son **frozen forever** — un pago es un hecho histórico, no se actualiza si el alumno cambia de nombre.

**Rules**
- Partial payments allowed (multiple records same `installmentNumber` if needed — UI warns).
- Refund / void out of scope v1; usar soft delete + nota.

**Debtors query (M6 endpoint):**

Given `scheduleId` and `month` (YYYY-MM):

```
debtors = Enrollments E
  WHERE E.scheduleId = scheduleId
    AND E.status = 'active'
    AND E.active = true
    AND NOT EXISTS (
      StudentPayment P
        WHERE P.enrollmentId = E.id
          AND P.active = true
          AND P.date BETWEEN monthStart AND monthEnd
    )
```

Each debtor row returns: `enrollmentId, studentId, studentFullName, lastPaymentDate?`.

---

### 3.7 TeacherPayment (`type: "teacherPayment"`) — container `operations`

```jsonc
{
  "id": "<guid>",
  "type": "teacherPayment",
  "code": "PTP-7Q3K9",        // short business code, auto-generated on create (read-only)
  "teacherId": "<guid>",
  "teacherName": "string",       // snapshot, frozen
  "teacherDoc": "string",        // snapshot, frozen
  "date": "YYYY-MM-DD",
  "amount": number,
  "concept": "string",
  "paymentMethod": "string",
  "notes": "string?",
  "active": true
}
```

No FK a `Schedule` (decisión heredada del GAS).

---

### 3.8 Expense (`type: "expense"`) — container `operations`

```jsonc
{
  "id": "<guid>",
  "type": "expense",
  "code": "GAS-7Q3K9",        // short business code, auto-generated on create (read-only)
  "date": "YYYY-MM-DD",
  "category": "string",        // catalog expenseCategories
  "description": "string",
  "amount": number,
  "paymentMethod": "string",   // catalog paymentMethods
  "scheduleId": "<guid>?",     // optional imputation
  "scheduleName": "string?",   // snapshot, frozen
  "notes": "string?",
  "active": true
}
```

---

## 4. Origen de cada entidad (audit GAS → web)

| Entidad | GAS sheet | Cambios web |
|---------|-----------|-------------|
| Catalog | `Datos Maestros` (8 columnas paralelas) | Modelado como 1 doc por catálogo. Editable desde UI. |
| Student | `Alumnos` | Split `Nombre` → `firstName/lastName`. `DNI` → `docType + docNumber`. Add `notes`. |
| Teacher | `Profesores` | Igual split. Add `clerkUserId?` para post-MVP. |
| Schedule | `Horarios` | 4 estados (vs solo Activo/Inactivo del PRD original). Sin formula `Cantidad de inscritos` — se calcula en query. |
| Enrollment | `Inscripciones` | **NUEVO**: validación duplicado activo. |
| StudentPayment | `Pagos` | `Boleta (Sí/No)` → `hasReceipt: bool`. Mantiene `receiptNumber`. |
| TeacherPayment | `Pagos Profesores` | Sin cambios estructurales. |
| Expense | `Gastos` | Sin cambios estructurales. |

---

## 5. Capabilities NEW vs GAS (mandatorias v1)

- Edit + soft delete de Students, Teachers, Enrollments (GAS solo creaba)
- Validación duplicado inscripción activa (GAS no validaba)
- Catálogos editables vía UI con CRUD (GAS requería editar el Sheet a mano)
- Clerk auth con roles preparado para escalar
- Snapshots denormalizados en operations (`Enrollment.studentName/scheduleName`, etc.) para queries single-partition sin joins. Detalle: `04-api-design.md` §4.

---

## 6. Capabilities REMOVED vs GAS

- Dashboard global no se construye en v1 (solo por-horario, igual al GAS)
- ARRAYFORMULA columns calculadas: ahora todo es derived at query time
- Looker Studio dashboard: out of scope (queda el Sheet actual si lo siguen usando en paralelo)

---

## 7. Resolved (post-design phase)

- **Indexing policy** per container: defined in `02-architecture.md` §10.2 (custom excludes + composite indexes for hot queries).
- **Frontend catalog cache strategy**: 15-min in-memory TTL + per-code invalidation on CUD. Detail in `02-architecture.md` §10.3.

## 8. Closed (post-audit)

- **Cosmos unique key** strategy: container `master` has a unique key on `/dedupKey`. The repository auto-populates `dedupKey` per entity: `Student`/`Teacher` use `"<type>:<docType>:<docNumber>"`, `Catalog`/`Schedule` use their `code`. Entities without a natural business key default `dedupKey = id` (trivially unique). Detail and rationale: `02-architecture.md` §10.1. Validation in code returns `urn:espaciopro:problem:duplicate` 409 with field-level message on Cosmos collision.
- **Business codes (`code`)**: short, human-friendly, hard-to-confuse identifiers generated server-side on create (read-only on the wire), distinct from the GUID `id`. Format: `<PREFIX> + 5` [Crockford Base32](https://www.crockford.com/base32.html) chars (excludes `I`/`L`/`O`/`U`), via the reusable `ShortCodeGenerator` (`EspacioPro.Domain.Common`). Prefixes: `Schedule`=`HOR-`, `Student`=`EST-`, `Teacher`=`PRO-`, `Enrollment`=`INS-`, `StudentPayment`=`PAG-`, `TeacherPayment`=`PTP-`, `Expense`=`GAS-`. Uniqueness: `Schedule` is enforced atomically via `dedupKey` (master unique key); all other entities use generate + query-probe + retry (`master`'s `dedupKey` is taken by the doc identity for `Student`/`Teacher`; the `operations` container has no unique key). Existing rows are migrated idempotently with the seed tool's `--backfill-codes`.
- **Dev environment**: Cosmos cloud (mismo account que prod, DB lógica `espaciopro-dev`). Sin emulator.

---

## 9. Status enums (English on wire)

These are **code-level enums**, not user-editable catalogs. Wire format = camelCase string (see `07-api-contract-cheatsheet.md` §5). UI translates to Spanish via i18n map.

### `DocType`

| Wire | UI (ES) | Notes |
|---|---|---|
| `dni` | DNI | Peruvian national ID, 8 digits |
| `ce` | Carnet de Extranjería | Foreign resident card |
| `passport` | Pasaporte | International passport |

### `EnrollmentStatus`

| Wire | UI (ES) | Semantics |
|---|---|---|
| `active` | Activo | Currently enrolled, in progress |
| `completed` | Completado | Course/schedule finished successfully |
| `cancelled` | Cancelado | Withdrawn / dropped |
| `pending` | Pendiente | Reserved seat, not yet confirmed |

### `ScheduleStatus`

| Wire | UI (ES) | Semantics |
|---|---|---|
| `active` | Activo | Open for enrollment, not yet started |
| `inProgress` | En progreso | Classes currently running |
| `finished` | Finalizado | All classes completed |
| `cancelled` | Cancelado | Schedule cancelled before completion |

### Backend implementation

```csharp
public enum DocType { Dni, Ce, Passport }
public enum EnrollmentStatus { Active, Completed, Cancelled, Pending }
public enum ScheduleStatus { Active, InProgress, Finished, Cancelled }
```

Serialized via `JsonStringEnumConverter(JsonNamingPolicy.CamelCase)` registered globally (see cheatsheet §5).

### Frontend implementation

```ts
export const DocType = { Dni: 'dni', Ce: 'ce', Passport: 'passport' } as const;
export type DocType = typeof DocType[keyof typeof DocType];

export const EnrollmentStatus = {
  Active: 'active', Completed: 'completed', Cancelled: 'cancelled', Pending: 'pending'
} as const;
export type EnrollmentStatus = typeof EnrollmentStatus[keyof typeof EnrollmentStatus];

export const ScheduleStatus = {
  Active: 'active', InProgress: 'inProgress', Finished: 'finished', Cancelled: 'cancelled'
} as const;
export type ScheduleStatus = typeof ScheduleStatus[keyof typeof ScheduleStatus];
```

> These are auto-generated by `openapi-typescript` into `types.gen.ts` once endpoints are annotated. Hand-written mirror lives in `types.ts` for M0 (before any endpoint exists).

---

## 10. Type discriminators (canonical)

Cosmos partition key is `/type`. The core containers (`master`, `operations`) share the same scheme. **Values are camelCase singular** — no underscores, no plurals.

> Add-on modules introduce their own `type` values outside this core table:
> the Telegram agent uses `agentThread` (`operations`), and the WhatsApp CRM add-on
> uses `conversation`/`message`/`lead`/`waConfig` in a dedicated `whatsapp` container
> (see `04-api-design.md` §5.10–§5.11 and `10-whatsapp-crm-mvp.md`).

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

### Backend constants

```csharp
// EspacioPro.Domain/Common/EntityTypes.cs
public static class EntityTypes
{
    public const string Catalog        = "catalog";
    public const string Student        = "student";
    public const string Teacher        = "teacher";
    public const string Schedule       = "schedule";
    public const string Enrollment     = "enrollment";
    public const string StudentPayment = "studentPayment";
    public const string TeacherPayment = "teacherPayment";
    public const string Expense        = "expense";
}
```

### Frontend mirror

```ts
// frontend/src/lib/api/types.ts
export const EntityTypes = {
  Catalog:        'catalog',
  Student:        'student',
  Teacher:        'teacher',
  Schedule:       'schedule',
  Enrollment:     'enrollment',
  StudentPayment: 'studentPayment',
  TeacherPayment: 'teacherPayment',
  Expense:        'expense',
} as const;
export type EntityType = typeof EntityTypes[keyof typeof EntityTypes];
```

---

## 11. Wire conventions reference

For JSON casing, date formats, error envelopes, pagination, concurrency control, correlation, and OpenAPI pipeline: see **`07-api-contract-cheatsheet.md`** (single-page handshake). Anything contradicting that page is a bug.

---

## 12. Field validation rules (server-side, returns 422)

All validations run server-side in the Application layer (`EspacioPro.Application/Validators/`). Frontend SHOULD mirror them for UX, but server is the source of truth. Failures → `urn:espaciopro:problem:validation` with `errors: { field: [msgs] }` (cheatsheet §6.2).

### 12.1 String fields — common rules

| Field type | Rule | Notes |
|---|---|---|
| All strings | Trimmed before validation. Empty strings (`""`) treated as `null` for optional fields. | Server applies `.Trim()` once at DTO binding. Length validations run on trimmed value. |
| All strings | Reject control chars (U+0000–U+001F except `\t`, `\n`, `\r`). | Prevents log injection. |
| All required strings | Reject if `null`, empty, or whitespace-only. | |

### 12.2 Per-field validation

| Entity.Field | Required | Type | Rule | Error message (ES, for UI) |
|---|---|---|---|---|
| **Common to Student/Teacher** | | | | |
| `firstName` | yes | string | 1–80 chars trimmed | "El nombre es obligatorio (máx 80 caracteres)." |
| `lastName` | yes | string | 1–80 chars trimmed | "El apellido es obligatorio (máx 80 caracteres)." |
| `docType` | yes | enum | one of `dni`, `ce`, `passport` | "Tipo de documento inválido." |
| `docNumber` | yes | string | regex by `docType` (see below) | varies |
| `docNumber` if `docType=dni` | | | `^\d{8}$` | "El DNI debe tener exactamente 8 dígitos." |
| `docNumber` if `docType=ce` | | | `^[A-Za-z0-9]{9,20}$` | "El CE debe tener entre 9 y 20 caracteres alfanuméricos." |
| `docNumber` if `docType=passport` | | | `^[A-Za-z0-9]{6,20}$` | "El pasaporte debe tener entre 6 y 20 caracteres alfanuméricos." |
| `phone` | no | string | 0–20 chars; if present, regex `^[+\d\s\-()]{6,20}$` | "Teléfono inválido (6–20 caracteres, dígitos, espacios, +, -, paréntesis)." |
| `email` | no | string | RFC 5322 minimal: regex `^[^@\s]+@[^@\s]+\.[^@\s]+$`; max 254 chars | "Email inválido." |
| `notes` | no | string | 0–1000 chars | "Las notas no pueden exceder 1000 caracteres." |
| **Student-specific** | | | | |
| `source` | no | string | must exist as `value` in catalog `studentSources` (active item) | "Fuente inválida." |
| **Teacher-specific** | | | | |
| `specialty` | no | string | 0–100 chars | "Especialidad no puede exceder 100 caracteres." |
| `clerkUserId` | no | string | regex `^user_[A-Za-z0-9]+$` (Clerk format) | "ID de usuario Clerk inválido." |
| **Schedule** | | | | |
| `course` | yes | string | must exist in catalog `courses` (active) | "Curso inválido." |
| `level` | yes | string | must exist in catalog `levels` (active) | "Nivel inválido." |
| `teacherId` | yes | string (GUID) | regex GUID v4; teacher must exist + active | "Profesor inválido o inactivo." |
| `weekdays` | yes | string | must exist in catalog `weekdays` (active) | "Días inválidos." |
| `startTime` | yes | string | regex `^([01]\d|2[0-3]):[0-5]\d$` | "Hora de inicio inválida (HH:mm)." |
| `endTime` | yes | string | same regex; AND `endTime > startTime` (string compare works for `HH:mm`) | "Hora de fin debe ser mayor a hora de inicio." |
| `price` | yes | decimal | `>= 0`, max 2 decimal places, max value 999999.99 | "Precio inválido (≥ 0, hasta 2 decimales)." |
| `capacity` | yes | int | `>= 1`, `<= 200` | "Capacidad debe ser entre 1 y 200." |
| `status` | yes | enum | one of `active`, `inProgress`, `finished`, `cancelled` | "Estado de horario inválido." |
| `startDate` | yes | string | regex `^\d{4}-\d{2}-\d{2}$`, valid calendar date | "Fecha de inicio inválida (YYYY-MM-DD)." |
| **Enrollment** | | | | |
| `studentId` | yes | string (GUID) | exists + active | "Alumno inválido o inactivo." |
| `scheduleId` | yes | string (GUID) | exists + active | "Horario inválido o inactivo." |
| `enrollmentDate` | yes | string | YYYY-MM-DD; cannot be > today + 365 days | "Fecha de inscripción inválida." |
| `status` | yes | enum | one of `active`, `completed`, `cancelled`, `pending` | "Estado de inscripción inválido." |
| **StudentPayment** | | | | |
| `enrollmentId` | yes | string (GUID) | exists + active | "Inscripción inválida o inactiva." |
| `date` | yes | string | YYYY-MM-DD; `<= today + 1 day` (zona horaria buffer) | "Fecha de pago inválida." |
| `amount` | yes | decimal | `> 0`, max 2 decimal places, max value 999999.99 | "Monto debe ser mayor a 0 (hasta 2 decimales)." |
| `installmentNumber` | yes | int | `>= 1`, `<= 60` | "Número de cuota debe ser entre 1 y 60." |
| `paymentMethod` | yes | string | must exist in catalog `paymentMethods` (active) | "Medio de pago inválido." |
| `hasReceipt` | yes | bool | true/false | "Indicador de boleta inválido." |
| `receiptNumber` | conditional | string | required when `hasReceipt=true`; 1–50 chars; regex `^[A-Za-z0-9\-]+$` | "N° de boleta requerido cuando se marca 'tiene boleta'." |
| `notes` | no | string | 0–500 chars | "Notas no pueden exceder 500 caracteres." |
| **TeacherPayment** | | | | |
| `teacherId` | yes | string (GUID) | exists + active | "Profesor inválido o inactivo." |
| `date` | yes | string | YYYY-MM-DD; `<= today + 1 day` | "Fecha inválida." |
| `amount` | yes | decimal | `> 0`, max 2 decimal places, max value 999999.99 | "Monto debe ser mayor a 0." |
| `concept` | yes | string | 1–200 chars | "Concepto requerido (máx 200 caracteres)." |
| `paymentMethod` | yes | string | catalog `paymentMethods` (active) | "Medio de pago inválido." |
| `notes` | no | string | 0–500 chars | |
| **Expense** | | | | |
| `date` | yes | string | YYYY-MM-DD; `<= today + 1 day` | "Fecha inválida." |
| `category` | yes | string | catalog `expenseCategories` (active) | "Categoría inválida." |
| `description` | yes | string | 1–200 chars | "Descripción requerida (máx 200)." |
| `amount` | yes | decimal | `> 0`, max 2 decimal places, max value 999999.99 | "Monto debe ser mayor a 0." |
| `paymentMethod` | yes | string | catalog `paymentMethods` (active) | "Medio de pago inválido." |
| `scheduleId` | no | string (GUID) | if present, exists (no active check) | "Horario inválido." |
| `notes` | no | string | 0–500 chars | |
| **Catalog** | | | | |
| `code` | yes | string | regex `^[a-z][A-Za-z]+$`, 3–30 chars | "Código de catálogo inválido." |
| `items[].value` | yes | string | 1–80 chars; unique within catalog (case-insensitive) | "Valor de ítem inválido o duplicado." |
| `items[].order` | no | int | `>= 0`, `<= 999`. If absent, server assigns `MAX(order)+1`. | "Orden inválido." |
| `items[].active` | no | bool | default `true` on create | |

### 12.3 GUID format

All `*Id` fields (`studentId`, `scheduleId`, `teacherId`, `enrollmentId`, etc.) must match GUID v4 format: regex `^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`. Backend rejects malformed IDs with `urn:espaciopro:problem:validation` 422. NOT 404.

### 12.4 Decimal handling

- Wire format: JSON number with up to 2 decimal places. Backend deserializes to `decimal` (NOT `double` — avoids floating-point errors in money).
- Cosmos stores as JSON number. C# `decimal` round-trips safely.
- Frontend uses `number` (TypeScript). For display formatting (currency), use `Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })`.
- Reject scientific notation in input (e.g. `1.5e2`) — backend regex on the raw JSON or post-parse check.

### 12.5 Catalog reference validation cost

Validating that a `paymentMethod` value exists in catalog `paymentMethods` requires reading the catalog. To avoid hitting Cosmos on every payment write (~3 RU each):

- Backend caches catalogs in-memory (`IMemoryCache`, TTL 5 min).
- Cache invalidated when `PUT /catalogs/{code}` or item-level CUD endpoints succeed (publish via local `ICatalogCacheInvalidator`).
- Cold-start cost: 1 read per catalog code referenced in current request (~3-8 RU). Acceptable.

### 12.6 Cross-entity referential integrity

- Soft-deleted (`active=false`) referenced entities are treated as **invalid** for create/update writes (e.g. you cannot create a payment for an inactive enrollment).
- Reads tolerate soft-deleted FKs — historical records keep referencing them.
- Schedule deletion is blocked if any enrollment with `active=true AND status='active'` references it (returns `urn:espaciopro:problem:dependent-records` 409). Same for Teacher → Schedule.
