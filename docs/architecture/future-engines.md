---
category: architecture
lifecycle: Active
---

# Future Engines

> Conceptual specification of future engines within the Meta Model.

## Purpose

This document specifies 5 future engines that represent legitimate domain concepts. Each engine maps to a specific transformation in the [Meta Model](../domain/meta-model.md).

**Rule:** No engine should be created just because it is technically needed. It must represent a legitimate concept of the domain.

---

## The Engine Interface

All engines implement a generic interface:

```
Engine<TInput, TOutput> {
  execute(input: TInput): TOutput
}
```

Each engine has:
- **Responsibility:** What it does (domain concept)
- **Input:** What it receives
- **Output:** What it produces
- **Relationships:** How it connects to other engines
- **When to create:** The condition that justifies its existence

---

## 1. Capability Engine

| Property | Value |
|----------|-------|
| **Meta Model** | Knowledge → Capabilities |
| **Responsibility** | Evaluate maturity of each capability dimension |
| **Input** | Knowledge artifacts, maturity dimensions |
| **Output** | Capability scores, installation recommendations |
| **Relationships** | Consumed by Recommendation Engine, produces for Engineering State |
| **When to create** | When capability evaluation logic becomes too complex for a single function |

### Current State

This engine already exists in `maturity-profile.ts` and `capability-mapping.ts`. It is not yet extracted as a standalone engine.

### Extraction Criteria

Extract when:
- Capability evaluation logic exceeds 500 lines
- Multiple consumers need the same evaluation
- The engine needs its own lifecycle (start/stop/health check)

---

## 2. Recommendation Engine

| Property | Value |
|----------|-------|
| **Meta Model** | Engineering State → Decisions |
| **Responsibility** | Recommend next best actions with confidence and justification |
| **Input** | Engineering State (maturity, debt, health, patterns) |
| **Output** | Prioritized recommendations with confidence scores |
| **Relationships** | Consumes Engineering State, produces for Governance Engine, feeds Feedback Loops |
| **When to create** | When recommendation logic requires multiple strategies or learning |

### Current State

This engine already exists in `recommendation-engine.ts`. It is partially extracted.

### Enhancement Criteria

Enhance when:
- Multiple recommendation strategies are needed (urgency-based, maturity-based, debt-based)
- The engine needs to learn from feedback (confidence adjustment)
- Recommendations need to be explainable (justification chains)

---

## 3. Knowledge Engine

| Property | Value |
|----------|-------|
| **Meta Model** | Observation → Knowledge |
| **Responsibility** | Formalize observations into persistent knowledge |
| **Input** | Raw observations (patterns, metrics, anomalies) |
| **Output** | Formalized knowledge (patterns, debt entries, health issues) |
| **Relationships** | Consumes from Analyser, Pattern Detector, Debt Detector; produces for Capability Engine |
| **When to create** | When observation formalization requires multiple stages or learning |

### Current State

This engine does not exist yet. Observation formalization is currently spread across `pattern-detector.ts`, `knowledge-debt.ts`, and `health-auditor.ts`.

### Creation Criteria

Create when:
- Observation formalization logic exceeds 800 lines across modules
- Multiple observation sources need the same formalization
- The engine needs to learn which observations are valuable

---

## 4. Governance Engine

| Property | Value |
|----------|-------|
| **Meta Model** | Decisions → Actions |
| **Responsibility** | Select and sequence actions based on decisions and rules |
| **Input** | Decisions (recommendations), Rules (constraints), Context (project state) |
| **Output** | Execution plans (sequenced actions with dependencies) |
| **Relationships** | Consumes from Recommendation Engine, Rule Engine; produces for Evolution Engine |
| **When to create** | When action sequencing requires complex dependency resolution |

### Current State

This engine does not exist yet. Action sequencing is currently implicit in the CLI commands.

### Creation Criteria

Create when:
- Actions have dependencies that need resolution
- Multiple actions need to be sequenced based on governance rules
- The engine needs to handle conflicts between actions

---

## 5. Evolution Engine

| Property | Value |
|----------|-------|
| **Meta Model** | Actions → Project Evolution |
| **Responsibility** | Track evolution and trigger re-assessment |
| **Input** | Executed actions, outcomes, feedback |
| **Output** | Updated state, evolution evidence, re-assessment triggers |
| **Relationships** | Consumes from Governance Engine, Feedback Loops; produces for Engineering State |
| **When to create** | When evolution tracking requires complex state management |

### Current State

This engine does not exist yet. Evolution tracking is currently implicit in the state machine.

### Creation Criteria

Create when:
- Evolution tracking requires complex state management
- Multiple evolution paths need to be tracked
- The engine needs to trigger re-assessment based on outcomes

---

## Engine Relationships

```
Knowledge Engine → Capability Engine → Engineering State
                                              ↓
                                      Recommendation Engine
                                              ↓
                                      Governance Engine
                                              ↓
                                      Evolution Engine
                                              ↓
                                      (re-assessment triggers Capability Engine)
```

The cycle never ends. Each engine produces knowledge that the next engine consumes.

---

## Implementation Pattern

All engines should follow the same pattern:

```
interface Engine<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>
}
```

Each engine:
- Has a single responsibility
- Consumes typed input
- Produces typed output
- Does not modify state directly (returns modifications as output)
- Is independently testable
- Can be replaced without affecting other engines

---

## Priority

| Engine | Priority | Justification |
|--------|----------|---------------|
| Capability Engine | Low | Already exists, needs extraction |
| Recommendation Engine | Low | Already exists, needs enhancement |
| Knowledge Engine | Medium | Does not exist, high value |
| Governance Engine | Low | Does not exist, moderate value |
| Evolution Engine | Low | Does not exist, moderate value |

---

*This document specifies future engines. For the Meta Model they implement, see [../domain/meta-model.md](../domain/meta-model.md). For current module mapping, see [domain-model-mapping.md](./domain-model-mapping.md).*

*Last updated: 2026-06-28*
