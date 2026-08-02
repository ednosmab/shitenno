---
category: product
lifecycle: Active
---

# What Is Shugo

> A plain-language explanation of what Shugo does and why it exists.

For the full canonical definition, see [Identity](../domain/identity.md).

---

## The Problem

Every engineering team accumulates knowledge: architecture decisions, code patterns, runbooks, skills. But this knowledge:

- **Lives in isolation** — each document is an island
- **Decays silently** — nobody checks if it's still valid
- **Lacks context** — you don't know when to use it or why it exists
- **Doesn't compound** — knowledge doesn't generate more knowledge

This creates **Knowledge Debt** — the invisible cost of documented but disconnected engineering knowledge.

---

## What Shugo Is

Shugo is an **engineering governance system** for software projects. It is not a framework, not a linter, and not a CI pipeline.

It:

- **Analyzes** your project's complexity
- **Detects** patterns in engineering history
- **Audits** governance health
- **Recommends** actions based on evidence
- **Adapts** the level of detail to your experience profile

### The Three Components

| Component | Role |
|-----------|------|
| **Shugo CLI** | The command-line binary — the single entry point (~38 commands) |
| **`.shitenno/`** | Per-project generated artifact containing governance data |
| **Daemon** | Optional background process for real-time governance (one per project, spawned by the CLI, runs isolated) |

### The MCP Bridge

`shugo mcp` runs an MCP (Model Context Protocol) server that bridges human knowledge and AI capability. It exposes tools like `getBriefing`, `getRiskMap`, `getRules`, `getEngineeringState`, and more — giving AI agents governed context for your project.

---

## Who It's For

| Team Size | Profile | What Shugo Solves |
|-----------|---------|-------------------|
| **Solo** | Developer working alone who loses context between sessions | Preserves state to resume without re-reading everything |
| **2–5 people** | Small team where knowledge lives in one person's head | Makes tacit knowledge explicit and verifiable |
| **5–15 people** | Growing team where onboarding is painful | New members onboard in hours, not weeks |
| **AI-assisted teams** | Teams where AI agents operate without governance context | Agents receive governed, hierarchical context |

---

## The Three Operational Layers

```
┌─────────────────────────────────────────┐
│  Governance Layer                       │
│  "How we work"                          │
│  Rules, Workflows, Contracts            │
├─────────────────────────────────────────┤
│  Knowledge Layer                        │
│  "What we know"                         │
│  ADRs, Skills, Runbooks, Scripts        │
├─────────────────────────────────────────┤
│  Analysis Layer                         │
│  "What we measure"                      │
│  Scoring, Patterns, Health, Debt        │
└─────────────────────────────────────────┘
```

---

## The Six Immutable Principles

1. **Code Is a Consequence of Knowledge** — well-written comes from well-understood
2. **Architecture Is a Consequence of Domain** — not of frameworks
3. **Capabilities Evolve Before Features** — abilities first, functionality after
4. **AI Amplifies Good Engineering** — it doesn't replace, it amplifies
5. **Every Decision Produces Knowledge** — every choice is a seed
6. **Engineering State Matters More Than Code State** — what we know matters more than what we write

---

## How It Works (Overview)

```
Your Project
    │
    ▼
┌─────────┐    ┌─────────┐    ┌─────────┐
│  INIT   │───▶│ ANALYSE │───▶│  SCORE  │
└─────────┘    └─────────┘    └─────────┘
                                  │
                                  ▼
┌─────────┐    ┌─────────┐    ┌─────────┐
│ EVOLVE  │◀───│  AUDIT  │◀───│ DETECT  │
└─────────┘    └─────────┘    └─────────┘
```

1. **Init** — Installs governance in your project
2. **Analyse** — Detects stack, packages, maturity
3. **Score** — Calculates health score (0–100)
4. **Detect** — Finds patterns in history
5. **Audit** — Verifies governance integrity
6. **Evolve** — Recommends next actions

---

## Next Step

→ [Installation](installation.md)
