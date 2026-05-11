# Prompt: Skill Creation for Espacio Pro v1

> Use this prompt in a **separate conversation** with an LLM that has access to the `skill-creator` skill (e.g. OpenCode/Claude with `~/.claude/skills/skill-creator/`). It will scaffold a new skill in `~/.claude/skills/<skill-name>/SKILL.md` (or wherever your config places skills).

---

## Context

You are creating a new agent skill for the **Espacio Pro v1** project — an internal management webapp migrated from a Google Apps Script Sheets system to:

- **Frontend**: Next.js 16 static export → Azure Static Web Apps.
- **Backend**: Azure Functions, .NET 10 isolated worker, Cosmos NoSQL serverless.
- **Auth**: Clerk JWT validated via JWKS public endpoint (no Secret Key, no Key Vault in v1).
- **Identity to Cosmos**: Managed Identity. Local dev: `DefaultAzureCredential`.

Hard rules of the project (these constrain every skill):

- Backend, API contracts, code in **English**. UI strings in **Spanish**.
- All entities inherit `BaseEntity` with audit (`createdAt/By`, `updatedAt/By`, optional `deletedAt/By`) and embed an `AuditUser` snapshot `{ clerkUserId, email, displayName }`.
- **Soft delete only**.
- Cosmos: 2 containers (`master`, `operations`), partition key `/type`, IDs are GUIDs.
- v1 role: only `admin`.
- Workflow: Speckit (`.specify/`) for specs + HVE (`lib/hve-core` submodule) for maintenance stories. **NO OpenSpec**. **NO `/sdd-*` orchestrator**.
- Conventional Commits, never include `Co-Authored-By` or AI attribution.

See full conventions in `AGENTS.md` and `.agent/conventions.md` of the project repo.

---

## Task

Create a new skill named `<SKILL_NAME>` that helps an AI agent perform `<TASK_DESCRIPTION>` in this project.

The skill must:

1. Have a clear `name`, `description`, and trigger conditions in `SKILL.md` frontmatter.
2. Reference the relevant project conventions (audit, soft delete, English code/Spanish UI, etc.) where applicable.
3. Provide concrete examples specific to **Espacio Pro v1** entities (e.g. `Student`, `Teacher`, `Enrollment`, `Schedule`, `Payment`, `Catalog`).
4. Be self-contained: an agent loading this skill should not need additional context from the project to perform the task correctly.
5. Include checklists, code templates, or workflow steps as appropriate.

---

## Suggested Skills to Create (pick one per conversation)

Tier 1 — high value:

- `cosmos-document-writer` — write a new Cosmos entity (interface `IEntity`, inherit `BaseEntity`, register in repo, add unique key path if needed).
- `function-http-trigger` — scaffold a new HTTP-triggered Azure Function with auth middleware, DTO mapping, error handling.
- `clerk-jwt-validator-extension` — extend `ClerkJwtValidator` for new claims or roles.
- `audit-context-injection` — wire a new repo to receive `AuditContext` and auto-populate audit fields.
- `next-static-page` — scaffold a new page in the Next.js static export (no SSR, client-side data fetching).

Tier 2:

- `bicep-cosmos-container` — add a new container or unique key (warning: immutable after creation).
- `bicep-cross-rg-role-assignment` — add a role assignment from a Function App MI to a resource in another RG.
- `clerk-session-claims-template` — update the Clerk JWT template to include new claims.
- `speckit-spec-writer` — write a Speckit specification scoped to Espacio Pro v1 conventions.

Tier 3 — nice to have:

- `mermaid-uml-updater` — update class/component/state diagrams when domain changes.
- `prd-section-writer` — (obsolete: `PRD.md` was removed; see `docs/08-acceptance-criteria.md` instead).

---

## Output Format Expected

When you respond, produce:

1. The complete `SKILL.md` content (with YAML frontmatter).
2. Any auxiliary files the skill needs (templates, scripts) inside the same skill folder.
3. A short note on where to place the skill folder and how to verify it loads.

---

## Final Reminders

- The agent loading the skill will NOT have read this prompt. Bake all needed context INTO the skill itself.
- Prefer concrete examples over abstract guidance.
- If a skill would require project-specific paths, document them with placeholders like `<repo-root>/backend/Functions/...`.
