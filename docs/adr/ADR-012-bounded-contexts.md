---
category: adr
lifecycle: Active
---

# ADR-012: Bounded Contexts as Declared Module Boundaries

## Status

Accepted

## Date

2026-08-06

## Deciders

- Tech Lead (Shitenno CLI maintainers)

## Context

ADR-005 reorganized `src/` into five layers (shared, domain, application,
infrastructure, interface), but the codebase still had no concept of bounded
contexts: any module could import any other module within a layer, and module
responsibility was only discoverable by reading the code. Backlog item SA15
(and evolution task NX-ARCH-003) captured this gap.

A full directory reorganization into physical context folders (e.g.
`src/application/governance/`) was evaluated and rejected: the repository had
just completed a 119-file layering move (ADR-005), and another physical move
of 88+ files would burn git history and review effort for no immediate
behavioral gain.

## Decision

Introduce bounded contexts as **declared logical boundaries** backed by data
and enforcement, without moving files:

1. **Registry** — `src/domain/types/context-map.ts` maps every source module
   to one of eight bounded contexts: `governance`, `intelligence`, `planning`,
   `briefing`, `feedback`, `knowledge`, `ops`, `interface`. The `domain` and
   `shared` layers are core contexts, importable from anywhere.
2. **Dependency matrix** — `src/domain/rules/context-dependencies.ts` declares
   the allowed cross-context edges. The declared set reflects the couplings
   that exist today; any new edge requires a conscious registry change.
   `interface` (entry) and `ops` (platform) may import any context; core and
   platform contexts are importable from anywhere.
3. **Enforcement** — `src/infrastructure/context-boundary.ts` scans the src
   tree and reports coverage (share of modules assigned to a context) and
   violations (imports crossing undeclared edges). A repository-level test
   (`src/__tests__/context-boundaries.test.ts`) locks the baseline to zero
   violations.
4. **Measurement** — `analyseProject()` now exposes
   `boundedContextCoverage` and `contextBoundaryViolations`, and the
   architecture maturity dimension awards up to +10 points when coverage is
   high and violations are zero.

## Consequences

### Positive

- SA15 is now verifiable: the boundary test fails when new code crosses an
  undeclared context edge, forcing an explicit decision instead of silent
  coupling.
- The architecture score reflects real structure, not documentation presence.
- Context membership is discoverable from a single data file, which is also
  the canonical source for documentation.

### Negative

- The declared edge set includes today's couplings, several of which form
  context-level cycles (`governance ↔ intelligence`). The runtime execution
  cycle (rule-engine ↔ decision-core) was broken by moving the policy engine
  to `infrastructure/`, security/conditions to `shared/`, and the nine rule
  actions into `decision-core/executors/rule-actions.ts`; the remaining
  couplings are read-only data accesses from audit/prioritization/semantic.
  These are accepted as known tech debt and documented in
  `docs/architecture/bounded-contexts.md`; future refactors should remove them.
- Coverage measurement excludes `__tests__`, `templates` and `__fixtures__`,
  so enforcement only protects production modules.
- Application-layer facades re-export across contexts; they are mapped to the
  context of the module they expose, and their internal cross-context imports
  (e.g. challenge-generator → state-manager) are declared edges.

## Alternatives Considered

### Physical context directories

Move application/infrastructure files into per-context subdirectories. Rejected:
high churn right after the ADR-005 move, git history cost, and no enforcement
gain over the declared-boundary approach.

### Documentation only

Publish a context map without code enforcement. Rejected: nothing would stop
new couplings from accumulating, which is the failure mode SA15 describes.

### Enforce via ESLint only

Use `no-restricted-imports` per context. Rejected: the rule scales poorly with
80+ modules, needs per-file exceptions, and duplicates the registry instead of
consuming it.

## References

- [Bounded contexts map](../architecture/bounded-contexts.md)
- [ADR-005 layered source structure](ADR-005-layered-source-structure.md)
- [Architecture design principles](../architecture/design-principles.md)
- [SA15 backlog item]
