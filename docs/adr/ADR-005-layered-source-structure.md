---
category: adr
lifecycle: Active
---

# ADR-005: Layered Source Structure for src/

## Status

Accepted

## Date

2026-08-06

## Deciders

- Tech Lead (Shitenno CLI maintainers)

## Context

`src/` contained 119 flat files (plus pre-existing subdirectories such as
`commands/`, `rule-engine/`, `daemon/`, `mcp-handlers/`), with no layering
enforced by the codebase itself. Consequences:

- 66 of 119 flat files (55%) imported Node.js APIs directly, making the core
  logic untestable without mocking host APIs and coupling every module to the
  runtime.
- Zero flat files consumed domain ports, so the ports (e.g. `EventBus`,
  `Logger`) were defined but effectively unused — a violation of the
  dependency-rule invariant "domain does not depend on infrastructure".
- Module boundaries were invisible to tooling (import analysis, risk maps,
  coverage scoping), which made the `shugo` architecture dimension score
  (15%) misleading: the dimension only measures documentation presence
  (+30 docs, +25 ADRs, +20 technical reviews, +15 monorepo, +10 packages) and
  reports ~90/100 while the code organization itself is unmeasured.

## Decision

Reorganize `src/` into five layers, each mapped to a directory:

| Layer | Directory | Role | Files |
|-------|-----------|------|-------|
| Shared | `src/shared/` | Framework-agnostic utilities and pure helpers | 7 |
| Domain | `src/domain/` (`types/`, `rules/`, `ports/`) | Entities, value types, rules and ports (interfaces only) | 24 |
| Application | `src/application/` | Use cases, orchestration, state machine behavior | 28 |
| Infrastructure | `src/infrastructure/` | Node.js adapters, persistence, detectors, platform glue | 52 |
| Interface | `src/interface/` (`cli/`, `mcp/`) | CLI/daemon entry and MCP adapters | 8 |

Rules that follow from the decision:

1. Imports remain fully relative (no path aliases), so the layering is
   verifiable by grep and does not require a bundler resolution step.
2. Domain and shared layers must not import Node.js APIs; infrastructure owns
   all host-API access.
3. Domain logic consumed by CLI commands is reached through
   application-layer use cases.
4. The dependency direction is
   `interface → application → domain/shared`, with `infrastructure`
   implementing `domain/ports` and being consumed by `application`.
5. Tests keep their current location (`src/__tests__/`, co-located where
   applicable); they import through the public layer paths.

## Consequences

### Positive

- Zero flat files remain in `src/`; module responsibility is discoverable
  from the directory tree.
- Node.js-importing modules are now confined to `src/infrastructure/`, making
  domain logic testable without host mocks.
- Ports (`src/domain/ports/`) now have real consumers in the application
  layer, restoring the dependency-rule invariant.
- The `shugo` architecture dimension can now measure real structure (layer
  boundaries, port usage) instead of documentation presence alone.

### Negative

- 119 files changed location; git history for individual files requires
  rename detection (`git log --follow`), and stale path references in docs,
  test mocks and worker-script strings needed a one-time sweep.
- A small number of static-analysis tests (e.g. tsup entry list, worker
  spawn paths, mock specifiers) had to be updated alongside the move.

## Alternatives Considered

### Colocated feature folders only

Grouping by feature (e.g. `src/audit/`, `src/feedback/`) without an explicit
layer axis. Rejected: it does not separate ports from adapters and leaves the
Node.js-coupling problem unsolved.

### Path aliases (`@/domain`, `@/infra`)

Aliases shorten imports but hide the layer boundary from greps, complicate
tsup/tsconfig resolution, and were judged unnecessary at this repository
scale.

### Keep flat, enforce via lint rules only

Rejected: lint rules do not make responsibility discoverable and the existing
`no-restricted-imports` rules were already referencing individual files —
the failure mode observed in this reorganization.

## References

- [Architecture design principles](../architecture/design-principles.md)
- [Engineering state architecture](../architecture/engineering-state-architecture.md)
- [Shugo audit — SA4 dimension report](../architecture/README.md)
