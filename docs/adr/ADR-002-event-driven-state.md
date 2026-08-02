---
category: adr
lifecycle: Active
---

# ADR-002: Event-Driven Architecture with Centralized Engineering State

> ⚠️ **Retroactive ADR** — documented 2026-07-05, decision made
> earlier during development. This document reconstructs the
> reasoning post-hoc; it may not capture all alternatives
> considered at the original decision time.

**Status:** Accepted
**Date:** 2026-07-01
**Deciders:** Tech Lead

## Context

The Shugo system has multiple independent modules (rule engine, knowledge graph, capability engine, pipeline, etc.) that need to react to changes in the system state. Without a coordination mechanism, these modules would need direct imports of each other, creating circular dependencies and tight coupling.

## Decision

Use an event bus (pub/sub) as the primary communication mechanism between modules. The Engineering State serves as the single source of truth, and all state mutations flow through the event bus. Each module subscribes to events it cares about and publishes events when it mutates state.

## Consequences

### Positive

- Modules are fully decoupled — no direct imports between peers
- Event history provides audit trail for debugging
- New modules can be added without modifying existing ones
- Correlation IDs enable tracing across event chains

### Negative

- Event-driven flow is harder to debug than synchronous calls
- Potential for event storms if not carefully scoped
- Requires discipline in event naming and payload design

## Alternatives Considered

### Option A: Direct Module Imports
- Pros: Simple, synchronous, easy to debug
- Cons: Circular dependencies, tight coupling, hard to extend

### Option B: Message Queue (external)
- Pros: Persistent, distributed, scalable
- Cons: Overkill for a CLI tool, adds infrastructure dependency

## References

- `src/event-bus.ts` (27 event types, JSONL persistence)
- `src/engineering-state.ts` (centralized state consolidation)
- `governance/SYSTEM_MAP.md` (architecture diagram)
