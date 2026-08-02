---
category: adr
lifecycle: Active
---

# ADR-003: Knowledge Graph as Foundation for Documentation

> ⚠️ **Retroactive ADR** — documented 2026-07-05, decision made
> earlier during development. This document reconstructs the
> reasoning post-hoc; it may not capture all alternatives
> considered at the original decision time.

**Status:** Accepted
**Date:** 2026-07-01
**Deciders:** Tech Lead

## Context

Documentation in software projects typically becomes stale because it's maintained separately from the code. The Shugo system needs documentation that reflects the actual state of the system, not a historical snapshot that drifts over time.

## Decision

Use the Knowledge Graph as the foundational data structure for all documentation generation. The graph discovers artifacts (ADRs, skills, contracts, workflows), builds relationships between them, and produces a health score. Documentation is generated from this graph, ensuring it always reflects the current system state.

## Consequences

### Positive

- Documentation is always up-to-date (derived from graph, not manually maintained)
- Orphan detection identifies unused artifacts
- Cycle detection prevents knowledge deadlocks
- Health scoring provides quantitative documentation quality metric

### Negative

- Graph computation has startup cost (mitigated by persistence)
- Initial setup requires populating the graph with artifacts
- Complex relationships may be hard to visualize

## Alternatives Considered

### Option A: Manual Documentation
- Pros: Full control over content and formatting
- Cons: Always stale, requires human discipline, doesn't scale

### Option B: Auto-generated from Code Comments
- Pros: Always reflects code
- Cons: Limited to code-level concerns, misses architectural decisions

## References

- `src/knowledge-graph.ts` (668 lines, 14 relation types)
- `src/engineering-state.ts` (graph integration at lines 530-534)
- `shitenno/governance/knowledge-graph/` (persistence directory)
