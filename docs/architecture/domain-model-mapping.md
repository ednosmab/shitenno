---
category: architecture
lifecycle: Active
---

# Domain Model Mapping

> Mapping of each source module to the Meta Model concept it represents.

## Purpose

Every module in the Shitenno should map clearly to one of the [Meta Model](../domain/meta-model.md) concepts. This document validates that mapping.

If a module cannot be associated with a Meta Model concept, its responsibility should be re-evaluated.

---

## Core Modules

### analyser.ts

| Question | Answer |
|----------|--------|
| **Meta Model Concept** | Reality → Observation |
| **Responsability** | Analyze project structure and detect stack, frameworks, and configuration |
| **Knowledge Produced** | Project information (stack, structure, git status) |
| **Knowledge Consumed** | Filesystem state, package manifests |
| **Modifies State?** | No (read-only analysis) |
| **Observes?** | Yes (project structure) |
| **Decides?** | No |
| **Executes?** | No |

---

### scorer.ts

| Question | Answer |
|----------|--------|
| **Meta Model Concept** | Observation → Engineering State |
| **Responsability** | Compute complexity score from static and behavioral metrics |
| **Knowledge Produced** | Complexity score, per-area scores |
| **Knowledge Consumed** | Project metrics (packages, commits, violations) |
| **Modifies State?** | No (produces score, does not persist) |
| **Observes?** | Yes (metrics) |
| **Decides?** | No |
| **Executes?** | No |

---

### pattern-detector.ts

| Question | Answer |
|----------|--------|
| **Meta Model Concept** | Observation → Knowledge |
| **Responsability** | Detect recurring patterns from historical data |
| **Knowledge Produced** | Patterns (recurring errors, reverted decisions, hot areas) |
| **Knowledge Consumed** | History, commits, validation results |
| **Modifies State?** | No (produces patterns, does not persist) |
| **Observes?** | Yes (history) |
| **Decides?** | No |
| **Executes?** | No |

---

### knowledge-debt.ts

| Question | Answer |
|----------|--------|
| **Meta Model Concept** | Observation → Knowledge Debt |
| **Responsability** | Detect gaps between expected and actual knowledge artifacts |
| **Knowledge Produced** | Knowledge debt entries (10 types) |
| **Knowledge Consumed** | Filesystem artifacts, project structure |
| **Modifies State?** | No (produces debt list, does not persist) |
| **Observes?** | Yes (artifact presence) |
| **Decides?** | No |
| **Executes?** | No |

---

### health-auditor.ts

| Question | Answer |
|----------|--------|
| **Meta Model Concept** | Observation → Engineering State |
| **Responsability** | Audit governance health through deduction-based scoring |
| **Knowledge Produced** | Health score, deduction details |
| **Knowledge Consumed** | Governance artifacts, rules, violations |
| **Modifies State?** | No (produces score, does not persist) |
| **Observes?** | Yes (governance artifacts) |
| **Decides?** | No |
| **Executes?** | No |

---

### capability-engine.ts (maturity-profile.ts)

| Question | Answer |
|----------|--------|
| **Meta Model Concept** | Knowledge → Capabilities |
| **Responsability** | Evaluate capability maturity and recommend installations |
| **Knowledge Produced** | Capability scores, recommendations |
| **Knowledge Consumed** | Maturity dimensions, installed capabilities |
| **Modifies State?** | No (produces recommendations, does not persist) |
| **Observes?** | Yes (maturity dimensions) |
| **Decides?** | No (recommends, does not decide) |
| **Executes?** | No |

---

### engineering-state.ts (state-manager.ts)

| Question | Answer |
|----------|--------|
| **Meta Model Concept** | Capabilities → Engineering State |
| **Responsability** | Consolidate three tiers into a single snapshot |
| **Knowledge Produced** | Engineering State snapshot |
| **Knowledge Consumed** | Knowledge state, project state, session memory |
| **Modifies State?** | No (read-only consolidation) |
| **Observes?** | Yes (all three tiers) |
| **Decides?** | No |
| **Executes?** | No |

---

### recommendation-engine.ts

| Question | Answer |
|----------|--------|
| **Meta Model Concept** | Engineering State → Decisions |
| **Responsability** | Generate next best actions with confidence scores |
| **Knowledge Produced** | Recommendations (next actions) |
| **Knowledge Consumed** | Engineering State, knowledge debt, maturity profile |
| **Modifies State?** | No (produces recommendations, does not persist) |
| **Observes?** | Yes (Engineering State) |
| **Decides?** | No (recommends, does not decide) |
| **Executes?** | No |

---

### auto-evolution.ts

| Question | Answer |
|----------|--------|
| **Meta Model Concept** | Decisions → Actions |
| **Responsability** | Generate self-evolution recommendations for the system itself |
| **Knowledge Produced** | Evolution recommendations |
| **Knowledge Consumed** | System state, knowledge debt, feedback history |
| **Modifies State?** | No (produces recommendations, does not persist) |
| **Observes?** | Yes (system state) |
| **Decides?** | No (recommends, does not decide) |
| **Executes?** | No |

---

### feedback-loops.ts

| Question | Answer |
|----------|--------|
| **Meta Model Concept** | Actions → Project Evolution (Learning) |
| **Responsability** | Record recommendation acceptance/rejection and influence future recommendations |
| **Knowledge Produced** | Feedback records, confidence adjustments |
| **Knowledge Consumed** | Recommendation history, acceptance/rejection outcomes |
| **Modifies State?** | Yes (updates confidence scores) |
| **Observes?** | Yes (recommendation outcomes) |
| **Decides?** | No |
| **Executes?** | Yes (updates feedback records) |

---

### rule-engine.ts

| Question | Answer |
|----------|--------|
| **Meta Model Concept** | Infrastructure (not a Meta Model concept) |
| **Responsability** | Evaluate declarative rules and execute actions |
| **Knowledge Produced** | Rule execution results |
| **Knowledge Consumed** | Rule definitions, event context |
| **Modifies State?** | Depends on rule actions |
| **Observes?** | Yes (events) |
| **Decides?** | No (evaluates rules, does not decide) |
| **Executes?** | Yes (rule actions) |

---

### event-bus.ts

| Question | Answer |
|----------|--------|
| **Meta Model Concept** | Infrastructure (not a Meta Model concept) |
| **Responsability** | Distribute events between modules |
| **Knowledge Produced** | Event distribution |
| **Knowledge Consumed** | Events from producers |
| **Modifies State?** | No (distribution only) |
| **Observes?** | Yes (events) |
| **Decides?** | No |
| **Executes?** | Yes (event distribution) |

---

### pipeline.ts

| Question | Answer |
|----------|--------|
| **Meta Model Concept** | Infrastructure (not a Meta Model concept) |
| **Responsability** | Orchestrate analysis stages in sequence |
| **Knowledge Produced** | Pipeline execution results |
| **Knowledge Consumed** | Stage definitions, shared state |
| **Modifies State?** | No (orchestration only) |
| **Observes?** | Yes (stage outputs) |
| **Decides?** | No |
| **Executes?** | Yes (stage orchestration) |

---

### knowledge-graph.ts

| Question | Answer |
|----------|--------|
| **Meta Model Concept** | Knowledge → Engineering Assets (Relations) |
| **Responsability** | Model and analyze relationships between knowledge artifacts |
| **Knowledge Produced** | Graph analysis, orphan detection, connection strength |
| **Knowledge Consumed** | Artifact definitions, relation definitions |
| **Modifies State?** | Yes (updates graph structure) |
| **Observes?** | Yes (artifacts and relations) |
| **Decides?** | No |
| **Executes?** | No |

---

### shitenno-state-machine.ts

| Question | Answer |
|----------|--------|
| **Meta Model Concept** | Infrastructure (lifecycle gates) |
| **Responsability** | Govern Shugo's own lifecycle: uninitialized → discovered → assessed → governed → evolved |
| **Knowledge Produced** | Current lifecycle state |
| **Knowledge Consumed** | State transitions, validation results |
| **Modifies State?** | Yes (transitions state) |
| **Observes?** | Yes (validation results) |
| **Decides?** | No (evaluates transitions, does not decide) |
| **Executes?** | Yes (state transitions) |

---

### plugin-system.ts

| Question | Answer |
|----------|--------|
| **Meta Model Concept** | Infrastructure (extensibility) |
| **Responsability** | Load and execute plugins through hooks |
| **Knowledge Produced** | Plugin execution results |
| **Knowledge Consumed** | Plugin definitions, hook context |
| **Modifies State?** | Depends on plugin |
| **Observes?** | Yes (hook context) |
| **Decides?** | No |
| **Executes?** | Yes (plugin hooks) |

---

## Commands

Each command maps to a Meta Model concept based on its primary function:

| Command | Meta Model Concept | Primary Function |
|---------|-------------------|------------------|
| `init` | Reality → Observation | Scaffold governance structure |
| `status` | Engineering State | Show current state |
| `detect` | Observation → Knowledge | Detect patterns |
| `audit` | Observation → Engineering State | Audit governance health |
| `evolve` | Engineering State → Decisions | Generate recommendations |
| `run` | Full Meta Model flow | Execute all stages |
| `upgrade` | Knowledge → Capabilities | Install capabilities |
| `validate` | Engineering State | Validate session integrity |
| `sync` | Knowledge → Engineering Assets | Sync governance from external |
| `assess` | Knowledge → Capabilities | Re-evaluate maturity |
| `clean` | Infrastructure | Clean cache and temp files |
| `doctor` | Engineering State | System health diagnostics |
| `report` | Engineering State | Generate reports |

---

## Modules That Need Re-evaluation

| Module | Issue | Recommendation |
|--------|-------|----------------|
| `rule-engine.ts` | Maps to Infrastructure, not a Meta Model concept | Consider if it should be split into domain-aligned modules |
| `event-bus.ts` | Maps to Infrastructure, not a Meta Model concept | Acceptable as infrastructure — events are a cross-cutting concern |
| `pipeline.ts` | Maps to Infrastructure, not a Meta Model concept | Acceptable as infrastructure — orchestration is a cross-cutting concern |

---

*This document maps source modules to the Meta Model. For the Meta Model definition, see [../domain/meta-model.md](../domain/meta-model.md).*

*Last updated: 2026-06-28*
