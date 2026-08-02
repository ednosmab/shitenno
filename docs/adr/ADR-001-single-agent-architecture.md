---
category: adr
lifecycle: Active
---

# ADR-001: Single Agent Architecture

> ⚠️ **Retroactive ADR** — documented 2026-07-05, decision made
> earlier during development. This document reconstructs the
> reasoning post-hoc; it may not capture all alternatives
> considered at the original decision time.

**Status:** Accepted
**Date:** 2026-07-01
**Deciders:** Tech Lead

## Context

The original design had 3 separate AI agent roles: Planner, Executor, and Reviewer. Each had its own contract, context window, and operational scope. In practice, this created overhead: context switching between agents, duplicated state management, and coordination complexity that exceeded the benefits of separation.

## Decision

Consolidate all 3 roles into a single "Senior Full-Stack Architect" agent with full autonomy over the monorepo. The agent operates with T-shaped knowledge: deep in architecture, broad in implementation. The original roles (Planner, Executor, Reviewer) become operational modes rather than separate entities.

## Consequences

### Positive

- Eliminates inter-agent coordination overhead
- Reduces context window waste from role-switching
- Enables faster iteration cycles
- Single source of truth for session state

### Negative

- Loss of role-based separation of concerns (mitigated by operational modes)
- Higher risk of scope creep (mitigated by FORBIDDEN_OPERATIONS rules)
- Single point of failure (mitigated by session validation scripts)

## Alternatives Considered

### Option A: Keep 3 Separate Agents
- Pros: Clean separation of concerns, independent failure modes
- Cons: Coordination overhead, context duplication, slower iteration

### Option B: Orchestrator + 2 Workers
- Pros: Central coordination with specialized workers
- Cons: Still has inter-agent overhead, orchestrator becomes bottleneck

## References

- `governance/agents/AI-CONTRACT-*.yaml` (original 3-role contracts)
- `docs/AGENTS.md` rule #1 (single agent consolidation)
