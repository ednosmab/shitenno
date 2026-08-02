---
category: adr
lifecycle: Active
---

# ADR-004: Event Bus Orphaned Events Triage

> ⚠️ **Retroactive ADR** — documented 2026-07-05, decision made
> during final corrections audit. This document reconstructs the
> reasoning post-hoc; it may not capture all alternatives
> considered at the original decision time.

**Status:** Accepted
**Date:** 2026-07-05
**Deciders:** Tech Lead

## Context

The Shugo event bus (`src/event-bus.ts`) declares 33 event types in `ShitennoEventType`. Of these:

- **3 have real subscribers** that produce visible side effects:
  - `adr.created` — rule engine logs a suggestion
  - `skill.created` — rule engine logs a suggestion
  - `capability.installed` — rule engine logs a suggestion
- **13 are signed by the rule engine but always no-op** (no rules loaded → event is published and immediately discarded):
  - `analysis.complete`, `score.calculated`, `evolution.recommended`, `asset.created`, `asset.updated`, `asset.archived`, `pipeline.stage.start`, `pipeline.stage.complete`, `lifecycle.state_changed`, `knowledge.analyzed`, `engineering_state.updated`, `engineering_state.consolidated`, `recommendation.accepted`, `recommendation.rejected`, `governance.policy_applied`, `entropy.calculated`
- **17 have no subscriber at all**:
  - `capability.unlocked`, `debt.detected`, `doc.lifecycle.audited`, `health.checked`, `knowledge_debt.detected`, `maturity.changed`, `pattern.detected`, `pipeline.complete`, `rule.triggered`, `session.end`, `session.start`, `system.updated`, `validation.completed`

The cost of orphaned events is real but low: each publish serializes a payload, iterates handlers (empty set), and discards. No crash, no memory leak — but CPU cycles are wasted on events nobody consumes.

## Decision

**Triage each orphaned event into one of three categories: connect now, reserve, or remove.** Do NOT connect all events blindly — most don't need subscribers today. The triage criteria:

### Connect Now (high ROI)

| Event | Subscriber | Rationale |
|-------|-----------|-----------|
| `session.end` | session-tracker (already exists) | Session lifecycle tracking needs completion signal |
| `validation.completed` | briefing-cache | Briefing should refresh after validation |
| `health.checked` | dashboard data collector | Dashboard needs health audit results |

### Reserve (potential future value, keep publishing)

| Event | Rationale |
|-------|-----------|
| `session.start` | Useful for telemetry once persistence is active |
| `pipeline.complete` | Useful when pipeline stages are implemented |
| `pattern.detected` | Useful for insights-notifier (dashboard alerts) |
| `knowledge_debt.detected` | Useful for proactive alerts in briefing |
| `debt.detected` | Useful for knowledge-debt module integration |
| `maturity.changed` | Useful for maturity tracking dashboard |
| `capability.unlocked` | Useful for progress notifications |
| `system.updated` | Useful for change tracking |

### Remove (never needed, remove from ShitennoEventType + all publish calls)

| Event | Rationale |
|-------|-----------|
| `doc.lifecycle.audited` | Doc lifecycle auditor has its own reporting path |
| `rule.triggered` | Rule engine already logs directly |
| `docs.sync.triggered` | Sync command has its own output |

## Consequences

### Positive

- Clear inventory of which events have consumers vs which are dead code
- Reduces confusion for contributors — no mystery "who listens to this?"
- Connect-now events produce real value (session tracking, dashboard data)
- Reserve events are documented as intentional forward-looking design

### Negative

- Three events removed — any future code that publishes them will need re-adding
- Reserve events still consume CPU on publish (mitigated: negligible per-event cost)

## Alternatives Considered

### Option A: Connect All Events

Connect all 17 orphaned events to some subscriber.

- Pros: Every event has a consumer
- Cons: Forces artificial subscribers that don't produce real value; maintenance burden for subscribers nobody uses

### Option B: Remove All Orphaned Events

Delete all events without subscribers.

- Pros: Cleanest codebase
- Cons: Loses intentional forward-looking design (session.start, pipeline.complete, etc.); forces re-adding when features land

## Event Bus Health (Post-Triage)

| Metric | Before | After |
|--------|--------|-------|
| Total event types | 33 | 30 (3 removed) |
| Events with real subscribers | 3 | 6 (+3 connect-now) |
| Events reserved (no subscriber yet) | 13+17=30 | 21 (8 reserved) |
| Events removed | 0 | 3 |

## References

- `src/event-bus.ts` (event type declarations)
- `src/rule-engine.ts` (subscriber map, lines 721-863)
- `docs/architecture/event-bus.md` (architecture doc)
- ADR-002 (event-driven architecture decision)
