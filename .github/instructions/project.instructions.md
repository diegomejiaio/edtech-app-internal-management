---
applyTo: "**"
---

# Espacio Pro v1

Before implementing, check relevant documentation:

| Topic | File |
|-------|------|
| Acceptance Criteria | `docs/08-acceptance-criteria.md` |
| Domain Model | `docs/01-domain-model.md` |
| Architecture | `docs/02-architecture.md` |
| API Design | `docs/04-api-design.md` |
| Workflow (RPI) | `docs/05-workflow-hve-rpi.md` |
| Conventions | `.agent/conventions.md` |

**Always read the relevant doc before making changes.**

## Stack

- **Frontend**: Next.js 16 static export (SPA), Tailwind 4, shadcn/ui, TanStack Query 5, Clerk
- **Backend**: .NET 10 Azure Functions isolated worker, Cosmos DB NoSQL
- **Auth**: Clerk JWT RS256, validated via public JWKS endpoint
- **Infra**: Azure Static Web Apps + Function App (Consumption) + Cosmos serverless

## Key Rules

- Code/comments in English. UI strings in Spanish.
- Audit fields mandatory on all entities (`createdAt/By`, `updatedAt/By`, `deletedAt/By`).
- Soft delete only — never hard delete.
- v1 role: only `admin`.
- JSON on wire: camelCase. Enums: camelCase strings. Dates: ISO 8601 UTC.
- Errors: RFC 7807 Problem Details.

## CodeGraph

If `.codegraph/` exists, use CodeGraph before broad filesystem exploration:
- `codegraph_search`: find symbols/routes/files by name.
- `codegraph_callers` / `codegraph_callees`: trace call flow.
- `codegraph_impact`: check affected symbols before editing.
- `codegraph_context`: build task-specific context.

Only fall back to grep/read when CodeGraph has no result.
