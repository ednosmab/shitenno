---
category: evolution
lifecycle: Active
---

> ⚠️ **Design direction — not implemented.** This document describes target architecture, not current code state. See `docs/evolution/01-CURRENT-STATE-ASSESSMENT.md` for what already exists.

# Acceptance Criteria

> Conditions that must be met before a task can be marked as complete.

## Principle

No task is complete until all acceptance criteria are satisfied. No exceptions.

## Universal Criteria

Every task must satisfy:

1. **All tests pass** — Unit, integration, and e2e tests
2. **Architecture remains intact** — No violations of invariants
3. **Documentation updated** — Relevant docs reflect the change
4. **Coverage maintained** — No decrease in test coverage
5. **No regression** — Existing functionality unchanged
6. **No new technical debt** — No `any` types, no `console.log`, no shortcuts
7. **Checklist complete** — All items in validation checklist pass

## Task-Specific Criteria

| Task Type | Additional Criteria |
|-----------|-------------------|
| New feature | Feature documented, edge cases tested |
| Bug fix | Regression test added, root cause documented |
| Refactor | Behavior unchanged, all tests pass |
| Architecture change | ADR created, invariants verified |
| Documentation | Reviewed by at least one contributor |

## Validation Process

1. Author runs validation checklist
2. Author verifies all tests pass
3. Author updates documentation
4. Author submits PR with checklist results
5. Reviewer verifies criteria met
6. Merge after approval

## Rejection Criteria

A task should be rejected if:

- Any test fails
- Architecture invariants are violated
- Documentation is missing
- Coverage decreases
- New technical debt is introduced
- Checklist items are incomplete

---

## Related Documents

- [Validation Checklist](./VALIDATION-CHECKLIST.md) — Specific verification steps
- [Architecture Governance](../quality/20-ARCHITECTURE-GOVERNANCE.md) — Governance rules
- [AI Implementation Guide](./AI-IMPLEMENTATION-GUIDE.md) — Rules for AI agents

---

*Last updated: 2026-06-29*
