<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->

# Espacio Pro v1 — Agent Onboarding

You are working on **Espacio Pro v1**: migration of a Google Apps Script (GAS) Sheets-based system into a static webapp.

## North Star (read first)

1. `docs/08-acceptance-criteria.md` — milestones, scope, Definition of Done.
2. `docs/01-domain-model.md` — entities, audit, glossary ES↔EN.
3. `docs/02-architecture.md` — system overview, auth, layout, ops.
4. `docs/03-uml/` — class, component, state diagrams (Mermaid).
5. `docs/04-api-design.md` — REST endpoints catalog, query plans, denormalization strategy.
6. `docs/05-workflow-hve-rpi.md` — operational workflow: Speckit + HVE Core (RPI) + OpenCode, milestones, anti-patterns.
7. `.agent/conventions.md` — detailed coding/naming/workflow rules.
8. `.vscode/settings.json` — Copilot Chat config: HVE loaded from submodule (`lib/hve-core/.github/*`), NOT marketplace.

If you haven't read these in the current session, **read them before writing code or making decisions**.

## Stack (locked)

- **Frontend**: Next.js 16 with `output: 'export'` (static export, no SSR), deployed to Azure Static Web Apps.
- **Backend**: Azure Functions, .NET 10, isolated worker, HTTP triggers.
- **Database**: Azure Cosmos DB NoSQL serverless. 2 containers: `master`, `operations`. PK = `/type`. IDs = GUID.
- **Auth**: Clerk (JWT RS256 validated via JWKS public endpoint — NO secrets in v1).
- **Identity to Cosmos**: Managed Identity with `Cosmos DB Built-in Data Contributor`. Local dev = `DefaultAzureCredential` + `az login`.
- **No Key Vault in v1** (no secrets to store; documented as future work when role `teacher` arrives).

## Hard Rules

- **Never assume.** When in doubt, ask the user. Even small decisions.
- **Language convention**: backend, API contracts, code (incl. frontend) in English. Only UI strings in Spanish.
- **Audit is mandatory** on every entity (`createdAt/By`, `updatedAt/By`, optional `deletedAt/By`) via `BaseEntity` + `AuditUser` snapshot. See `docs/01-domain-model.md`.
- **Soft delete only** (no hard delete in v1).
- **Tenant**: single tenant, single environment (prod). Local dev points to cloud Cosmos.
- **v1 role scope**: only `admin`. Model is prepared for `seller`/`teacher` post-MVP.
- **Never commit** Co-Authored-By, AI attribution, or generated marketing in commits. Conventional commits only.
- **Never run a build** after changes. The user does it.

## Workflow

This project uses **Speckit** (`.specify/` directory) for specifications (the WHAT) and **HVE Core** (Human-in-the-loop Verifiable Engineering, submodule at `lib/hve-core`) for structured Copilot Chat execution via the **RPI methodology** — Research → Plan → Implement (the HOW). HVE runs in parallel with OpenCode.

- **OpenSpec is NOT used.** Do not propose it.
- **SDD orchestrator** (`/sdd-*` commands) is currently NOT initialized in this repo (decision postponed). Don't run `sdd-init`.
- For specifications, use Speckit primitives (`.specify/`).
- For implementation, see `docs/05-workflow-hve-rpi.md`: Strict RPI in M0/M9 + `/debtors`, `rpi-agent` in M1–M8.
- HVE Core does **NOT** auto-generate user stories. It is a prompt + agent library for Copilot Chat.
- HVE is loaded from the **submodule** (`lib/hve-core/.github/*`), not from the VS Code marketplace, to avoid version drift. See `.vscode/settings.json`.
- In any conflict between HVE `coding-standards` and `.agent/conventions.md`, **`.agent/conventions.md` wins**.

## Skills (auto-load when context matches)

When the task matches one of these contexts, load the skill BEFORE writing code:

| Context                              | Skill                |
| ------------------------------------ | -------------------- |
| Writing or refining specs            | `sdd-spec` (manual)  |
| Creating new agent skills            | `skill-creator`      |
| Go tests / Bubbletea TUI             | `go-testing`         |
| Frontend pages, components, hooks    | [`nextjs-frontend`](.github/skills/nextjs-frontend/SKILL.md) |
| Backend Functions, repos, entities   | [`dotnet-azure-functions`](.github/skills/dotnet-azure-functions/SKILL.md) |

For full workflow rules see `.agent/conventions.md`.

## CodeGraph (semantic code exploration)

This repo is initialized for CodeGraph. If `.codegraph/` exists, use CodeGraph before broad filesystem exploration. Prefer semantic tools for discovery and impact analysis, then open exact files only when editing or verifying exact code.

### Exploration priority

1. Use `codegraph_search` to find symbols/routes/files by name.
2. Use `codegraph_callers` / `codegraph_callees` to trace request and function flow.
3. Use `codegraph_impact` to check affected symbols/files before editing.
4. Use `codegraph_node` to inspect one symbol before opening files.
5. Use `codegraph_context` to build task-specific context when starting non-trivial work.
6. Fall back to grep/view only when CodeGraph has no result or you need exact file contents for an edit.

The generated `.codegraph/` directory is local-only and must not be committed. Rebuild with `codegraph init -i` when missing or stale.

## Engram (persistent memory)

This project uses Engram. Project name: `edtech-app-internal-management`.

- **Save** decisions, bugfixes, discoveries, patterns immediately via `mem_save`.
- **Topic key for architecture decisions**: `architecture/espacio-pro-v1`.
- **Search** before assuming something is new — check past sessions with `mem_search` / `mem_context`.
- **Session close**: always call `mem_session_summary` before ending.

## Heritage Code Warning

`frontend/`, `infra/` are inherited from a previous project (legacy codebase). They have NOT been audited and may not reflect Espacio Pro architecture. Cleanup is a planned task **after** the IA setup is ready. Do not blindly trust this code.

`backend/` started empty.
