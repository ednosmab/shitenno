---
category: evolution
lifecycle: Active
---

> ⚠️ **Design direction — not implemented.** This document describes target architecture, not current code state. See `docs/evolution/01-CURRENT-STATE-ASSESSMENT.md` for what already exists.

# Task Catalog

> Catalog of all evolution tasks with IDs, categories, and priorities.

## Task IDs

Tasks follow the format: `NX-{CATEGORY}-{NNN}`

| Category | Prefix | Description |
|----------|--------|-------------|
| Stabilization | STAB | Bug fixes, test coverage, consolidation |
| Architecture | ARCH | Architecture changes, ADRs, refactoring |
| Platform | PLAT | Plugin system, pipeline, state machine |
| Intelligence | INTE | Learning, recommendations, self-governance |
| Documentation | DOCS | Documentation improvements |
| Process | PROC | Process and tooling improvements |

## Active Tasks

### Wave 1 — Stabilization

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| NX-STAB-001 | Fix lifecycle gate inconsistency | P0 | Pending |
| NX-STAB-002 | Fix empty catch blocks | P1 | Pending |
| NX-STAB-003 | Fix `any` type usage | P1 | Pending |
| NX-STAB-004 | Increase test coverage to >80% | P1 | Pending |
| NX-STAB-005 | Update documentation | P2 | Pending |

### Wave 2 — Architecture

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| NX-ARCH-001 | Create ADR infrastructure | P1 | Pending |
| NX-ARCH-002 | Document existing decisions as ADRs | P1 | Pending |
| NX-ARCH-003 | Separate domain logic from CLI | P1 | Pending |
| NX-ARCH-004 | Introduce application layer | P2 | Pending |
| NX-ARCH-005 | Define bounded contexts | P2 | Pending |
| NX-ARCH-006 | Create reference documentation | P2 | Pending |

### Wave 3 — Platform

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| NX-PLAT-001 | Complete plugin system | P1 | Pending |
| NX-PLAT-002 | Make pipeline declarative | P1 | Pending |
| NX-PLAT-003 | Complete state machine | P1 | Pending |
| NX-PLAT-004 | Add telemetry | P2 | Pending |
| NX-PLAT-005 | Complete knowledge graph | P2 | Pending |
| NX-PLAT-006 | Add plugin marketplace support | P3 | Pending |

### Wave 4 — Intelligence

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| NX-INTE-001 | Implement feedback learning | P1 | Pending |
| NX-INTE-002 | Add confidence scoring | P1 | Pending |
| NX-INTE-003 | Implement auto-recommendations | P2 | Pending |
| NX-INTE-004 | Add cross-session learning | P2 | Pending |
| NX-INTE-005 | Implement self-governance | P3 | Pending |

---

## Related Documents

- [Execution Order](./EXECUTION-ORDER.md) — Wave sequence
- [Master Evolution Plan](./MASTER_EVOLUTION_PLAN.md) — Strategic overview
- [Rollback Plan](./ROLLBACK-PLAN.md) — Rollback procedures

---

*Last updated: 2026-06-29*
