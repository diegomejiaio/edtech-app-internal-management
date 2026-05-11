# Workflow — Speckit + HVE/RPI + OpenCode

> Companion to `AGENTS.md`. Defines who does what across our 3 tools.
> Locked decisions: see `02-architecture.md` and Engram topic `architecture/workflow-v1`.

---

## 1. Tool roles (no overlap)

| Tool | What it owns | When to use |
|---|---|---|
| **Speckit** (`.specify/`) | **WHAT** to build: PRD, milestone scope, acceptance criteria, requirements | Specs change, new feature scope, milestone definition, formal requirements |
| **HVE / RPI** (Copilot Chat) | **HOW** to implement a concrete task: research → plan → code → review | Implementing a milestone or any non-trivial task that requires investigation before coding |
| **OpenCode** (Claude Opus, this CLI) | Quick edits, doc maintenance, pair-programming, Engram persistence, tool orchestration | Anything that doesn't need RPI's full ceremony, or where Copilot is the wrong UX |

> **Rule**: Speckit and RPI never overlap. Speckit answers "what should this milestone deliver?". RPI answers "given the milestone, how do I implement task X correctly?".

---

## 2. RPI mode selection (per milestone)

HVE offers two RPI flavors. Match the tool to the task complexity.

| Milestone | RPI mode | Reason |
|---|---|---|
| **M0 — Infra + Auth** | **Strict RPI** (`/task-research` → `/clear` → `/task-plan` → `/clear` → `/task-implement` → `/clear` → `/task-review`) | Zero existing code. Need to research Bicep patterns, .NET 10 isolated worker, Cosmos MI, Clerk JWKS validation. Mistakes here are expensive (immutable Cosmos unique keys, cross-RG role timing). |
| **M1 — Catalogs** | `rpi-agent` (single session, autonomous) | Simple CRUD, sets the pattern for M2-M8 |
| **M2 — Teachers** | `rpi-agent` | Repeating M1 pattern |
| **M3 — Students** | `rpi-agent` | Repeating M1 pattern + dedup logic |
| **M4 — Schedules** | `rpi-agent` | Repeating M1 + computed fields |
| **M5 — Enrollments** | `rpi-agent`, escalate to Strict if dedup validation gets hairy | New business rule (no duplicate active) |
| **M6 — Student Payments** | `rpi-agent` for CRUD, **Strict RPI** for the `/debtors` query | Debtors query design needs research (RU optimization, query plan) |
| **M7 — Teacher Payments** | `rpi-agent` | Repeating CRUD |
| **M8 — Expenses** | `rpi-agent` | Repeating CRUD |
| **M9 — Dashboard composite** | **Strict RPI** | BFF endpoint composing 3 queries, snapshots, response shape design |

**Escalation rule**: if `rpi-agent` produces something that smells off (assumes an API that doesn't exist, ignores conventions, makes up file paths), kill it and switch to Strict RPI for that task.

---

## 3. Strict RPI workflow (step by step)

When the milestone says "Strict RPI", do this in **VS Code Copilot Chat** (NOT in OpenCode):

1. Open Copilot Chat (`Ctrl+Alt+I`).
2. Type `/task-research <topic>` → produces `<date>-<topic>-research.md` in `.copilot-tracking/`.
3. **`/clear` the chat.**
4. Open the research doc in editor (so next agent sees it).
5. Type `/task-plan` → produces plan files in `.copilot-tracking/`.
6. **`/clear`**.
7. Open the plan in editor.
8. Type `/task-implement` → executes plan, produces `<date>-<topic>-changes.md`.
9. **`/clear`**.
10. Type `/task-review` → validates implementation, produces review doc.

**Critical**: between phases, ALWAYS `/clear` and re-open the relevant `.copilot-tracking/` artifact. Context contamination is the #1 way RPI fails.

---

## 4. `rpi-agent` workflow

When the milestone says `rpi-agent`:

1. Open Copilot Chat in VS Code.
2. Select `@rpi-agent` from the agent picker.
3. State the task in plain language (e.g. "Implement M2 Teachers CRUD per docs/04-api-design.md §5.3").
4. The agent orchestrates Research → Plan → Implement → Review in one session via subagents.
5. If review surfaces gaps, agent iterates internally.

**You don't `/clear` between phases** — that's `rpi-agent`'s entire job vs Strict RPI.

---

## 5. Where artifacts live

| Artifact | Location | Committed to git? |
|---|---|---|
| Research docs (`*-research.md`) | `.copilot-tracking/` | ❌ NO (gitignored) |
| Plans, changes, reviews | `.copilot-tracking/` | ❌ NO |
| Acceptance criteria, requirements (Speckit) | `.specify/` | ✅ YES |
| Architecture decisions | `docs/0X-*.md` + Engram topic `architecture/*` | ✅ YES + Engram |
| Code | `frontend/`, `backend/`, `infra/` | ✅ YES |

> `.copilot-tracking/` is intentionally ephemeral. If a research finding deserves persistence, **the human (you) lifts it into `docs/` or Engram**. RPI artifacts are working memory, not source of truth.

---

## 6. Coding standards

- **Cross-cutting conventions** (audit, soft delete, EN/ES split, Cosmos discriminator, etc.) live in `.agent/conventions.md` — applies always, regardless of tool.
- **HVE workflow instructions**: `.vscode/settings.json` exposes the official non-experimental HVE instruction collections so Copilot can run RPI agents correctly.
- **Language-specific coding standards**: when M0 starts, use `lib/hve-core/.github/instructions/coding-standards/` for **C# and Bicep** guidance. Other project conventions still come from `.agent/conventions.md`.
- **Conflict rule**: if any HVE instruction contradicts `.agent/conventions.md`, **`.agent/conventions.md` wins**. File an issue or amend the convention if the HVE rule is genuinely better.

---

## 7. Where each tool reads context from

| Tool | Reads context from | Notes |
|---|---|---|
| OpenCode (Claude) | `AGENTS.md` (root, then global), Engram, this repo's docs | Already configured. No changes needed. |
| Copilot Chat (HVE agents) | `lib/hve-core/.github/agents/*`, `lib/hve-core/.github/prompts/*`, `lib/hve-core/.github/instructions/*`, `lib/hve-core/.github/skills/*`, repo `.github/agents`, repo `.github/prompts`, repo files Copilot has access to | See `.vscode/settings.json` for path config. Experimental HVE collections are intentionally not loaded. Copilot receives project-level context from `.github/copilot-instructions.md`. |
| Speckit | `.specify/` only | Self-contained. |

> **Note**: `.github/copilot-instructions.md` now points Copilot to `AGENTS.md`, `.agent/conventions.md`, and the core docs. For high-risk RPI work, still include a short context line in the chat so the selected HVE agent explicitly grounds itself before researching or implementing.

---

## 8. Engram + RPI

After RPI completes a non-trivial task:

1. Read the `*-changes.md` in `.copilot-tracking/`.
2. **In OpenCode** (or any Engram-aware tool), call `mem_save` with the key decision/finding.
3. The `.copilot-tracking/` file remains ephemeral; Engram becomes the persistent memory.

This is manual on purpose. Not every research doc deserves Engram persistence — only decisions, gotchas, and patterns that future sessions need to know.

---

## 9. Anti-patterns to avoid

- ❌ Running RPI inside OpenCode (RPI agents only exist in Copilot Chat).
- ⚠️ Using OpenCode to do "research+implement" for M0 — strongly prefer Strict RPI in Copilot Chat. Acceptable as a documented override only when the user explicitly opts in (e.g. for high-context single-shot infra generation followed by a Copilot Chat `/task-review` audit gate).
- ❌ Skipping `/clear` between Strict RPI phases.
- ❌ Committing `.copilot-tracking/` files.
- ❌ Letting Speckit and RPI write the same kind of artifact (acceptance criteria → Speckit, implementation plan → RPI).
- ❌ Treating HVE instructions as overriding `.agent/conventions.md`.
