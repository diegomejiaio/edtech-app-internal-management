# OpenAPI Pipeline — Espacio Pro v1

> How the backend OpenAPI spec is authored, served, and consumed by the frontend.
> Goal: a single source of truth for the API contract, with zero drift between backend and frontend types.

---

## 0. Decision log

**v1 (current):** the spec is **hand-authored** in `backend/src/EspacioPro.Api/openapi.yaml` and served at runtime as both YAML and JSON. The frontend consumes the JSON variant.

**Why hand-authored (and not the Aliencube/Azure OpenAPI extension)?** The library auto-gen path (`Microsoft.Azure.WebJobs.Extensions.OpenApi`) historically lags new .NET versions; on .NET 10 preview + isolated worker, compatibility was unverified. Hand-authoring eliminates that NuGet risk, gives us full control over examples, polymorphism, and `application/problem+json` shapes, and is cheap to maintain at v1 surface area (≈ 25 endpoints).

**When to revisit:** if the surface grows past ~80 endpoints, or once the extension publishes a stable .NET 10 worker package, evaluate switching back to attribute-based generation. The runtime endpoints (`/api/v1/openapi.{yaml,json}`) and the FE codegen pipeline stay the same — only the source of the spec changes.

---

## 1. Pipeline overview

```
backend (.NET 10)                                     contract                       frontend (Next.js 16)
─────────────────                                     ────────                       ──────────────────────
 backend/src/EspacioPro.Api/                                                          frontend/
   └─ openapi.yaml  ◄──── single source of truth                                        └─ src/lib/api/
   └─ Functions/OpenApiFunction.cs                                                            ├─ types.ts        (hand-written: env, client helpers)
        ├─ GET /api/v1/openapi.yaml  (raw)                                                    └─ types.gen.ts    (AUTO-GENERATED — do not edit)
        └─ GET /api/v1/openapi.json  (parsed → JSON via YamlDotNet)                              ▲
                                                                                                  │
                                       openapi-typescript ─────────────────────────────────  pnpm api:types
                                       (reads /openapi.json)
```

---

## 2. Backend side

### 2.1 Source of truth

The spec lives at:

```
backend/src/EspacioPro.Api/openapi.yaml
```

It targets **OpenAPI 3.1** and is committed to the repo. It is copied to the build output via:

```xml
<ItemGroup>
  <Content Include="openapi.yaml" CopyToOutputDirectory="PreserveNewest" />
</ItemGroup>
```

### 2.2 Runtime serving

`backend/src/EspacioPro.Api/Functions/OpenApiFunction.cs` exposes two endpoints:

| Method | Route                  | Content-Type        | Notes                                  |
| ------ | ---------------------- | ------------------- | -------------------------------------- |
| GET    | `/api/v1/openapi.yaml` | `application/yaml`  | Raw file contents.                     |
| GET    | `/api/v1/openapi.json` | `application/json`  | Parsed via `YamlDotNet`, indented JSON.|

Both are anonymous (no JWT required) and memoised in static `Lazy<string>` after first read.

### 2.3 Editing the spec

Whenever a Function or DTO changes, update `openapi.yaml` in the same commit. The CI guard described in §4 (when added) catches drift between the spec and the regenerated frontend types.

Conventions:
- `tags`: one per aggregate (`Health`, `Catalogs`, `Teachers`, `Students`, `Schedules`, `Enrollments`).
- `operationId`: camelCase verb + noun (e.g. `listStudents`, `createTeacher`).
- Reuse `components/schemas/AuditFields` (the audit + `_etag` fields) via `allOf`.
- Reuse the canonical responses (`Unauthorized`, `Forbidden`, `NotFound`, `Conflict`, `Duplicate`, `PreconditionFailed`, `ValidationFailed`).
- All errors use `application/problem+json` and the `ProblemDetails` schema (RFC 7807 + `correlationId` + `errors`).

### 2.4 Local manual export (optional)

If you want a static file on disk (e.g. for a tool that does not speak HTTP):

```bash
# from a running func host
curl http://localhost:7071/api/v1/openapi.json > backend/artifacts/openapi.json
```

`backend/artifacts/` is gitignored (see §5). The runtime endpoint is the canonical access point.

---

## 3. Frontend side

### 3.1 Tool

[`openapi-typescript`](https://github.com/openapi-ts/openapi-typescript) — generates a single `.d.ts` file with `paths`, `components`, and `schemas` types. It accepts both YAML and JSON; we use JSON for compatibility.

Add to `frontend/package.json` devDependencies (do NOT run pnpm install yet — user runs it):

```json
"devDependencies": {
  "openapi-typescript": "^7"
}
```

### 3.2 Scripts

`frontend/package.json` scripts section:

```json
"scripts": {
  "api:types": "openapi-typescript ../backend/artifacts/openapi.json -o src/lib/api/types.gen.ts",
  "api:types:remote": "openapi-typescript http://localhost:7071/api/v1/openapi.json -o src/lib/api/types.gen.ts"
}
```

`api:types` reads a snapshotted file at `backend/artifacts/openapi.json` (developer-produced via the curl in §2.4, never committed). `api:types:remote` is the everyday workflow when `func start` is running.

### 3.3 Consumption pattern

```ts
// src/lib/api/students.ts
import type { paths, components } from './types.gen';

export type Student = components['schemas']['Student'];
export type GetStudentResponse = paths['/v1/students/{id}']['get']['responses']['200']['content']['application/json'];

export const getStudent = (client: ApiClient, id: string) =>
  client.get<GetStudentResponse>(`/v1/students/${id}`);
```

> Hand-written shapes in `types.ts` should be limited to things that are not in the spec (env config, internal client helpers). Anything that crosses the wire derives from `types.gen.ts`.

---

## 4. CI integration (post-M0)

In `.github/workflows/ci.yml` (when CI exists):

```yaml
- name: Start Functions host
  run: cd backend/src/EspacioPro.Api && nohup func start > /tmp/func.log 2>&1 &

- name: Wait for OpenAPI endpoint
  run: |
    for i in {1..30}; do
      curl -fs http://localhost:7071/api/v1/openapi.json -o backend/artifacts/openapi.json && break
      sleep 1
    done

- name: Regenerate frontend types
  run: pnpm --filter frontend api:types

- name: Fail if types.gen.ts changed
  run: git diff --exit-code frontend/src/lib/api/types.gen.ts
```

The last step enforces that PRs include the regenerated `types.gen.ts` if the spec changed. **`types.gen.ts` is committed** (not gitignored) to make diffs reviewable.

A simpler cheat for v1 (no Functions host in CI): point `openapi-typescript` directly at the YAML file.

```yaml
- name: Regenerate frontend types from YAML
  run: pnpm --filter frontend exec openapi-typescript ../backend/src/EspacioPro.Api/openapi.yaml -o src/lib/api/types.gen.ts
- name: Fail if types.gen.ts changed
  run: git diff --exit-code frontend/src/lib/api/types.gen.ts
```

---

## 5. .gitignore

In `backend/.gitignore`:

```
artifacts/
```

The runtime-served `openapi.json` is regeneratable from `openapi.yaml` (which IS committed). Snapshots in `backend/artifacts/` are developer convenience only.

What gets reviewed in PRs is the YAML diff (backend-side) and the **`types.gen.ts`** diff (frontend-side). Both surface API surface changes clearly.

---

## 6. Developer workflow

### Backend change (new endpoint or DTO shape)

1. Add/modify the Function code.
2. Update `backend/src/EspacioPro.Api/openapi.yaml` in the same commit.
3. With `func start` running, `cd frontend && pnpm api:types:remote` → regenerates `src/lib/api/types.gen.ts`.
4. Commit backend changes (including the YAML) **and** the regenerated `types.gen.ts`.
5. Frontend consumer code updates against the new types — TypeScript will flag mismatches.

### Frontend-only change

No regeneration needed. Hand-write the consumer in `src/lib/api/<resource>.ts` using existing types.

---

## 7. Rules of engagement

- **`openapi.yaml` is the single source of truth.** No attribute-based generation in v1.
- **`types.gen.ts` is consumed-only**. Never edit by hand. ESLint rule (M1): forbid edits in PR review.
- **Hand-written `types.ts`** holds env config and client helpers only. Anything crossing the wire derives from `types.gen.ts`.
- **Breaking changes** in the OpenAPI spec → version bump (`/api/v2/`). See `07-api-contract-cheatsheet.md` §14.
- **Spec sync is mandatory** on every backend PR that touches Functions or DTOs.

---

## 8. Open items

- Add `.github/workflows/openapi-drift.yml` (described in §4) when M0 CI baseline lands.
- Decide whether to commit a snapshotted `openapi.json` for offline tools — current default: **no**, use the runtime endpoint or read the YAML directly.
- ESLint rule to forbid edits to `types.gen.ts` → M1.
- Re-evaluate switching to attribute-based generation if the surface area or contributor count grows past v1's footprint.
