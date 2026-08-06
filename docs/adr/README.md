# Architecture Decision Records

> Tracking architectural decisions for the Shitenno.

## What is an ADR?

An Architecture Decision Record (ADR) captures a significant architectural decision along with its context and consequences.

## When to Create an ADR

Create an ADR when:

- Making a decision that affects the system architecture
- Choosing between multiple alternatives
- Establishing a new pattern or convention
- Changing an existing architectural decision

## ADR Lifecycle

```
Proposed → Accepted → Deprecated/Superseded
```

- **Proposed:** Under review
- **Accepted:** Approved and in effect
- **Deprecated:** No longer recommended
- **Superseded:** Replaced by a newer ADR

## Numbering

ADRs are numbered sequentially: ADR-001, ADR-002, etc.

## Template

See [TEMPLATE.md](./TEMPLATE.md).

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| ADR-001 | Single Agent Architecture | Accepted | 2026-06-28 |
| ADR-002 | Event-Driven Architecture with Centralized Engineering State | Accepted | 2026-06-28 |
| ADR-003 | Knowledge Graph as Foundation for Documentation | Accepted | 2026-06-28 |
| ADR-004 | Event Bus Orphaned Events Triage | Accepted | 2026-06-28 |
| ADR-005 | Layered Source Structure for src/ | Accepted | 2026-08-06 |

## Governance

- ADRs are proposed by contributors
- ADRs are approved by the Architecture Board
- Once accepted, ADRs should not be changed
- To reverse an ADR, create a new one that supersedes it

---

*Last updated: 2026-08-06*
