# AI Development Setup

Guide for configuring AI-assisted development on this repo with **GitHub Copilot CLI** (primary), **OpenCode**, or any MCP-capable agent. Covers MCP servers, persistent memory via **Engram**, and semantic code exploration via **CodeGraph**.

---

## Quick Start

```bash
# 1. Install tools
brew install gentleman-programming/tap/engram    # Persistent memory
curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh  # Semantic code graph (binary, no npm)

# 2. Initialize CodeGraph index
cd edtech-app-internal-management
codegraph init -i

# 3. Import team memory
engram sync --import

# 4. Start coding — agents will use CodeGraph + Engram automatically
```

---

## Tools Overview

| Tool | Purpose | Install |
|------|---------|---------|
| **GitHub Copilot CLI** | Primary AI coding agent | `brew install --cask github-copilot-cli` |
| **Engram** | Persistent memory across sessions | `brew install gentleman-programming/tap/engram` |
| **CodeGraph** | Local semantic graph (search, call flow, impact) | `curl -fsSL .../install.sh \| sh` ([repo](https://github.com/colbymchenry/codegraph)) |

---

## MCP Servers

All configured in `.vscode/mcp.json`:

| Server | Purpose | When |
|--------|---------|------|
| **engram** | Persistent memory | Always |
| **codegraph** | Semantic code exploration, impact analysis | After `codegraph init -i` |
| **playwright** | Browser automation / testing | Testing |
| **shadcn** | UI component docs | Frontend work |
| **azure** | Azure resource management | Infra work |

### Copilot CLI user-level config

Add to `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "engram": {
      "type": "local",
      "command": "engram",
      "args": ["mcp"],
      "env": { "ENGRAM_DATA_DIR": ".engram" },
      "tools": ["*"]
    },
    "codegraph": {
      "type": "local",
      "command": "codegraph",
      "args": ["serve", "--mcp"],
      "tools": ["*"]
    }
  }
}
```

---

## CodeGraph Usage

### Initialize

```bash
codegraph init -i     # Build index (first time or when stale)
codegraph status      # Check indexed files/nodes
```

### Agent tools (when `.codegraph/` exists)

| Tool | Purpose |
|------|---------|
| `codegraph_search` | Find symbols/routes/files by name |
| `codegraph_callers` | Trace who calls a function |
| `codegraph_callees` | Trace what a function calls |
| `codegraph_impact` | Estimate blast radius before editing |
| `codegraph_node` | Inspect one symbol's details |
| `codegraph_context` | Build task-specific context |

**Rule**: Use CodeGraph first for structural discovery, fall back to grep/read only when CodeGraph has no result or you need exact contents for an edit.

### Known limitation (v0.9.x)

CodeGraph indexes everything git-tracked. `lib/hve-core/` (submodule) and `frontend/` (legacy) are included in the index but do not interfere with queries — they're Python/TS scripts unrelated to the backend C# code. Once CodeGraph adds `exclude` support (tracked in [#316](https://github.com/colbymchenry/codegraph/issues/316)), add exclusions for `lib/`, `frontend/`, `infra/`.

### What is versioned vs local

| Path | Purpose | Versioned? |
|------|---------|------------|
| `.vscode/mcp.json` | MCP server config (CodeGraph, Engram, etc.) | ✅ yes |
| `.codegraph/` | Generated local index (SQLite) | ❌ gitignored |
| `.engram/` | Shared memory chunks | ✅ yes (chunks/) |

---

## Engram Usage

### Day-to-day

```bash
# Agent auto-uses these MCP tools:
mem_save("Fixed N+1 query in enrollment listing")   # Save discovery
mem_search("cosmos pagination")                      # Search past sessions
mem_context                                          # Recover session context
mem_session_summary                                  # Always call on session close
```

### Team sync

```bash
engram sync --export    # Push your memories to git-tracked chunks
engram sync --import    # Pull team memories after git pull
```

---

## File Layout

```
edtech-app-internal-management/
├── .vscode/
│   ├── mcp.json                  ← MCP servers (codegraph, engram, playwright, shadcn, azure)
│   └── settings.json             ← Copilot Chat locations (HVE Core, instructions, skills)
├── .github/                      ← SINGLE SOURCE OF TRUTH for all AI config
│   ├── copilot-instructions.md   ← Global Copilot context
│   ├── instructions/             ← Auto-loaded per-scope instructions
│   │   ├── project.instructions.md        (applyTo: **)
│   │   ├── dotnet-backend.instructions.md (applyTo: backend/**)
│   │   └── nextjs-frontend.instructions.md (applyTo: front/**)
│   ├── agents/                   ← Copilot Chat agents
│   │   ├── backend.md            ← Domain agent (refs skill)
│   │   ├── frontend.md           ← Domain agent (refs skill)
│   │   └── speckit.*.agent.md    ← Speckit workflow agents
│   ├── prompts/                  ← Copilot Chat prompts
│   │   ├── conventions.prompt.md ← Quick convention reference
│   │   └── speckit.*.prompt.md   ← Speckit workflow prompts
│   └── skills/                   ← Domain skills (shared: Chat + CLI)
│       ├── nextjs-frontend/SKILL.md
│       └── dotnet-azure-functions/SKILL.md
├── .engram/                      ← Engram memories (git-synced chunks)
├── .codegraph/                   ← CodeGraph index (gitignored)
├── AGENTS.md                     ← Agent onboarding (auto-loaded by CLI)
├── .agent/conventions.md         ← Detailed coding conventions
└── docs/                         ← Architecture & domain docs
```

**No duplication**: `.github/` is the single source. Both Copilot Chat and Copilot CLI read from it.

---

## Troubleshooting

```bash
# CodeGraph not working
codegraph status          # Should show indexed files
codegraph serve --mcp     # Should start MCP stdio server

# Engram not connecting
which engram              # Should be in PATH
engram status             # Should show memory count

# MCP server not connecting in Copilot CLI
# Restart CLI after editing ~/.copilot/mcp-config.json
```
