---
category: domain
lifecycle: Active
---

# Decisions

> How decisions are modeled in the Shitenno.

## Definition

A Decision is a choice made between alternatives, recorded with context, rationale, and consequences. Decisions are the bridge between knowledge and action.

Without explicit decisions, engineering teams repeat themselves. The same questions are debated. The same trade-offs are re-evaluated. The same mistakes are repeated. Decisions make engineering progress cumulative instead of cyclical.

---

## The Nature of Engineering Decisions

Engineering decisions are not the same as general decisions. They have specific characteristics:

### They are Contextual

Every decision depends on context: the project's domain, the team's maturity, the available resources, the existing architecture. A decision made without context is meaningless. A decision recorded without context is unreproducible.

### They are Trade-Offs

Every engineering decision involves trade-offs. Choosing PostgreSQL means not choosing MySQL. Choosing modularity means accepting complexity. Choosing simplicity means accepting limitations. Good decisions acknowledge their trade-offs explicitly.

### They are Consequential

Every decision has consequences — intended and unintended. Choosing a technology means accepting its ecosystem. Choosing a pattern means accepting its constraints. Recording consequences makes future decisions more informed.

### They are Evolvable

Decisions can be superseded. A decision made last year may be wrong this year. The project evolves, the team grows, the domain changes. Superseding a decision is not failure — it is learning.

---

## Recommendation vs. Execution

In the Shugo model, there is a critical distinction between a Recommendation and an Execution:

### Recommendation

A Recommendation is a proposal. It suggests what should be done, explains why, and provides evidence. It does not modify anything.

```
"The Engineering State shows Knowledge Debt in ADRs.
We recommend creating ADRs for the 3 unresolved architectural decisions.
Confidence: 85%. Evidence: 3 decisions detected from commit history."
```

### Execution

An Execution is an action that modifies the project. It creates, updates, or removes artifacts. It follows approval.

```
Created ADR-001.md: "Use PostgreSQL for user data"
Created ADR-002.md: "Adopt module federation for micro-frontends"
Created ADR-003.md: "Deprecate legacy auth module"
```

### The Rule

**Shugo proposes. Humans decide.**

This is not a feature. It is an identity principle. Shugo never auto-applies changes to production code, governance rules, or project structure without explicit human approval.

---

## Decision Lifecycle

A decision follows this lifecycle:

```
Recognition → Deliberation → Commitment → Recording → Supersession/Archive
```

### 1. Recognition

The team recognizes that a decision needs to be made. This may come from:
- A pattern detected by Shugo
- A knowledge gap identified by Knowledge Debt
- A recommendation from the Recommendation Engine
- A human observation

### 2. Deliberation

The team considers alternatives, evaluates trade-offs, and assesses consequences. This is a human process — Shugo provides context, not judgment.

### 3. Commitment

The team commits to a course of action. This is the moment the decision is made. It must be explicit, not implicit.

### 4. Recording

The decision is recorded as an ADR (Architecture Decision Record) with:
- Context: Why this decision was needed
- Decision: What was chosen
- Consequences: What this means for the project
- Alternatives: What was considered and rejected

### 5. Supersession or Archive

Over time, the decision may be:
- **Superseded:** A new decision replaces it. The old ADR remains with status `superseded`.
- **Archived:** The decision is no longer relevant. The ADR remains with status `deprecated`.
- **Validated:** The decision is confirmed as correct. The ADR remains with status `accepted`.

Decisions are never silently deleted. They are preserved for historical reference and learning.

---

## Decisions and the Knowledge Lifecycle

Decisions occupy a critical position in the Knowledge Lifecycle:

```
Observation → Hypothesis → Experiment → Decision → Record → Pattern → Contract → Automation → Command
```

The Decision stage is where understanding becomes commitment. Before a decision, there are hypotheses and experiments. After a decision, there are records, patterns, and automations.

The quality of decisions determines the quality of everything that follows.

---

## Decisions and Engineering State

The Engineering State reflects the quality of decision-making:

- **High decision quality:** ADRs are current, decisions are recorded, patterns are extracted
- **Low decision quality:** ADRs are missing, decisions are implicit, patterns are undetected

Knowledge Debt in ADRs (`adr_missing`, `adr_stale`) directly reflects decision-making gaps.

---

## Decisions and AI

AI agents need context to make good decisions. They need to understand:
- What decisions have been made (ADRs)
- What patterns exist (Skills)
- What constraints apply (Contracts)

Shugo provides this context. It ensures that AI agents make decisions that are consistent with the team's established knowledge.

Without governed context, AI agents make arbitrary decisions. With governed context, AI agents amplify good engineering.

---

## Invariants

1. Every decision must have explicit context
2. Every decision must acknowledge trade-offs
3. Every decision must be recorded (as an ADR)
4. Every decision must be traceable to its rationale
5. Decisions are never silently deleted — they are superseded or archived
6. Shugo proposes, humans decide — this rule is absolute

---

*This document defines how decisions are modeled in the Shitenno. For the formal specification of decision-related concepts, see [ubiquitous-language.md](./ubiquitous-language.md).*

*Last updated: 2026-06-28*
