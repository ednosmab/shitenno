---
category: domain
lifecycle: Active
---

# Engineering Assets

> What characterizes an engineering asset and how assets relate to knowledge.

## Definition

An Engineering Asset is a persistent artifact that contains knowledge. Assets are the containers of knowledge — they make knowledge tangible, storable, and connectable.

Without assets, knowledge remains tacit — trapped in people's heads, lost between sessions, unavailable to AI agents. Assets transform knowledge from personal to collective, from temporary to permanent, from opaque to discoverable.

---

## What Characterizes an Asset

An engineering asset has five characteristics:

### 1. It Contains Knowledge

An asset without knowledge is just a file. A README without content is not an asset. An ADR that says "we made a decision" without explaining what or why is not an asset. The knowledge is the asset's reason for existing.

### 2. It is Persistent

Assets survive across sessions. They are stored on disk, versioned in git, and available to anyone who needs them. They are not temporary notes or session artifacts.

### 3. It is Connected

An asset that exists in isolation decays. An asset connected to other assets compounds. The Knowledge Graph models these connections. An ADR that references a Skill, which references a Contract, which references a Workflow — this chain makes knowledge resilient.

### 4. It is Discoverable

An asset that cannot be found does not exist. Assets must be organized in predictable locations, named consistently, and indexed for search. The Capability system defines where assets live. The Knowledge Graph makes them discoverable.

### 5. It is Governable

An asset that cannot be governed decays. Assets must be auditable — checkable for staleness, completeness, and consistency. The Health Auditor examines assets. Knowledge Debt detection identifies missing assets.

---

## The Six Types of Engineering Assets

### ADR (Architecture Decision Record)

A formal document recording an architectural decision: context, decision, consequences, alternatives considered.

**What it captures:** Why a decision was made, not just what was decided.

**When it is created:** When a team commits to an architectural choice after considering alternatives.

**Statuses:** `accepted`, `superseded`, `deprecated`.

**Lifecycle:** Created as `accepted`. May be `superseded` by a newer ADR. Rarely `deprecated` — usually superseded instead.

---

### Skill

A reusable engineering pattern extracted from experience. It describes when to apply a technique, when NOT to apply it, and what anti-patterns to avoid.

**What it captures:** The wisdom of experience, not just the steps of a procedure.

**When it is created:** When a pattern is detected from history and formalized as a reusable guide.

**Structure:** Description, when to apply, when NOT to apply, example, anti-patterns.

---

### Contract

A formal agreement defining an AI agent's permissions, responsibilities, and constraints. It specifies what an agent may do, what it must not do, and what happens when it fails.

**What it captures:** The governance boundaries for AI agents.

**When it is created:** When an AI agent needs to operate within a project's governance structure.

**Structure:** Allowed actions, restricted actions, inputs, outputs, failure policy.

---

### Workflow

A defined sequence of steps for a specific operation type (FEATURE, BUG, REFACTOR, etc.). It is the single entry point for all agents performing that type of work.

**What it captures:** The process that must be followed, not just the outcome that must be achieved.

**When it is created:** When a team needs to standardize how a type of work is performed.

**Structure:** Steps, decision points, required artifacts, validation criteria.

---

### Runbook

A step-by-step procedure for a specific operational task (merge, deploy, rollback).

**What it captures:** The exact steps to perform an operation reliably.

**When it is created:** When an operational task needs to be performed consistently by different people or AI agents.

**Structure:** Preconditions, steps, verification, rollback procedure.

---

### Script

An automated procedure that executes a governance behavior. Scripts are the operationalization of knowledge — they make knowledge self-executing.

**What it captures:** Knowledge that has been embedded in automation.

**When it is created:** When a manual process needs to be automated for consistency and reliability.

**Structure:** Purpose, inputs, outputs, side effects, error handling.

---

## Asset Lifecycle

Assets follow a lifecycle:

```
Creation → Active → Reviewed → Superseded/Archived
```

1. **Creation:** The asset is created with initial content.
2. **Active:** The asset is current and being referenced.
3. **Reviewed:** The asset has been checked for accuracy and relevance.
4. **Superseded:** A newer asset replaces this one. The old asset remains for historical reference.
5. **Archived:** The asset is no longer relevant but is preserved for audit purposes.

Assets are never silently deleted. They are superseded or archived with a clear reason.

---

## Assets and the Knowledge Graph

Every asset is a node in the Knowledge Graph. Relations between assets are edges:

```
ADR ──generates──▶ Skill
Skill ──uses──▶ Contract
Contract ──executes──▶ Script
Script ──supersedes──▶ Manual Process
Workflow ──references──▶ ADR
Runbook ──executes──▶ Script
```

The graph makes knowledge discoverable and connected. Isolated assets decay. Connected assets compound.

---

## Assets and Capabilities

Each Capability creates specific assets. The Capability system detects installed assets to determine which capabilities are active:

| Capability | Assets Created |
|------------|---------------|
| core | Governance docs, scripts, templates |
| knowledge | Skills |
| architecture | ADRs, SDRs, plans |
| governance | Workflows, context buffers |
| ai | Agent contracts, cognition docs |
| quality | Validation scripts |
| metrics | Reports, history |
| operations | Runbooks, close scripts |
| compliance | Premortem docs, reviews |

---

## Assets and Knowledge Debt

Knowledge Debt is measured as the gap between expected assets and actual assets. When an asset type is expected but absent, it creates a debt entry.

For example:
- A project with architectural decisions but no ADRs → `adr_missing` debt
- A project with AI agents but no contracts → `contract_missing` debt
- A project with operational tasks but no runbooks → `runbook_missing` debt

Shugo detects these gaps and recommends creating the missing assets.

---

## Invariants

1. Every asset must contain knowledge
2. Every asset must be persistent (stored on disk)
3. Every asset must be connected to other assets
4. Every asset must be discoverable (predictable location, consistent naming)
5. Every asset must be governable (auditable for staleness and completeness)
6. Assets are never silently deleted — they are superseded or archived

---

*This document defines what engineering assets are in the Shitenno. For the formal specification of asset types, see [ubiquitous-language.md](./ubiquitous-language.md).*

*Last updated: 2026-06-28*
