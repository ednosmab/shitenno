# ADR-010: DOCS Check Auto-Fix Side Effect

**Status:** Accepted
**Date:** 2026-07-29
**Implemented:** 2026-07-29
**Deciders:** Tech Lead, AI Agent

## Context

The `checkDocumentation()` function in `src/plan/checks.ts` (lines 91-108) runs `sync:docs --quiet` as part of the auto-verification gate. When this check fails (e.g., `SYSTEM_MAP.md` tree is outdated), the function automatically attempts to fix the issue by running `sync:docs --fix --quiet`, then re-validates.

This behavior was implemented without a formal design decision record. During a gap analysis of the auto-verification mechanism (2026-07-29), this was identified as a potential concern: a verification gate performing write operations is counter-intuitive and could mask documentation drift that should require manual attention.

### The Problem That Auto-Fix Solves

Documentation drift is a common issue in the project lifecycle:

1. A developer creates/modifies source files (e.g., adds new modules)
2. The `SYSTEM_MAP.md` tree becomes outdated because it's a snapshot of the `.shitenno/` directory structure
3. The developer forgets to run `sync:docs --fix` before committing
4. The auto-verification gate fails, blocking the plan archival

Without auto-fix, the developer would need to:
1. Recognize the DOCS check failed
2. Manually run `pnpm run sync:docs --fix`
3. Re-run the verification

This adds friction and slows down the workflow, especially for developers who are focused on code changes rather than documentation maintenance.

## Decision

**Retain the auto-fix behavior in `checkDocumentation()` with the following properties:**

### Behavior

1. **First attempt**: Run `sync:docs --quiet` (read-only validation)
2. **If failed**: Run `sync:docs --fix --quiet` (write operation)
3. **Re-validate**: Run `sync:docs --quiet` again to confirm the fix worked
4. **If re-validation fails**: Report the check as failed with the original error

### Design Rationale

1. **Idempotency**: The `sync:docs --fix` operation is idempotent — running it multiple times produces the same result. The `checkSystemMap` validator regenerates the tree by walking the filesystem, so the output is deterministic.

2. **Transparency**: The auto-fix is logged (`logger.info("plan-lifecycle", "DOCS check failed — attempting auto-fix")`) and the result message indicates whether the fix was applied (`"Documentation auto-fixed"`).

3. **Fail-safe**: If the auto-fix fails, the check fails. The system does not silently proceed.

4. **Documentation sync is mechanical**: Unlike code logic, documentation synchronization (updating trees, counts, statistics) is a mechanical operation that doesn't require human judgment. The developer wrote the code; the documentation should reflect it.

### Scope

The auto-fix applies ONLY to the `DOCS` check. Other checks (BUILD, TESTS, LINT, GATE_SELF_TEST, FORMAT) are strictly read-only.

## Consequences

### Positive

- Reduces friction in the plan archival workflow
- Eliminates a common source of false-negative gate failures
- Keeps documentation in sync with filesystem state automatically
- The re-validation step ensures the fix actually worked

### Negative

- The verification gate has a write side effect, which may surprise developers unfamiliar with the codebase
- Auto-fix could mask documentation drift that should require manual review (e.g., if `sync:docs --fix` incorrectly regenerates content)
- The write operation adds ~1-2 seconds to the verification time

## Alternatives Considered

### Option A: No Auto-Fix (Fail and Require Manual Intervention)

- Pros: Pure read-only gate, no side effects, forces developers to understand documentation sync
- Cons: Adds friction, common source of false negatives, developers may skip documentation updates

### Option B: Auto-Fix with Warning (Log but Don't Block)

- Pros: Reduces friction, still alerts developers
- Cons: Could allow documentation drift to accumulate silently

### Option C: Auto-Fix with Diff Preview (Current + Preview)

- Pros: Shows developers what changed, maintains transparency
- Cons: More complex, still requires developer action if they disagree with the changes

### Option D: Auto-Fix with Confirmation Prompt (Interactive)

- Pros: Full developer control
- Cons: Breaks non-interactive flows (CI, daemon), adds UX friction

## References

- `src/plan/checks.ts:91-108` — `checkDocumentation()` implementation
- `.shitenno/scripts/sync-docs.ts` — the sync script with `--fix` mode
- `.shitenno/scripts/validators/check-system-map.ts` — SYSTEM_MAP tree validator
- ADR-005 (Automated Task Completion Pipeline) — foundation for the verification gate
- Gap analysis 2026-07-29: identified auto-fix as a design decision requiring documentation
