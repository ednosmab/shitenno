---
category: engineering
lifecycle: Active
---

# ADR-005: Automated Task Completion Pipeline

**Status:** Accepted
**Date:** 2026-07-06
**Implemented:** 2026-07-08
**Deciders:** Tech Lead

## Context

During the SA3 governance implementation (see session-2026-07-06-001), the agent marked the task as "Done" immediately after code compiled and tests passed — without following the formal 4-step completion checklist defined in AGENTS.md Rule #21 (documentation updated, backlog updated, criteria validated, decision recorded).

This revealed a systemic gap: there are **15 state management systems** in the Shugo codebase (plan, step, goal, action, backlog, session, document lifecycle, capability, asset, etc.), but most lack automated transition logic. The backlog in particular has **8 documented states** (AGENTS.md Rule #16) but **0 implemented in code** — items only ever transition between "Backlog" and "Done" via manual edits.

A full state transition audit (2026-07-06) identified 10 critical gaps where transitions should exist but don't:

1. Backlog: 8 states documented, 0 implemented in TypeScript
2. Candidate rules: created as "proposed" but no approval/rejection mechanism
3. Engineering assets: all hardcoded to "active", never transition
4. Plan engine: `rolling_back` status set but not in type union (type-safety gap)
5. Rule engine: 8 of 17 action types defined but not implemented
6. Event-to-trigger mapping: 30+ distinct events mapped to a single `file_change` trigger
7. Session status: only updated manually in context_buffer.yaml
8. Doc lifecycle auditor: read-only, never applies proposed moves
9. Three event types (`docs.sync.triggered`, `doc.lifecycle.audited`, `system.updated`) not mapped to any trigger
10. `adiado` backlog state has no automated revisit mechanism

## Decision

Implement a **3-layer automated task completion pipeline**:

### Layer 1: Completion Gates (Rule #21 enforcement)

A `validateCompletionGate()` function that checks all 4 criteria before allowing "Done":

1. Tests pass
2. Lint passes
3. Documentation updated (files affected by the task were modified)
4. Backlog status transitioned to `concluído`

This function is integrated into `close-session.ts` as a **hard failure gate** (exit code 1, not a warning).

### Layer 2: Backlog State Machine

A `BacklogTransitionEngine` that implements the 8 states from AGENTS.md Rule #16 with valid transitions:

- `planeado` → `em investigação` | `em implementação`
- `em investigação` → `em implementação` | `encerrado`
- `em implementação` → `em validação`
- `em validação` → `concluído` | `em implementação` (rework)
- `pausado` → `em investigação` | `em implementação`
- `adiado` → (requires `[REVISIT: YYYY-MM-DD]` date)
- `concluído` → (terminal)
- `encerrado` → (terminal)

The engine updates both the BACKLOG.md file and the context_buffer.yaml `completed_tasks` section.

### Layer 3: Event-Driven Pipeline

When `validation_pass` fires (from any validation), the pipeline:

1. Checks if the active task's completion gates all pass
2. If yes: publishes `task.completed` on the event bus
3. The event bus triggers rules that:
   a. Update `context_buffer.yaml` → `current_task.status: "completed"`
   b. Update `BACKLOG.md` → status: `concluído`
   c. Update session status: `completed`
   d. Trigger feedback prompt
   e. Archive stale documentation via `doc-lifecycle-auditor`

A new `update_context_buffer` action type is implemented in the rule engine to enable these transitions.

## Consequences

### Positive

- AGENTS.md Rule #21 (4-step completion checklist) is now enforced by code, not trust
- Backlog states are consistent between documentation and implementation
- Task completion is no longer a manual edit — it's a validated pipeline
- Event-driven architecture (ADR-002) gains a concrete, high-value use case
- The 8 backlog states finally match documented behavior
- Session close becomes a reliable validation gate

### Negative

- Existing tasks in BACKLOG.md with "Done" status don't have transition history — migration needed
- Tasks in "Backlog" status that were implicitly "in progress" will need explicit state assignment
- The pipeline adds startup complexity for simple tasks (mitigated by only running at session close)
- close-session.ts now has a hard dependency on the task-completion module

## Alternatives Considered

### Option A: Gates Only (Layer 1)

- Pros: Minimal code, low risk, enforces Rule #21
- Cons: Backlog states remain unimplemented, no automation, manual edits continue

### Option B: Gates + Backlog States (Layers 1+2)

- Pros: Solves the most critical gap, moderate complexity
- Cons: No event-driven automation, doc lifecycle still manual

### Option C: Full Pipeline (Layers 1+2+3)

- Pros: Complete automation, event-driven, self-healing documentation
- Cons: Most complex, more tests required, higher initial implementation cost

## References

- AGENTS.md Rule #16 (8 backlog states) and Rule #21 (4-step completion checklist)
- ADR-002 (event-driven architecture) — foundation for Layer 3
- ADR-001 (single agent architecture) — gates operate within agent modes
- `src/backlog-writer.ts` — current append-only backlog implementation
- `shitenno/scripts/close-session.ts` — session closure validation
- `src/rule-engine.ts` — event-to-trigger mapping and action executor
- `src/event-bus.ts` — pub/sub event system
- `src/doc-lifecycle-auditor.ts` — read-only document lifecycle
- `governance/context/context_buffer.yaml` — session and task state
- `shitenno/docs/BACKLOG.md` — backlog file with 8-state vocabulary in AGENTS.md
- Session 2026-07-06: full state transition audit (15 systems mapped, 10 gaps identified)
