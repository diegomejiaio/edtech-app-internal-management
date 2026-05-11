# Espacio Pro v1 — Acceptance Criteria & Definition of Done

> Source of truth for what "done" means in v1.
> Companion to `02-architecture.md`, `01-domain-model.md`, and `04-api-design.md`.

---

## 1. Cross-cutting (applies to M2-M9)

Every entity created/edited/soft-deleted records `createdBy`, `updatedBy`, and `deletedBy` with a snapshot of the Clerk user (`{clerkUserId, email, displayName}`). Detail views show *"Created by X on dd/mm/yyyy"* and *"Last edited by Y on dd/mm/yyyy"*.

---

## 2. Milestones

### M0 — Infra + Auth

- Bicep deployable for `rg-espaciopro-prod` (Function App Flex Consumption FC1, Storage Account, SWA Free, App Insights, Log Analytics workspace).
- Cross-RG role assignment: Function App Managed Identity gets `Cosmos DB Built-in Data Contributor` over `shared-cosmos-nosql` in `rg-shared-services`.
- Function App with plain env vars: `CLERK_JWKS_URL`, `CLERK_ISSUER`, `COSMOS_ACCOUNT_ENDPOINT`, `COSMOS_DATABASE_NAME`, `CORS_ORIGINS`. **Zero secrets, zero Key Vault.**
- Cosmos accessed via `DefaultAzureCredential` (Managed Identity in cloud, `az login` locally).
- `ClerkJwtValidator` validates RS256 signature + iss + exp with in-memory JWKS cache (TTL 1h). Audience validation OFF in v1 (Clerk JWTs do not include `aud` by default).
- `[RequireRole("admin")]` rejects requests without the correct claim with 403.
- `ICurrentUser` extracts `AuditUser { clerkUserId, email, displayName }` from `ClaimsPrincipal`. Repositories set audit fields automatically.
- Clerk JWT template configured with claims `email`, `name`, `role`.

### M1 — Catalogs (Master Data)

- CRUD on items inside each catalog from the UI.
- Initial seed identical to the legacy spreadsheet (courses: Melamina, Drywall; payment methods: Yape, Transferencia, Efectivo; etc.).
- Single read returns all catalogs (consumed by frontend dropdowns).

### M2 — Teachers

- Full CRUD + soft delete (`active=false`).
- List endpoint excludes `active=false` by default; opt-in via `?includeInactive=true`.
- Validation: `docType + docNumber` unique among active records.

### M3 — Students

- Full CRUD + soft delete.
- Dedup by `docType + docNumber` on create (returns the existing one if already present).
- List with search by name or document.
- View history: enrollments + payments per student.

### M4 — Schedules

- Full CRUD + soft delete.
- Status transitions across the 4 catalog values.
- List shows: capacity, # active enrollments, % occupancy.

### M5 — Enrollments

- Create enrollment with validation: **no active duplicate** (same `studentId + scheduleId` with `status='active'` and `active=true`).
- Status transitions across the 4 catalog values.
- List by schedule and by student.
- Soft delete.

### M6 — Student Payments

- Create payment: `enrollmentId, date, amount, installmentNumber, paymentMethod, hasReceipt, receiptNumber?, notes`.
- List by enrollment and by month.
- **Debtors-by-schedule endpoint**: `GET /api/v1/student-payments/debtors?scheduleId=X&month=YYYY-MM` → list of active enrollments for the schedule with no payment in that month, including last-payment date if any.
- Soft delete.

### M7 — Teacher Payments

- Create honorarium: `teacherId, date, amount, concept, paymentMethod, notes`.
- List by teacher and by period.
- Soft delete.

### M8 — Expenses

- Create expense: `date, category, description, amount, paymentMethod, scheduleId?, notes`.
- List by period and category.
- Soft delete.

### M9 — Per-schedule Dashboard

- Active-schedule selector.
- Schedule info: course, level, teacher, days, hours, price, status, capacity/enrolled.
- Table of active enrolled students with flag *"paid this month"* / *"pending"*.
- Table of debtors for the current month with last-payment date.

---

## 3. Definition of Done

v1 closes when every operation in the legacy spreadsheet is executable from the web:

1. Enroll student (with document dedup) + optional initial payment
2. Record student payment
3. Create and edit schedule
4. Record expense
5. Pay teacher
6. Register teacher
7. View per-schedule dashboard (enrolled + debtors)

**New capabilities vs spreadsheet** (mandatory in v1):

- Edit + soft delete for Students, Teachers, Enrollments
- Active-enrollment duplicate validation
- UI-editable catalogs

---

## 4. Out of Scope (v1)

- Global dashboard (monthly totals, profit, total debtors)
- Roles `seller` and `teacher` (model yes, views no)
- Multi-tenant
- Notifications (email, WhatsApp)
- Data migration from the spreadsheet
- PDF / Excel reports
- Electronic invoicing integration (only `receiptNumber` stored as text)
- Staging environment
- Student portal
