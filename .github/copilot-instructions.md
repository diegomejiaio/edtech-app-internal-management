<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->

# Espacio Pro v1 — Copilot Context

Before making code or architecture decisions in this repository, read:

- `AGENTS.md`
- `.agent/conventions.md`
- `docs/08-acceptance-criteria.md`
- `docs/01-domain-model.md`
- `docs/02-architecture.md`
- `docs/04-api-design.md`
- `docs/05-workflow-hve-rpi.md`

Use Speckit for the WHAT (`.specify/`) and HVE/RPI for the HOW in GitHub Copilot Chat. HVE Core is loaded from the `lib/hve-core` git submodule through `.vscode/settings.json`, not from a marketplace copy.

Project conventions override HVE instructions when they conflict. Keep backend, API contracts, Cosmos fields, and frontend code in English. Keep visible UI strings in Spanish. Audit fields and soft delete are mandatory for all entities.

## CodeGraph (MANDATORY)

**Do NOT** open files, run grep, or spawn explore agents without first querying CodeGraph.

In the **main session**, use only lightweight lookup tools:

| Task | Tool |
|------|------|
| Find a symbol, route, or file | `codegraph_search` |
| Trace who calls what | `codegraph_callers` / `codegraph_callees` |
| Assess blast radius before editing | `codegraph_impact` |
| Inspect one symbol's details | `codegraph_node` |

For **exploration questions** (e.g., "how does X work?"), spawn an Explore agent with this instruction in the prompt:
> Use `codegraph_context` and `codegraph_explore` as your PRIMARY tools. Do NOT re-read files that codegraph already returned source for.

Fall back to grep/view **only** when CodeGraph returns no results.

The `.codegraph/` index is local-only (do not commit). Rebuild with `codegraph init -i` if stale.

## Engram (MANDATORY)

**Do NOT** make architecture decisions or start non-trivial tasks without first calling `mem_search`.

| When | Action |
|------|--------|
| Session start | `mem_current_project` → then `mem_search` for the topic |
| Before any decision | `mem_search` — prior decisions may already exist |
| Decision made, bug found, pattern established | `mem_save` (include What/Why/Where/Learned) |
| Session end | `mem_session_summary` |

**Example flow:**
```
1. mem_current_project → confirms "edtech-app-internal-management"
2. mem_search "cosmos partition key" → finds prior decision
3. (do work)
4. mem_save "Switched to hierarchical PK" --type decision
5. mem_session_summary
```

Topic key for architecture: `architecture/espacio-pro-v1`. Project name: `edtech-app-internal-management`.

## Run Locally

- **Backend** (Functions host on `:7071`): `cd backend && ./run.sh` (`--no-restore` to skip restore). Requires `backend/src/EspacioPro.Api/local.settings.json` with `COSMOS_*` filled in — copy from the example and complete it before first run.
- **Frontend** (Next dev on `:3000`): `cd frontend && ./run.sh` (`--no-clean` to keep `.next`). Lightweight alternative: `./run.local.sh`.
- **Deploy / infra**: `infra/deploy.sh`, `infra/deploy-app.sh`, `infra/deploy-cosmos.sh` (all `--apply` to execute). Remote/cloud writes require explicit approval.

## Frontend Build (hard rule — static export)

Next.js runs with `output: 'export'` (SPA, **no SSR/Server Components**):

- Every page is `'use client'`.
- A `'use client'` page **cannot** also export `generateStaticParams()` — the build fails. For dynamic routes (`[id]/page.tsx`), put `generateStaticParams` in a **separate server file** (or `generateStaticParams.ts`), keeping the page client-only. Runtime routing is handled by SWA `navigationFallback` + client hydration.
- A static export build (`pnpm build`) must pass before considering frontend work done — don't claim completion on an unverified build.

## Testing (E2E)

Before touching e2e tests, read `docs/09-testing-strategy.md` and `e2e/TEST_INVENTORY.md`.

- When a test fails, first decide **bad test vs. real bug** — fix or discard mis-stated tests; only "fix the code" when there's a genuine bug.
- Keep `e2e/TEST_INVENTORY.md` in sync when adding, removing, or restructuring tests.

## Change Scope

Prefer **minimal, scoped changes**: install/configure only what this project needs, not full generic setups. When in doubt about scope, ask before expanding.
