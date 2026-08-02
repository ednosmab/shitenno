# Plan — Enforcing the Documentation Quality Gate

**Status:** Done

> Separate from `PLAN_identity_documentation_v2.md` on purpose: that plan is about *content* (what the docs say). This plan is about *tooling* (making an existing rule actually true). Keeping them apart avoids mixing a one-time content fix with a recurring process/tooling change.

## Finding

`docs/engineering/DOCUMENTATION_GOVERNANCE.md` already states a quality gate:

```markdown
Documentation changes shall not be merged unless:
- [ ] Navigation is valid (README exists, links resolve)
- [ ] References are valid (no broken links)
- [ ] Document category is defined
- [ ] Lifecycle is declared
- [ ] Duplicated content is avoided
- [ ] Language is consistent (English)
```

Checked a representative sample (`docs/architecture/knowledge-debt.md`, `docs/adr/ADR-001-single-agent-architecture.md`, `docs/domain/README.md`): **none carry `category` or `lifecycle` metadata.** The gate is declared in governance but has never been implemented — there's no frontmatter convention, no linter, no CI check for it. This is policy that reads as active but isn't enforced anywhere.

This matters specifically for this project because the whole premise of Shitenno as a product is detecting exactly this kind of gap — a rule that exists on paper but has silently decayed — inside the *user's* project. Leaving it undetected inside Shitenno's own docs undermines that premise if anyone audits it (including Shitenno auditing itself, which — worth checking separately — it may already be capable of doing via its own `docs-audit` command).

## Decision needed before starting

Two options, pick one:

**Option A — Implement it.** Add YAML frontmatter (`category:`, `lifecycle:`) to every file under `docs/`, plus a lightweight script (or a new `shugo docs-audit` check, if the existing `docs-audit` command doesn't already cover this — needs verification) that fails CI when a doc is missing either field.

**Option B — Descope it for now.** Edit `DOCUMENTATION_GOVERNANCE.md` to remove or soften the `category`/`lifecycle` gate until there's bandwidth to tool it, so the governance document stops describing a rule that isn't real. This keeps governance honest without adding new work right now.

Given you flagged that there's already a lot of technical debt to resolve today, **Option B is the lower-cost, more honest interim move** — but it's your call, not mine, since Option A is the one that actually closes the gap if you want the enforcement to exist soon rather than later.

## If Option A is chosen — scope

1. Define the frontmatter schema (minimal): `category` (one of the domains already listed in `DOCUMENTATION_GOVERNANCE.md` — architecture, domain, implementation, engineering, evolution, philosophy, adr, reference, product) and `lifecycle` (Draft / Active / Deprecated / Historical / Archived).
2. Check whether `src/commands/docs-audit.ts` already has logic that could be extended for this (it's an existing command — verify before building something new).
3. Batch-add frontmatter to existing files, defaulting `lifecycle: Active` unless a file is clearly historical (e.g., everything under `docs/history/` → `Historical`; everything under `docs/evolution/` not yet built → `Draft`).
4. Add the check to whatever CI/pre-commit hook already runs governance checks, if one exists (needs verification — not confirmed in this investigation).

## If Option B is chosen — scope

1. Edit the Quality Gates section of `DOCUMENTATION_GOVERNANCE.md` to either remove the two unenforced checkboxes or annotate them as `(not yet tooled — see backlog)`.
2. Add an entry to `docs/BACKLOG.md` referencing this plan so the gap isn't lost.

## Acceptance criteria

Whichever option is chosen, `DOCUMENTATION_GOVERNANCE.md` should describe reality exactly — either the gate is real and checked, or it's honestly marked as not yet built. Not left as-is.

## Implementation — Option A (2026-07-22)

**Chosen:** Option A — full enforcement.

### What was done

1. **Frontmatter schema defined** — YAML frontmatter with `category` (9 valid values) and `lifecycle` (5 valid values).
2. **148 docs files batch-migrated** — Added frontmatter to all non-README `.md` files under `docs/`. Lifecycle defaults: `Active` (most files), `Historical` (history/, feedback/), `Draft` (backlog/).
3. **New validator created** — `.shitenno/scripts/validators/check-docs-frontmatter.ts` validates category/lifecycle presence and validity, supports auto-fix.
4. **Validator registered** in `.shitenno/scripts/sync-docs.ts`.
5. **sync:docs made blocking** in `.husky/pre-commit` (removed `|| true`).
6. **Governance updated** — `DOCUMENTATION_GOVERNANCE.md` quality gates now show which checks are enforced.

### Files changed

| File | Action |
|------|--------|
| `.shitenno/scripts/add-frontmatter.ts` | Created (one-time migration) |
| `.shitenno/scripts/validators/check-docs-frontmatter.ts` | Created |
| `.shitenno/scripts/validators/shared.ts` | Added `ROOT_DOCS` constant |
| `.shitenno/scripts/sync-docs.ts` | Added frontmatter validator import + call |
| `.husky/pre-commit` | Made sync:docs blocking |
| `docs/engineering/DOCUMENTATION_GOVERNANCE.md` | Updated quality gates status |
| 148 `docs/**/*.md` files | Added YAML frontmatter |

### Verification

- `pnpm run sync:docs` — frontmatter check passes (148/148 valid)
- `pnpm run lint` — passes (0 errors)
- `pnpm run typecheck` — passes
