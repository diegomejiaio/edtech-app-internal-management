---
applyTo: "**"
---

# Conventions Quick Reference

## Language

- Code, comments, API contracts, Cosmos fields: **English**
- UI strings visible to user: **Spanish**
- Domain glossary: `docs/01-domain-model.md` §Glossary

## Formatting

- Semicolons (`;`) always (frontend)
- Double quotes (`"`) for strings (frontend)
- `PascalCase` types, `camelCase` locals (backend)
- File-scoped namespaces (backend)

## Architecture Rules

- Audit mandatory on all entities (`createdAt/By`, `updatedAt/By`, `deletedAt/By`)
- Soft delete only — never hard delete
- v1 role: only `admin`
- JSON on wire: camelCase, enums as camelCase strings, dates ISO 8601 UTC
- Errors: RFC 7807 Problem Details
- Frontend-first: resolve from cache before calling backend

## Git

- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- Never include `Co-Authored-By` or AI attribution
- One logical change per commit
