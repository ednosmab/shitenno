---
category: engineering
lifecycle: Active
---

# ADR-006: Restrict Filesystem Access in CLI Commands

**Status:** Accepted
**Date:** 2026-07-10
**Deciders:** Tech Lead

## Context

CLI commands (`src/commands/*.ts`) increasingly relied on direct `node:fs` imports (`readFileSync`, `existsSync`, `readdirSync`) to read project state — maturity profiles, knowledge debt, engineering state, config files. This created several problems:

1. **Duplicated reads** — Multiple commands independently read the same files, causing inconsistent state within a single CLI invocation (e.g., `status` and `doctor` seeing different maturity scores because one ran first).
2. **Tight coupling to file layout** — Commands depended on internal file paths (`shitenno/maturity-profile.json`, `shitenno/knowledge-debt.json`), making it fragile to reorganize the state layer.
3. **Un testable side effects** — Direct filesystem reads made commands hard to unit test without creating real files on disk.
4. **Violation of single source of truth** — ADR-002 established the Engineering State as the canonical source. Commands reading raw files bypassed this abstraction.

## Decision

Prohibit `node:fs` imports in `src/commands/*.ts` via ESLint `no-restricted-imports` rule. Commands must access project state exclusively through:

- `consolidateEngineeringState()` from `src/engineering-state.ts` — for one-shot reads
- `subscribeToEngineeringState()` from `src/engineering-state-subscription.ts` — for reactive subscriptions
- `getEngineeringState()` from `src/engineering-state-access.ts` — for cached single-point access within a CLI invocation

### Exceptions

Commands with legitimate **write** operations are exempt from this rule:

- `init.ts`, `clean.ts`, `sync.ts`, `upgrade.ts`, `update.ts`, `validate.ts` — filesystem mutation is their core purpose
- `briefing.ts`, `reminders.ts`, `assess.ts`, `status.ts`, `bench.ts` — require write for report/cache persistence

Commands that only **read** state (like `doctor`, `mcp`, `context`, `digest`) have no exemption and must use the state abstraction layer.

## Consequences

### Positive

- Commands see a consistent snapshot within a single CLI invocation (Engineering State is computed once, cached via `getEngineeringState()`)
- Easier to unit test — mock `consolidateEngineeringState()` instead of creating real files
- File layout can change without breaking commands — only the state layer needs updating
- Enforces the single source of truth principle from ADR-002

### Negative

- Commands that read simple JSON files (like `digest.ts` reading `maturity-profile.json`) need a migration path — some may keep `node:fs` temporarily until the engineering state provides the same data
- Initial migration effort for existing commands (doctor, mcp, status, digest)

## Alternatives Considered

### Option A: Allow node:fs with a whitelist pattern
- Pros: Flexible, commands can read what they need
- Cons: No enforcement, inconsistent patterns, easy to abuse

### Option B: Create a generic `readState()` helper without ESLint enforcement
- Pros: Provides a clean API
- Cons: No enforcement — developers can still use `node:fs` directly, leading to gradual drift

### Option C: Abstract all state behind the event bus (reactive-only)
- Pros: Fully decoupled, consistent with ADR-002
- Cons: Overkill for one-shot CLI commands that run and exit; adds complexity for simple reads

## References

- `eslint.config.js` — `no-restricted-imports` rule for `src/commands/*.ts`
- ADR-002: Event-Driven Architecture with Centralized Engineering State
- `governance/plans/2026-07-09-complete-architecture-plan.md` — Phase 2
- `shitenno-single-source-of-truth-plan.md` — Original policy definition
