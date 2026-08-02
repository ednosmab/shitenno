---
category: domain
lifecycle: Active
---

# Knowledge Lifecycle

> Knowledge flows through 9 stages of formalization.

## The Lifecycle

```
Observation → Hypothesis → Experiment → Decision → ADR → Skill → Contract → Automation → Command
```

Each stage formalizes knowledge further. The output of one stage is the input of the next.

---

## The 9 Stages

### Stage 1: Observation

**What:** "I noticed something."
**Formality:** Informal, personal.
**Example:** "When I forget to run tests before committing, bugs slip through."

This is the rawest form of knowledge. It exists in someone's head. It has not been validated or recorded.

---

### Stage 2: Hypothesis

**What:** "I think it works like this."
**Formality:** Tentative, falsifiable.
**Example:** "I think running tests before every commit prevents regression bugs."

A hypothesis is an observation that has been articulated and made testable. It can be confirmed or refuted.

---

### Stage 3: Experiment

**What:** "Let me test it."
**Formality:** Structured, evidence-based.
**Example:** "For 2 weeks, I'll run tests before every commit and track bug rates."

An experiment tests a hypothesis against reality. It produces evidence, not certainty.

---

### Stage 4: Decision

**What:** "We decided to..."
**Formality:** Explicit, recorded.
**Example:** "We decided to require test execution before every commit."

A decision is a commitment to a course of action. It is the moment understanding becomes commitment.

---

### Stage 5: ADR (Architecture Decision Record)

**What:** "Here's the record."
**Formality:** Formal, versioned, with context and consequences.
**Example:** ADR-001: "Require test execution before commit" with context, decision, consequences, alternatives.

An ADR is the formalization of a decision. It records not just what was decided, but why, and what was considered.

---

### Stage 6: Skill

**What:** "This is a pattern."
**Formality:** Reusable, with when-to-apply and when-NOT-to-apply.
**Example:** A skill document describing TDD workflow, including anti-patterns and examples.

A skill extracts the pattern from a decision. It generalizes from a specific decision to a reusable guide.

---

### Stage 7: Contract

**What:** "Agents must follow this."
**Formality:** Binding, with allowed/restricted actions.
**Example:** An AI agent contract requiring test execution before code changes.

A contract formalizes a skill as a constraint. It makes knowledge enforceable on AI agents.

---

### Stage 8: Automation

**What:** "This is automated."
**Formality:** Scripted, repeatable, idempotent.
**Example:** A pre-commit hook that runs tests automatically.

An automation makes knowledge self-executing. It removes the need for human memory or discipline.

---

### Stage 9: Command

**What:** "This is a command."
**Formality:** One-click execution, documented, versioned.
**Example:** `shugo validate` that checks session integrity including test status.

A command is the highest level of formalization. It makes knowledge accessible with a single action.

---

## Stage Properties

| Property | Description |
|----------|-------------|
| **Irreversibility** | Each stage is harder to reverse than the previous |
| **Formality** | Formality increases from Stage 1 to Stage 9 |
| **Traceability** | Later stages reference earlier stages |
| **Enforceability** | Only Stage 7+ can be enforced on AI agents |

---

## Why This Matters

Without a lifecycle, knowledge is just documentation. With a lifecycle, knowledge is a process that compounds.

The lifecycle ensures that:
1. Decisions are recorded (Stage 5)
2. Patterns are extracted (Stage 6)
3. AI agents are governed (Stage 7)
4. Repetitive work is automated (Stage 8)
5. The system evolves (Stage 9)

Teams that master this lifecycle do not just accumulate knowledge — they evolve.

---

## Invariants

1. Each stage formalizes knowledge further
2. The output of one stage is the input of the next
3. Formality increases from Stage 1 to Stage 9
4. Irreversibility increases from Stage 1 to Stage 9
5. Only Stage 7+ can be enforced on AI agents

---

*This document defines the Knowledge Lifecycle. For the formal specification of lifecycle-related concepts, see [ubiquitous-language.md](./ubiquitous-language.md).*

*Last updated: 2026-06-28*
