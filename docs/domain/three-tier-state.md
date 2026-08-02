---
category: domain
lifecycle: Active
---

# Three-Tier State

> Knowledge is permanent. State is current. Memory is temporary.

## The Principle

Every piece of information in Shugo belongs to exactly one of three tiers. Mixing these tiers causes confusion, bugs, and governance failures.

---

## The Three Tiers

### Knowledge (Permanent)

Knowledge artifacts survive across sessions. They represent decisions made, patterns discovered, and agreements formalized.

**Lifetime:** Until explicitly archived or deleted.
**Examples:** ADRs, skills, contracts, workflows, runbooks, scripts.
**What it answers:** "What did we decide?"

Knowledge is the foundation. State and Memory depend on it. Without knowledge, there is nothing to govern.

---

### State (Current)

State represents where the project is right now. It changes as the project evolves.

**Lifetime:** Overwritten on each analysis.
**Examples:** Maturity score, complexity score, installed capabilities, knowledge debt.
**What it answers:** "Where are we now?"

State is a snapshot. It is not history — it is the current condition. It is computed from evidence, not opinion.

---

### Memory (Temporary)

Memory exists only for the duration of a session. It tracks what's happening right now.

**Lifetime:** Single session, cleared on session close.
**Examples:** Current task, blockers, reminders, loaded documents.
**What it answers:** "What are we doing right now?"

Memory is ephemeral. It exists to support the current session. When the session ends, Memory is cleared. Nothing in Memory should be critical enough to lose.

---

## Why Separation Matters

| Without Separation | With Separation |
|-------------------|-----------------|
| A session reminder looks like an ADR | Reminders are in Memory, ADRs in Knowledge |
| A maturity score gets archived with decisions | Scores are in State, decisions in Knowledge |
| Clearing session data deletes governance docs | Session cleanup only touches Memory |
| AI agents confuse temporary with permanent | Agents can be told which tier to read |

---

## The Consolidation

The three tiers are read independently and merged into a single snapshot. This snapshot is read-only — it never modifies state.

The consolidation answers all three questions simultaneously:
- Knowledge: "What do we know?"
- State: "Where are we now?"
- Memory: "What are we doing right now?"

This snapshot is what the Recommendation Engine uses to generate next actions.

---

## Invariants

1. Every piece of information belongs to exactly one tier
2. Knowledge is never cleared automatically
3. State is overwritten on each analysis (not accumulated)
4. Memory is cleared on session close
5. The consolidation is read-only — it never modifies state

---

*This document defines the Three-Tier State model. For the formal specification of state-related concepts, see [ubiquitous-language.md](./ubiquitous-language.md).*

*Last updated: 2026-06-28*
