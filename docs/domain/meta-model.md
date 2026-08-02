---
category: domain
lifecycle: Active
---

# Meta Model

> How the Shitenno interprets a project of engineering.

This document is NOT a pipeline. It is the mental model of the Shugo — the conceptual flow that describes how understanding transforms into evolution.

---

## How Shugo Sees a Project

Shugo sees a project as a continuous transformation of knowledge:

```
Reality
  ↓ (observation)
Observation
  ↓ (formalization)
Knowledge
  ↓ (persistence)
Engineering Assets
  ↓ (evaluation)
Capabilities
  ↓ (measurement)
Engineering State
  ↓ (analysis)
Decisions
  ↓ (selection)
Actions
  ↓ (execution)
Project Evolution
```

This flow describes how understanding transforms. It does not describe how software executes. Every module in the system should map clearly to one of these concepts.

---

## The Elements

### Reality

The actual project: its code, its team, its processes, its history. Reality is what exists, regardless of whether it is understood or documented.

Reality is the source of all observations. It is the raw material that Shugo transforms into knowledge.

### Observation

A perception of something in Reality that deserves attention. Observations are the rawest form of knowledge — insights before they are validated or formalized.

Observations come from multiple sources: humans noticing patterns, AI agents analyzing code, monitoring systems detecting anomalies, analysis engines computing metrics.

The quality of observations determines the quality of everything that follows.

### Knowledge

Validated understanding that has been formalized and stored persistently. Knowledge is information that has been processed, connected, and made actionable.

Knowledge is not the same as data or information. Data is a number. Information is data with context. Knowledge is information with meaning.

The transformation from Observation to Knowledge is the core of the Shugo model.

### Engineering Assets

Persistent artifacts that contain knowledge. Assets are the containers of knowledge — they make knowledge tangible, storable, and connectable.

Without assets, knowledge remains trapped in people's heads. Assets transform knowledge from personal to collective, from temporary to permanent, from opaque to discoverable.

The six types of assets: ADR, Skill, Contract, Workflow, Runbook, Script.

### Capabilities

Modular units of governance functionality that represent dimensions of engineering maturity. Capabilities are not features — they are commitments to govern a specific aspect of engineering practice.

When a team installs a capability, it is accepting governance for a new dimension of its engineering practice. This acceptance must be earned through knowledge, not assumed through installation.

### Engineering State

The measurable condition of a project's engineering practices at a specific point in time. It answers three questions:

1. Where are we now? (maturity profile)
2. What's wrong? (knowledge debt, health issues)
3. What should we do next? (recommendations)

The Engineering State is the single source of truth for understanding a project's actual condition.

### Decisions

Choices made between alternatives, recorded with context, rationale, and consequences. Decisions bridge knowledge and action.

Without explicit decisions, teams repeat themselves. Decisions make engineering progress cumulative instead of cyclical.

### Actions

Operations that modify the project. Actions execute decisions — they change the actual state of the codebase, governance structure, or knowledge artifacts.

Actions are traceable, reversible when possible, and consistent with governance rules.

### Project Evolution

The continuous improvement of the project's engineering practices. Evolution is not about adding features — it is about deepening understanding.

The cycle never ends. Evolution generates new Reality, which generates new Observations, which generates new Knowledge.

---

## The Three Layers

Shugo interprets projects through three layers:

```
┌─────────────────────────────────────────────┐
│              GOVERNANCE LAYER                │
│  Rules, Workflows, Contracts, Premortem     │
│  "How we work"                              │
├─────────────────────────────────────────────┤
│              KNOWLEDGE LAYER                │
│  ADRs, Skills, Runbooks, Scripts            │
│  "What we know"                             │
├─────────────────────────────────────────────┤
│              ANALYSIS LAYER                 │
│  Scoring, Patterns, Health, Debt            │
│  "What we measure"                          │
└─────────────────────────────────────────────┘
```

Each layer depends on the layers below it. You cannot govern what you don't know. You cannot know what you don't measure.

---

## The Three-Tier State

Every piece of information belongs to one of three tiers:

```
┌─────────────────────────────────────────┐
│          KNOWLEDGE (Permanent)           │
│  ADRs, Skills, Contracts, Workflows     │
│  "What we decided"                      │
├─────────────────────────────────────────┤
│           STATE (Current)               │
│  Maturity, Capabilities, Complexity     │
│  "Where we are now"                     │
├─────────────────────────────────────────┤
│          MEMORY (Temporary)             │
│  Session, Task, Blockers, Reminders     │
│  "What we're doing right now"           │
└─────────────────────────────────────────┘
```

Knowledge is permanent. State is current. Memory is temporary. Mixing these tiers causes confusion, bugs, and governance failures.

---

## The Governance Loop

Shugo operates in a continuous governance loop:

```
ASSESS → RECOMMEND → APPROVE → IMPLEMENT → (re-assess)
```

1. **Assess** — Measure current state
2. **Recommend** — Suggest next actions
3. **Approve** — Human decides
4. **Implement** — Execute approved actions
5. **Re-assess** — Measure the effect

The loop never ends. Governance is not a destination; it is a practice.

---

## The Key Insight

Shugo is not a tool you use. It is a system that uses your project data to understand itself and recommend its own evolution.

The CLI is the interface. The system is the intelligence. The governance is the value.

---

## Invariants

1. This flow is NOT a pipeline — it is a mental model
2. Every module must map to one of these concepts
3. Modules that cannot be mapped should have their responsibility re-evaluated
4. The flow is cyclical — evolution generates new reality
5. The Engineering State is the single source of truth

---

*This document defines how the Shitenno interprets projects. For the formal specification of each concept, see [ubiquitous-language.md](./ubiquitous-language.md).*

*Last updated: 2026-06-28*
