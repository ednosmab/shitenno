---
category: architecture
lifecycle: Active
---

# Bounded Contexts Map

> Declared logical boundaries of the Shitenno source tree.
> The canonical registry is `src/domain/types/context-map.ts`; this document is
> the human-readable reference. Enforcement lives in
> `src/infrastructure/context-boundary.ts` and the repository boundary test.

## Contexts

| Context | Responsibility | Directories (examples) |
|---|---|---|
| `governance` | Rules, capabilities, maturity, engineering state | `rule-engine/`, `capability-engine/`, `maturity-profile/`, `engineering-state/`, `state-manager/`, `governance/` |
| `intelligence` | Analysis, scoring, pattern detection, risk, decisions | `audit/`, `scorer`, `pattern-detector/`, `decision-core/`, `semantic/`, `knowledge-debt/`, `prioritization/`, `inference-engine/` |
| `planning` | Plans, backlog, pipelines, task execution | `plan/`, `plan-backlog-sync/`, `backlog-writer/`, `markdown-plan-engine/`, `pipeline/`, `action-engine/`, `task-completion` |
| `briefing` | Context collection, sessions, briefing generation | `context-collector/`, `context-buffer-writer/`, `briefing`, `session-tracker` |
| `feedback` | Learning loops, challenges, growth | `feedback/`, `challenge-responder/`, `challenge-generator`, `session-feedback` |
| `knowledge` | Knowledge graph, documentation engine, skills | `knowledge-graph/`, `doc-engine/`, `handbook/`, `skill-io`, `skill-manifest` |
| `ops` | Platform: events, caches, daemon, adapters, persistence | `event-bus`, `daemon/`, `daemon-client/`, `cache`, `adapters/`, `persistence/`, `scaffold/`, `reporter/` |
| `interface` | Entry points: CLI commands, MCP, console | `commands/`, `interface/cli/`, `interface/mcp/`, `mcp-handlers/`, `console/`, `help-data/` |
| `domain` (core) | Entities, ports, rules, types — context-agnostic | `domain/` |
| `shared` (core) | Framework-agnostic utilities | `shared/` |

Application-layer facades (`src/application/*.ts`) are mapped to the context
they expose (e.g. `application/rule-engine.ts` → `governance`).
Infrastructure-layer flat files are mapped individually (e.g.
`infrastructure/analyser.ts` → `intelligence`).

## Dependency Rules

1. Any context may import `domain` and `shared` (the core).
2. Any context may import `ops` and `interface` (platform/entry).
3. `interface` and `ops` may import any context.
4. Business contexts (`governance`, `intelligence`, `planning`, `briefing`,
   `feedback`, `knowledge`) may import each other only through declared edges.
5. Same-context imports are always allowed.

### Declared Edges (baseline = real couplings)

```
briefing    → feedback, governance, intelligence, knowledge
governance  → briefing, intelligence, knowledge, planning
intelligence→ briefing, feedback, governance, knowledge, planning
knowledge   → briefing, governance, intelligence
planning    → briefing, governance, intelligence
feedback    → governance, intelligence
```

### Known Cycles (accepted tech debt)

The edge set still contains context-level cycles, most notably
`governance ↔ intelligence`. The **runtime execution cycle** (rule-engine ↔
decision-core) was broken by migrating the policy engine to `infrastructure/`,
security/conditions to `shared/`, and the nine rule actions into
`decision-core/executors/rule-actions.ts` (ADR-009). The remaining
`intelligence → governance` couplings are read-only data accesses:
audit/supply → infrastructure/validation, prioritization → engineering-state +
capability-engine, semantic/growth-profile → infrastructure/growth-profile, and
audit/enforcement/session → governance/buffer-checkpoint. Cycles are reported
as informational output of the boundary analysis, not as violations.

## Verification

- Repository dogfood test: `src/__tests__/context-boundaries.test.ts` asserts
  100% coverage and zero undeclared violations on the repository itself.
- New cross-context imports must be justified and declared in
  `src/domain/rules/context-dependencies.ts` (and reflected here) — the test
  will fail otherwise.

## References

- [ADR-012 bounded contexts](../adr/ADR-012-bounded-contexts.md)
- [ADR-005 layered source structure](../adr/ADR-005-layered-source-structure.md)
- [Domain model mapping](domain-model-mapping.md)
