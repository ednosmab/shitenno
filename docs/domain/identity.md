---
category: domain
lifecycle: Active
---

# Identity

> The single source of truth for what Shitenno is. Every other document that needs to explain the project should link here instead of defining identity independently.

---

## What Shitenno Is

Shitenno is an **engineering governance system** for software projects. It analyzes complexity, detects patterns in engineering history, audits governance health, and recommends next actions — so humans and AI agents maintain shared understanding of a project's state across sessions.

It is not a framework, not a platform, not a linter, and not a CI pipeline. It is a system that thinks about how you work.

---

## The Three Components

Shitenno is composed of three tightly related but distinct parts:

### 1. Shugo (the CLI)

The command-line binary — the single entry point for all interaction. Roughly 38 commands organized into core, analysis, governance, context, and utility categories. Built with Commander.js, runs on Node.js ≥ 18.

Shugo is what you install (`npm install -g shitenno`), what you run (`shugo init`, `shugo status`, `shugo run`), and what the AI agent communicates with. It orchestrates analysis, scoring, detection, auditing, and evolution recommendations.

### 2. `.shitenno/` (the per-project artifact)

A directory generated inside the user's project on `shugo init`. Contains:

- `engineering-state.json` — canonical project state
- `maturity-profile.json` — maturity assessment
- `governance/` — rules, policies, workflows, plans
- `docs/` — ADRs, skills, runbooks
- `reports/` — generated reports
- `telemetry/` — session tracking

This is not configuration — it is a generated artifact. It belongs to the project, not to Shitenno. Deleting it and re-running `shugo init` recreates it from analysis.

### 3. The Daemon (background process)

One process per project, spawned by the CLI (via `cli-middleware.ts` auto-start or `shugo daemon start`). Runs detached and unref'd — autonomous after birth, but always spawned by the CLI. The CLI never depends on the daemon; disk fallback is used everywhere (`daemon-client.ts`: *"The daemon is opt-in. The CLI always works without it."*).

The daemon enables real-time governance: file watching, event-driven rule evaluation, proactive suggestions. It is an optional performance layer, not a required component.

### Dependency Relationship

```
Shugo CLI  ──spawns──▶  Daemon (optional, runs isolated)
    │
    └──generates──▶  .shitenno/ (per-project artifact)
```

The daemon needs the CLI to be born. The CLI never needs the daemon to function.

---

## The MCP Bridge

`shugo mcp` runs an MCP (Model Context Protocol) server that bridges human knowledge and AI capability. Confirmed via `mcp-server-handlers.ts`, including a literal `// ── Knowledge Bridge` comment in the code.

**Tools exposed:**

| Tool | Purpose |
|------|---------|
| `getBriefing` | Project context for AI sessions |
| `getRiskMap` | Risk assessment |
| `getRules` | Active governance rules |
| `getEngineeringState` | Current project state |
| `getBacklog` | Active work items |
| `getADRs` | Architecture decisions |
| `getSkills` | Extracted patterns |

**Feedback loop:** `handleSubmitFeedback` records outcome tied to the briefing's hash, enabling the system to learn from AI agent interactions.

---

## The CLI TUI Dashboard

`shugo dashboard` renders `ShitennoConsole` — an interactive TUI that genuinely operates the system. `use-command.ts` executes real `shugo` subcommands via `exec()`, categorized as read-only / management / destructive, with `requiresConfirmation` gating destructive operations.

This is not a read-only viewer. It is a fully operational governance interface.

---

## What It Is Not

| Common Misconception | Why It Does Not Apply |
|---------------------|----------------------|
| **Framework** | Frameworks are imported into application code. Shitenno operates *on* projects, not *inside* them. |
| **Platform** | Platforms are hosted, multi-tenant, SaaS. Shitenno runs locally per project. |
| **Linter** | Linters check syntax/style. Shitenno analyzes governance maturity and knowledge health. |
| **CI Pipeline** | CI pipelines gate merges. Shitenno complements CI by providing governance context. |
| **Documentation tool** | Documentation tools generate docs. Shitenno generates governance artifacts and recommends actions. |
| **Project manager** | PMs track tasks. Shitenno tracks knowledge, decisions, and engineering state. |

---

## Current State vs. Design Direction

Shitenno today is a **working CLI tool** with a daemon, MCP server, and governance engine. It is used by a single developer for solo projects.

**Design direction** (not yet implemented): an ecosystem with a plugin system, capability model, and third-party contributions. The plugin system architecture is specified but not built. "Ecosystem" is aspirational, not current state.

See `docs/evolution/` for the full evolution roadmap.

---

## Terminology Decisions

**Why not "framework"?** A framework is code you import into your application (React, Express, NestJS). Shitenno does not get imported — it analyzes your project from the outside. Using "framework" misleads users about how to interact with it.

**Why not "platform"?** A platform implies hosted infrastructure, multi-tenancy, SaaS. Shitenno is a local CLI tool that runs in your project directory. No server, no accounts, no cloud dependency.

**Why "ecosystem" is design intent, not current state:** The architecture includes a plugin system, capability model, and extension points. But there are no third-party contributors yet, no published plugins, no community. "Ecosystem" describes where the project is heading, not where it is today.

---

## Boundary: Shitenno vs. Product Output

This document describes **Shitenno the system** — the CLI, the daemon, the MCP bridge, the governance engine.

It does **not** describe `src/templates/base/` — the scaffolded template content that Shitenno generates inside end-user projects on `shugo init`. That is a separate documentation domain (the `product` domain, defined in `docs/engineering/DOCUMENTATION_GOVERNANCE.md`). The two must never be merged or confused.

---

*This is the canonical identity document. All other files that explain "what is Shitenno" should link here.*

*Last updated: 2026-07-22*
