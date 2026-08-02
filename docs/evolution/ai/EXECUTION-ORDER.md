---
category: evolution
lifecycle: Active
---

> ⚠️ **Design direction — not implemented.** This document describes target architecture, not current code state. See `docs/evolution/01-CURRENT-STATE-ASSESSMENT.md` for what already exists.

# Execution Order

> The prescribed order for executing the evolution plan.

## Principle

Waves must be executed in order. Each wave depends on the previous wave being complete.

## Wave Sequence

```
Wave 1: Stabilization
    ↓
Wave 2: Architecture
    ↓
Wave 3: Platform
    ↓
Wave 4: Intelligence
```

## Rules

1. **Never invert wave order** — Each wave builds on the previous
2. **Complete before advancing** — All tasks in a wave must be done before starting the next
3. **Parallel tasks within waves** — Tasks within a wave can be executed in parallel
4. **Rollback capability** — Every task must have a rollback plan

## Wave Dependencies

| Wave | Depends On | Delivers |
|------|------------|----------|
| Wave 1 | Nothing | Stable foundation |
| Wave 2 | Wave 1 | Clean architecture |
| Wave 3 | Wave 2 | Extensible platform |
| Wave 4 | Wave 3 | Intelligent governance |

## Entry Criteria per Wave

| Wave | Entry Criteria |
|------|----------------|
| Wave 1 | All P0 bugs fixed, test coverage >80% |
| Wave 2 | CLI refactor complete, shared infrastructure in place |
| Wave 3 | Application layer introduced, bounded contexts defined |
| Wave 4 | Feedback loops active, knowledge graph populated |

## Exit Criteria per Wave

| Wave | Exit Criteria |
|------|---------------|
| Wave 1 | Zero critical bugs, CI passing, documentation updated |
| Wave 2 | Domain logic separated from CLI, ADRs for key decisions |
| Wave 3 | Plugin system operational, pipeline declarative |
| Wave 4 | Auto-recommendations working, self-governance active |

---

## Related Documents

- [Master Evolution Plan](./MASTER_EVOLUTION_PLAN.md) — Strategic overview
- [Wave 1](../roadmap/21-MIGRATION-WAVE-1.md) — Stabilization tasks
- [Wave 2](../roadmap/22-MIGRATION-WAVE-2.md) — Architecture tasks
- [Wave 3](../roadmap/23-MIGRATION-WAVE-3.md) — Platform tasks
- [Wave 4](../roadmap/24-MIGRATION-WAVE-4.md) — Intelligence tasks
- [Rollback Plan](./ROLLBACK-PLAN.md) — Rollback procedures

---

*Last updated: 2026-06-29*
