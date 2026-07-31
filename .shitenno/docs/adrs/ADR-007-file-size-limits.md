---
category: engineering
lifecycle: Active
---

# ADR-007: File Size and Complexity Limits

**Status:** Accepted
**Date:** 2026-07-15
**Deciders:** Tech Lead, AI Agent

## Context

The project has an excellent post-hoc audit system (90+ detectors via `shugo audit`) but zero preventive enforcement at commit time for file/function size. As a result, monolithic files enter `main` and are only detected after the fact.

Violating files detected:
- `src/commands/plan.ts` — 945 lines (15 sub-commands)
- `shitenno/scripts/sync-docs.ts` — 655 lines (10 checks)
- `src/audit/optimization-proposer.ts` — 630 lines (1 function)
- `src/commands/upgrade.ts` — 501 lines (3 responsibilities)

Existing skills that should have prevented this:
- `clean_code_standards.md` (DRY, KISS)
- `senior-engineer.md` (minimal footprint)
- `system-first.md` (use `shugo` commands)
- `AGENTS.md` rule #4 (immediate refactor)

## Decision

Enforce the following hard limits via ESLint rules, pre-commit hooks, and a CI validation script:

| Limit | Value | ESLint Rule | Exceptions |
|-------|-------|-------------|------------|
| File | 300 lines | `max-lines-per-file` | `__tests__/`, `src/templates/` |
| Function | 50 lines | `max-lines-per-function` | — |
| Depth | 4 levels | `max-depth` | — |
| Parameters | 4 per function | `max-params` | — |
| Complexity | 15 | `complexity` | — |

### Enforcement Layers

1. **ESLint** — inline errors during development
2. **Pre-commit hook** — block commits with oversized files
3. **`validate:architecture` script** — CI gate for file size, function size, and circular imports
4. **FORBIDDEN_OPERATIONS.md** — rule F-06 (no file >300 lines in `src/`)
5. **Documentation** — DESDO.md and clean_code_standards.md updated with thresholds

## Consequences

### Positive

- Monolithic files are blocked before entering `main`
- Developers get immediate feedback via ESLint
- CI catches violations that slip past local checks
- Architecture stays clean as the codebase grows

### Negative

- Existing violating files must be refactored before the rules are enforced
- Some legitimate large files (e.g., generated code) need exception handling
- Pre-commit hook adds ~1s to commit time (wc -l is fast)

## Alternatives Considered

### Option A: Post-hoc audit only (status quo)
- Pros: No new tooling needed
- Cons: Violations are caught too late; technical debt accumulates

### Option B: Soft warnings only (no hard blocks)
- Pros: Less disruptive
- Cons: Developers ignore warnings; violations still enter main

## References

- `docs/FORBIDDEN_OPERATIONS.md` — rule F-06
- `docs/DESDO.md` — section 1.1 (Size Limits)
- `docs/skills/clean_code_standards.md` — section 5 (Size Limits)
- ESLint config: `eslint.config.js`
- Pre-commit hook: `.husky/pre-commit`
