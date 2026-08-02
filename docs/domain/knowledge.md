---
category: domain
lifecycle: Active
---

# Knowledge

> What knowledge means in the Shitenno.

## Definition

Knowledge is validated understanding that has been formalized and stored persistently. It is not raw data. It is not information. It is understanding that has been processed, connected, and made actionable.

> For the formal domain specification, see [ubiquitous-language.md](./ubiquitous-language.md#knowledge).

The distinction matters:

- **Data** is a number, a log entry, a metric. It tells you what happened.
- **Information** is data with context. It tells you what happened and when.
- **Knowledge** is information with meaning. It tells you what happened, when, why it matters, and what to do about it.

Shugo exists to transform data into knowledge, and knowledge into engineering capability.

---

## The Nature of Engineering Knowledge

Engineering knowledge is not the same as general knowledge. It has specific characteristics:

### It is Decision-Oriented

Engineering knowledge exists to support decisions. If a piece of knowledge does not help someone make a better decision, it is not engineering knowledge — it is documentation.

### It is Connected

Isolated knowledge decays. Connected knowledge compounds. An ADR that references a skill, which references a contract, which references a workflow — this chain of connections makes knowledge resilient. Breaking any single link does not destroy the knowledge.

### It is Evolving

Engineering knowledge is not static. It evolves as the team learns, as the project grows, and as the domain changes. A decision made last year may be superseded this year. A pattern detected last month may be formalized this month. Knowledge that does not evolve decays.

### It is Governed

Engineering knowledge must be governed. Without governance, knowledge becomes stale, contradictory, and unreliable. Shugo provides the governance structure that keeps knowledge healthy.

---

## The Three States of Knowledge

In the Shugo model, knowledge exists in three states:

### Tacit Knowledge

Knowledge that exists in people's heads but has not been recorded. It is powerful but fragile — it walks out the door when someone leaves.

```
"I know this module is fragile because I've been called at 3am to fix it."
```

### Explicit Knowledge

Knowledge that has been recorded in structured artifacts. It is durable and shareable, but requires effort to maintain.

```
ADR-005: "Module X is fragile. It has caused 3 incidents in 6 months. 
We decided to add integration tests and limit its responsibilities."
```

### Operational Knowledge

Knowledge that has been embedded in automation, rules, or constraints. It is enforceable and self-executing, but requires the highest level of formalization.

```
Rule: "When module X is modified, automatically trigger integration test suite."
```

The Knowledge Lifecycle describes how knowledge moves from tacit to explicit to operational.

---

## Knowledge and the Three-Tier State

Knowledge belongs to the **Knowledge tier** of the Three-Tier State model:

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

Knowledge is permanent. It survives across sessions. It is not affected by session cleanup. It is the foundation that State and Memory depend on.

---

## Knowledge Debt

When knowledge is missing, stale, or disconnected, it creates Knowledge Debt. This is the silent killer of engineering productivity.

Knowledge Debt manifests in ten types:

1. **ADR Missing** — Decisions made but not recorded
2. **Runbook Missing** — Operational tasks without procedures
3. **Skill Missing** — Patterns detected but not formalized
4. **Docs Missing** — Critical governance documentation absent
5. **Automation Missing** — Manual processes that should be automated
6. **Contract Missing** — AI agents without governance constraints
7. **Workflow Missing** — No defined process for operations
8. **Review Missing** — No session review process
9. **Test Missing** — No tests for codebase
10. **ADR Stale** — Records referencing outdated information

Each type represents a gap between what should exist and what does exist. Shugo detects these gaps before they compound.

---

## Knowledge and AI

AI agents need knowledge to be useful. Without governed context, AI operates blindly — generating code that conflicts with patterns, violating unwritten rules, and repeating decisions.

Shugo provides the bridge between human knowledge and AI capability:

```
Human Knowledge → Engineering Assets → Governed Context → AI Agent
```

The Knowledge tier provides the raw material. The Governance tier structures it. The AI tier consumes it. This is not about replacing human judgment — it is about giving AI the structure it needs to amplify good engineering.

---

## Knowledge and Evolution

Knowledge compounds when it flows through the Knowledge Lifecycle:

```
Observation → Hypothesis → Experiment → Decision → Record → Pattern → Contract → Automation → Command
```

Each stage makes knowledge more formal, more reusable, and more enforceable. Teams that master this lifecycle do not just accumulate knowledge — they evolve.

The Engineering State measures how well this lifecycle is functioning. A team with high knowledge maturity has knowledge flowing through all stages. A team with low maturity has knowledge stuck at early stages.

---

## Invariants

1. Knowledge must have a traceable origin
2. Knowledge must be stored persistently
3. Knowledge must be connected to other knowledge
4. Knowledge must be governable
5. Knowledge must evolve over time

---

*This document defines what knowledge means in the Shitenno. For the formal specification of knowledge-related concepts, see [ubiquitous-language.md](./ubiquitous-language.md).*

*Last updated: 2026-06-28*
