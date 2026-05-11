<div align="center">

```
┌───┬───┬───┬───┬───┬───┬───┬───┐
│ E │ S │ P │ A │ C │ I │ O │ _ │
├───┼───┼───┼───┘   └───┴───┴───┘
│ P │ R │ O │
└───┴───┴───┘
```

# Espacio Pro

**Internal management webapp for edtech operations** — students, teachers, schedules, enrollments, payments, expenses.

[![Status](https://img.shields.io/badge/status-pre--release-orange)](#)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Frontend](https://img.shields.io/badge/frontend-Next.js%2016-black?logo=nextdotjs)](https://nextjs.org/)
[![Backend](https://img.shields.io/badge/backend-Azure%20Functions%20.NET%2010-512BD4?logo=dotnet)](https://learn.microsoft.com/azure/azure-functions/)
[![Database](https://img.shields.io/badge/db-Cosmos%20DB%20NoSQL-2360A5?logo=microsoftazure)](https://learn.microsoft.com/azure/cosmos-db/)
[![Auth](https://img.shields.io/badge/auth-Clerk-6C47FF?logo=clerk)](https://clerk.com/)
[![IaC](https://img.shields.io/badge/iac-Bicep-0078D4?logo=microsoftazure)](https://learn.microsoft.com/azure/azure-resource-manager/bicep/)

</div>

---

## What is this

Espacio Pro is a single-tenant internal webapp that replaces a legacy Google Sheets + Apps Script workflow for managing the day-to-day operations of an education business: enrolling students, scheduling classes, paying teachers, tracking expenses, and reporting per-schedule debtors.

This repo contains the full v1 implementation: **static frontend** (Next.js export) + **serverless backend** (Azure Functions .NET 10 isolated worker) + **Cosmos DB NoSQL serverless** + **Clerk** for authentication.

> **Status**: pre-release. v1 is under active development. Not deployed publicly. The codebase is open for reference and learning purposes.

---

## Architecture

```
┌────────────────────┐      JWT      ┌─────────────────────┐
│  Next.js (static)  │ ────────────▶ │  Azure Functions    │
│  on SWA Free       │               │  .NET 10 isolated   │
│  Clerk SDK         │               │  Clerk JWT validator│
└────────────────────┘               └──────────┬──────────┘
                                                │ Managed Identity
                                                ▼
                                     ┌─────────────────────┐
                                     │  Cosmos DB NoSQL    │
                                     │  serverless         │
                                     │  master / operations│
                                     └─────────────────────┘
```

| Layer        | Tech                                                     |
|--------------|----------------------------------------------------------|
| Frontend     | Next.js 16 + TypeScript + Tailwind + shadcn/ui (`output: 'export'`) |
| Auth         | Clerk SDK (frontend) + RS256 JWT validation (backend) via JWKS public endpoint |
| Backend      | Azure Functions .NET 10 isolated worker, HTTP triggers   |
| Database     | Cosmos DB NoSQL serverless — 2 containers, PK `/type`    |
| Identity     | Managed Identity → `Cosmos DB Built-in Data Contributor` |
| Hosting      | Azure Static Web Apps (Free) + Function App Flex Consumption (FC1) |
| IaC          | Bicep (modular, AVM-first)                               |
| Observability| Application Insights + Log Analytics workspace           |

**Design principles**: single-tenant, single environment (prod), no Key Vault in v1 (zero secrets — Clerk uses public JWKS, Cosmos uses MI), soft-delete-only, mandatory audit fields on every entity.

---

## Documentation

The detailed technical docs live under [`docs/`](docs/):

| Doc                                                  | Purpose                                                       |
|------------------------------------------------------|---------------------------------------------------------------|
| [`01-domain-model.md`](docs/01-domain-model.md)      | Entities, audit, glossary, validation rules                   |
| [`02-architecture.md`](docs/02-architecture.md)      | System overview, auth, deployment, Cosmos design, CORS, health|
| [`03-uml/`](docs/03-uml/)                            | Class, component, state, and sequence diagrams (Mermaid)      |
| [`04-api-design.md`](docs/04-api-design.md)          | REST catalog, query plans, denormalization, errors per endpoint |
| [`05-workflow-hve-rpi.md`](docs/05-workflow-hve-rpi.md) | Operational workflow: Speckit + HVE Core + OpenCode        |
| [`06-openapi-pipeline.md`](docs/06-openapi-pipeline.md) | Backend → frontend type-generation pipeline                |
| [`07-api-contract-cheatsheet.md`](docs/07-api-contract-cheatsheet.md) | Wire contract: status enums, errors, ETag, pagination, PUT semantics |
| [`08-acceptance-criteria.md`](docs/08-acceptance-criteria.md) | Milestones (M0-M9), scope, Definition of Done         |
| [`AGENTS.md`](AGENTS.md)                             | North Star for AI agents: stack, hard rules, conventions      |
| [`.agent/conventions.md`](.agent/conventions.md)     | Coding, naming, and workflow conventions                      |

---

## Repository structure

```
edtech-app-internal-management/
├── frontend/         Next.js 16 static export
├── backend/          Azure Functions .NET 10 isolated worker
├── infra/            Bicep templates (modular)
├── docs/             Architecture, domain model, API design, UML
├── lib/hve-core/     Git submodule — HVE Core (prompt + agent library for Copilot Chat)
├── .agent/           Project conventions
├── .specify/         Speckit specifications scaffold
├── .github/          Copilot instructions, assets
├── AGENTS.md         AI agent onboarding
└── README.md         You are here
```

---

## Getting started

> **Heads up**: this section reflects work-in-progress tooling. M0 is not yet fully wired.

### Prerequisites

- Node.js 22+ and `pnpm`
- .NET 10 SDK and Azure Functions Core Tools v4
- Azure CLI (`az login` for local dev against cloud Cosmos)
- A Clerk account with a publishable key

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

### Backend

```bash
cd backend
func start
```

### Cosmos DB

Local dev points to a real Cosmos DB serverless account (no emulator). Auth is `DefaultAzureCredential`, which uses your `az login` session.

### Submodule

This repo includes [HVE Core](https://github.com/microsoft/hve-core) as a git submodule for AI-assisted RPI workflows in Copilot Chat. After cloning, run:

```bash
git submodule update --init --recursive
```

---

## License

[MIT](LICENSE) © 2026 Diego Mejia
