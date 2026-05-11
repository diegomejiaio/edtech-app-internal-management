# Heritage Code Audit — Espacio Pro v1

> **Scope**: Read-only audit of `frontend/` and `infra/` per `.agent/conventions.md` §10.
> **Audit date**: 2026-05-10
> **Last cleanup**: 2026-05-10 — items 1, 2, 3 from §6 executed; status block in §1 reflects
> the post-cleanup state. The previous `landing/` directory was removed entirely on the same date
> (out of v1 scope; will be rebuilt from scratch when needed).
>
> Background: per `AGENTS.md` and `docs/08-acceptance-criteria.md`, these directories were inherited from a previous
> project (legacy codebase) and have NOT been audited. The `backend/` tree is the only
> fully-greenfield Espacio Pro code.

---

## 1. Executive summary

| Dir            | Origin                          | Aligned?     | Recommended action                                  |
|----------------|---------------------------------|--------------|------------------------------------------------------|
| `frontend/`    | Legacy base + EP scaffolding    | **Yes**      | Cleanup executed (env, auth-provider, shell, deps). Active development continues. |
| `infra/`       | Placeholder (README only)       | n/a          | Build out Bicep for M0 deliverables                  |

The `frontend/` directory is no longer pure heritage — env, auth, and the entire Espacio Pro shell
(`src/app/(app)/*`, dashboard, entity routes, hooks, components, pickers) were rebuilt against
`docs/04-api-design.md` and `docs/07-api-contract-cheatsheet.md` between this audit and the cleanup
log entry. The dep manifest was also pruned (see §7 Changelog).

---

## 2. `frontend/` — Next.js 16 static export

### 2.1 Stack inventory

- **Framework**: Next.js 16 with `output: 'export'` ✅ matches `AGENTS.md` "Stack (locked)"
- **UI kit**: shadcn/ui + Radix primitives ✅ matches stack in `02-architecture.md`
- **Auth**: `@clerk/clerk-react` v5.59 ✅ matches stack
- **Data**: `@tanstack/react-query` v5.90 ✅ reasonable for client-side fetching
- **Forms**: react-hook-form + zod resolver ✅
- **Other**: `@codemirror/*` (≥10 packages), `@ag-ui/client` — ⚠️ **legacy-only**, not used by Espacio Pro

### 2.2 Aligned with Espacio Pro (KEEP)

| Path                                  | Why keep                                                                              |
|---------------------------------------|---------------------------------------------------------------------------------------|
| `src/lib/api/client.ts`               | Implements cheatsheet §6 (ProblemDetails parsing), §7 (`ifMatch`), §9 (correlation timeout merge). Shape matches our backend. |
| `src/lib/api/types.ts`                | Has `BaseEntity`, `Paginated<T>`, `ProblemDetails`, `EntityType` map, status enums per cheatsheet §5. |
| `src/lib/api/{catalogs,students,teachers,schedules,enrollments,student-payments,teacher-payments,expenses,health}.ts` | Entity-per-file API modules already aligned with `docs/04-api-design.md` §5. |
| `src/lib/api/errors.ts`               | `ApiError` + type guards for ProblemDetails — matches cheatsheet §6.                  |
| `src/hooks/use-*.ts`                  | TanStack Query wrappers per entity — matches the "single internal client" decision (api-design §1 #2). |
| `src/components/auth/{require-role,require-permission}.tsx` | Aligns with `[RequireRole]` server-side gate (cheatsheet §10). |
| `src/app/(public)/{sign-in,sign-up}/page.tsx` | Clerk hosted signin shell.                                                  |
| `next.config.ts`                      | `output: 'export'`, `trailingSlash`, `images.unoptimized` — required for SWA Free.    |

### 2.3 Legacy leftovers (REFACTOR or REMOVE)

> **Status (2026-05-10 cleanup)**: All items in this table have been addressed. The originals are
> kept here for traceability.

| Path                                         | Issue                                                                                                  | Resolution |
|----------------------------------------------|--------------------------------------------------------------------------------------------------------|------------|
| `src/lib/env.ts`                             | Had `tenantId`, `DEV_DEFAULTS.tenantName`, `userRole: 'master'`, refers to `back/bff/config.py`.       | ✅ Rewritten — single-tenant, no DEV_MODE, no master role. |
| `src/providers/auth-provider.tsx`            | `DEV_MODE` bypass with mock user.                                                                      | ✅ Rewritten — pure Clerk wrapper, no bypass. |
| `src/app/(app)/layout.tsx`, `dashboard/page.tsx` | Legacy dashboard shell.                                                                            | ✅ Replaced — `(app)/layout.tsx` uses Espacio Pro `AppShell`; `dashboard/page.tsx` renders the `ScheduleDashboard` against `/api/v1/schedules/{id}/dashboard`. |
| `src/app/page.tsx`                           | Legacy landing redirect.                                                                               | ✅ Replaced — Clerk auth gate routing to `/dashboard` or `/sign-in`. |
| `package.json`: `@codemirror/*` (8 pkgs), `@ag-ui/client`, `react-syntax-highlighter`, `@xyflow/react`, `exceljs`, `react-markdown`, `remark-gfm`, `@lezer/highlight` | Code editor + agent UI deps from legacy codebase. | ✅ Removed (11 packages) — `react-syntax-highlighter` and `@xyflow/react` were already absent. `cmdk` retained (used by shadcn `command.tsx`). |
| `src/components/ui/template-editor.tsx`      | CodeMirror-based editor, no consumers in Espacio Pro.                                                  | ✅ Deleted. |
| `patches/`                                   | pnpm patches — origin unclear, audit before keeping.                                                   | ✅ Verified — single `next@16.1.1.patch` fixes a real Next.js MPA-navigation bug, retained. |

### 2.4 Unknown / verify-before-changing

| Path                            | Action                                                                  |
|---------------------------------|-------------------------------------------------------------------------|
| `src/components/ui/*`           | shadcn/ui generated components. Likely safe to keep all; remove unused. |
| `src/components/motion/*`       | Animation helpers — verify usage.                                       |
| `vitest.config.ts`              | Test runner is configured but no test directory committed in `src/`.    |

---

## 3. `infra/`

Empty except for `README.md`. Listed as "Placeholder for Espacio Pro v1 Bicep templates. Pending milestone M0."

**Status**: Needs ground-up implementation. Per PRD M0 acceptance criteria:

- Bicep deployable with `deploy.sh` for `rg-espaciopro-prod`
- Resources: Function App (Consumption Y1), Storage Account, ASP, SWA Free, App Insights
- Cross-RG role assignment: Function App MI → `Cosmos DB Built-in Data Contributor` on `shared-cosmos-nosql` in `rg-shared-services`
- Plain App Settings (no Key Vault): `CLERK_JWKS_URL`, `CLERK_ISSUER`, `COSMOS_ENDPOINT`, `COSMOS_DATABASE`, `CORS_ORIGINS`

**Recommended action**: Build out as M0 work (separate task). No cleanup needed — directory is empty.

---

## 4. Removed: public landing

The previous public landing directory was removed from the repo on 2026-05-10. It was out of v1
scope per the project layout and was carrying copy/branding from the legacy codebase that did not apply
to Espacio Pro. A new landing will be built from scratch when there is a real product narrative
to publish.

---

## 5. Cross-cutting risks

| Risk                                                                                               | Mitigation                                                                                                  |
|----------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| `frontend/src/lib/env.ts` `DEV_MODE` could leak to prod and bypass auth.                           | Refactor to remove DEV_MODE entirely. Auth is mandatory per `AGENTS.md` "Hard Rules".                       |
| Heritage `tenantId` concept may leak into new code via auto-imports.                               | Remove `DEV_DEFAULTS.tenantId`/`tenantName` and any consumers before adding new screens.                    |
| Heritage role `'master'` collides with Espacio Pro's `admin`/`seller`/`teacher`.                   | Refactor `auth-provider` types to match `'admin' \| 'seller' \| 'teacher'` per the role model in `01-domain-model.md`.       |
| `package.json` carries unused heavy deps (CodeMirror ~10 pkgs, ag-ui, xyflow).                     | Audit imports. Remove before next feature push to keep bundle small (SWA Free has limits).                  |
| No `.gitignore` audit of heritage build output (`tsconfig.tsbuildinfo` is committed currently).    | Verify root `.gitignore` covers `**/tsconfig.tsbuildinfo`, `frontend/.next`.                                |

---

## 6. Suggested cleanup work breakdown (post-IA-setup)

> **Status (2026-05-10)**: items 1–3 executed in earlier session work + this cleanup pass.
> Landing decision was resolved by removing the directory entirely. Item 4 remains for M0 infra.

When the user is ready to clean up (per conventions §10, this is **not** current sprint):

1. ✅ **`frontend-cleanup-env`** — `src/lib/env.ts` and `src/providers/auth-provider.tsx` are clean (single-tenant, no DEV_MODE, role `admin` only).
2. ✅ **`frontend-cleanup-deps`** — Removed 11 unused legacy packages from `package.json` plus `src/components/ui/template-editor.tsx`. User must run `pnpm install` to refresh `pnpm-lock.yaml`.
3. ✅ **`frontend-replace-shell`** — `src/app/page.tsx`, `src/app/(app)/layout.tsx`, and `src/app/(app)/dashboard/page.tsx` are Espacio Pro shells; entity routes (`students`, `teachers`, `schedules`, `enrollments`, `student-payments`, `teacher-payments`, `expenses`, `catalogs`) are scaffolded.
4. 🔲 **`infra-bicep-m0`** — Implement M0 Bicep templates (separate from cleanup).

Each item belongs in its own change after the backend M2-M9 endpoints are stable enough to wire the
frontend against.

---

## 7. Changelog

- 2026-05-10 — Initial audit. No code changes performed.
- 2026-05-10 — Cleanup pass: removed `@ag-ui/client`, `@codemirror/{autocomplete,commands,language,lint,search,state,view}`, `@lezer/highlight`, `exceljs`, `react-markdown`, `remark-gfm` from `frontend/package.json` (11 packages). Deleted `frontend/src/components/ui/template-editor.tsx` (sole consumer of the CodeMirror stack). Verified `next@16.1.1.patch` is a legitimate Next.js bugfix and retained. Items 1+2+3 of §6 marked done; landing decision and infra Bicep (item 4) still pending.
- 2026-05-10 — Public landing directory removed entirely (out of v1 scope, carried unrelated legacy branding). Will be rebuilt from scratch when needed. All brand references to the legacy codebase neutralized across docs and code comments.
