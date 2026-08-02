---
category: evolution
lifecycle: Active
---

> ⚠️ **Design direction — not implemented.** This document describes target architecture, not current code state. See `docs/evolution/01-CURRENT-STATE-ASSESSMENT.md` for what already exists.

# Rollback Plan

> Procedures for reverting changes when something goes wrong.

## Principle

Every task must have a rollback plan before it begins. No exceptions.

## Rollback Template

For each task, document:

- **Previous state** — What the system looked like before the change
- **Reversal procedure** — Step-by-step instructions to revert
- **Criteria** — When rollback is necessary
- **Window** — Time limit for attempting rollback before escalation
- **Validation** — How to verify rollback succeeded
- **Logs** — What to log during rollback
- **Metrics** — What metrics to monitor during rollback

## Rollback Triggers

Rollback should be initiated when:

- Tests fail after deployment
- Critical bugs are introduced
- Performance degrades significantly
- Security vulnerabilities are discovered
- Architecture invariants are violated

## Rollback Levels

| Level | Scope | Approval | Timeframe |
|-------|-------|----------|-----------|
| L1 | Single task | Author | < 1 hour |
| L2 | Single wave | Architecture Board | < 4 hours |
| L3 | Multiple waves | Team lead | < 24 hours |

## Data Rollback

For changes that affect data:

1. Backup before changes
2. Document backup location
3. Test restore procedure
4. Verify data integrity after restore

## Communication

During rollback:

1. Notify affected contributors
2. Document the reason
3. Update the backlog
4. Schedule post-mortem

---

## Related Documents

- [Execution Order](./EXECUTION-ORDER.md) — Wave sequence
- [Acceptance Criteria](./ACCEPTANCE-CRITERIA.md) — When tasks are complete
- [Validation Checklist](./VALIDATION-CHECKLIST.md) — Verification steps

---

*Last updated: 2026-06-29*
