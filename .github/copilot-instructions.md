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
