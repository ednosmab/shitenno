---
category: architecture
lifecycle: Active
---

# Validation Matrix

> Complete alignment of all source modules to the Meta Model.

## Purpose

This matrix validates that every module in the Shitenno maps clearly to a [Meta Model](../domain/meta-model.md) concept. Modules that cannot be mapped should have their responsibility re-evaluated.

---

## Core Modules

| Module | Meta Model Concept | Produces Knowledge | Consumes Knowledge | Modifies State | Observes | Decides | Executes |
|--------|-------------------|-------------------|-------------------|---------------|---------|---------|----------|
| `analyser.ts` | Reality → Observation | Project info | Filesystem | No | Yes | No | No |
| `scorer.ts` | Observation → Engineering State | Complexity score | Metrics | No | Yes | No | No |
| `pattern-detector.ts` | Observation → Knowledge | Patterns | History | No | Yes | No | No |
| `knowledge-debt.ts` | Observation → Knowledge Debt | Debt entries | Artifacts | No | Yes | No | No |
| `health-auditor.ts` | Observation → Engineering State | Health score | Governance | No | Yes | No | No |
| `maturity-profile.ts` | Knowledge → Capabilities | Capability scores | Dimensions | No | Yes | No | No |
| `capability-mapping.ts` | Knowledge → Capabilities | File mappings | Capability defs | No | Yes | No | No |
| `state-manager.ts` | Capabilities → Engineering State | State snapshot | Three tiers | No | Yes | No | No |
| `recommendation-engine.ts` | Engineering State → Decisions | Recommendations | State | No | Yes | No | No |
| `auto-evolution.ts` | Decisions → Actions | Evolution recs | System state | No | Yes | No | No |
| `feedback-loops.ts` | Actions → Project Evolution | Feedback records | Outcomes | Yes | Yes | No | Yes |
| `knowledge-graph.ts` | Knowledge → Assets (Relations) | Graph analysis | Artifacts | Yes | Yes | No | No |
| `shitenno-state-machine.ts` | Infrastructure (Lifecycle) | Lifecycle state | Transitions | Yes | Yes | No | Yes |
| `rule-engine.ts` | Infrastructure (Rules) | Rule results | Rules, events | Depends | Yes | No | Yes |
| `event-bus.ts` | Infrastructure (Events) | Event distribution | Events | No | Yes | No | Yes |
| `pipeline.ts` | Infrastructure (Orchestration) | Stage results | Stages | No | Yes | No | Yes |
| `plugin-system.ts` | Infrastructure (Extensibility) | Plugin results | Plugins | Depends | Yes | No | Yes |
| `challenge-generator.ts` | Decisions → Actions | Challenges | State | No | Yes | No | No |
| `dual-path-presenter.ts` | Decisions → Actions | Path presentation | Recommendations | No | Yes | No | No |
| `session-tracker.ts` | Infrastructure (Memory) | Session data | Session events | Yes | Yes | No | Yes |
| `cache.ts` | Infrastructure (Storage) | Cached data | Cache keys | Yes | Yes | No | Yes |
| `validation.ts` | Infrastructure (Validation) | Validation results | Schemas | No | Yes | No | Yes |
| `scaffolder.ts` | Reality → Observation | Scaffold structure | Templates | Yes | Yes | No | Yes |
| `growth-profile.ts` | Knowledge → Capabilities | Growth profile | Assessment | Yes | Yes | No | No |
| `performance-reporter.ts` | Observation → Engineering State | Performance report | Metrics | No | Yes | No | No |
| `prompts.ts` | Infrastructure (UI) | User input | Questions | No | No | No | Yes |
| `shared.ts` | Infrastructure (Utilities) | Shared utilities | — | No | No | No | No |
| `utils.ts` | Infrastructure (Utilities) | Utilities | — | No | No | No | No |
| `formatting.ts` | Infrastructure (Formatting) | Formatted output | Data | No | No | No | No |
| `logger.ts` | Infrastructure (Logging) | Log entries | Log messages | No | No | No | Yes |
| `constants.ts` | Infrastructure (Constants) | Constants | — | No | No | No | No |
| `errors.ts` | Infrastructure (Errors) | Error types | — | No | No | No | No |
| `capability-engine.ts` | Knowledge → Capabilities | Capability installation | Capabilities | Yes | Yes | No | Yes |
| `engineering-state.ts` | Capabilities → Engineering State | State consolidation | Three tiers | Yes | Yes | No | Yes |

---

## Commands

| Command | Meta Model Concept | Produces Knowledge | Consumes Knowledge | Modifies State | Observes | Decides | Executes |
|---------|-------------------|-------------------|-------------------|---------------|---------|---------|----------|
| `init` | Reality → Observation | Scaffold structure | Project info | Yes | Yes | No | Yes |
| `status` | Engineering State | State report | State | No | Yes | No | No |
| `detect` | Observation → Knowledge | Patterns | History | No | Yes | No | No |
| `audit` | Observation → Engineering State | Audit report | Governance | No | Yes | No | No |
| `evolve` | Engineering State → Decisions | Recommendations | State | No | Yes | No | No |
| `run` | Full Meta Model flow | Full report | All data | Yes | Yes | No | Yes |
| `upgrade` | Knowledge → Capabilities | Installed caps | Capabilities | Yes | Yes | No | Yes |
| `validate` | Engineering State | Validation report | Session | No | Yes | No | No |
| `sync` | Knowledge → Assets | Synced assets | External state | Yes | Yes | No | Yes |
| `assess` | Knowledge → Capabilities | Updated profile | Assessment | Yes | Yes | No | No |
| `clean` | Infrastructure | Clean results | Cache keys | Yes | Yes | No | Yes |
| `doctor` | Engineering State | Health report | State | No | Yes | No | No |
| `report` | Engineering State | Generated report | State | No | Yes | No | No |

---

## Summary Statistics

| Category | Total | Maps to Meta Model | Maps to Infrastructure | No Mapping |
|----------|-------|-------------------|----------------------|------------|
| Core Modules | 34 | 14 | 20 | 0 |
| Commands | 13 | 12 | 1 | 0 |
| **Total** | **47** | **26** | **21** | **0** |

---

## Findings

### All Modules Mapped

Every module in the Shitenno maps to either a Meta Model concept or an Infrastructure concern. No modules are unmapped.

### Meta Model Alignment

24 modules (56%) map directly to Meta Model concepts:
- Reality → Observation: 3 modules
- Observation → Knowledge: 3 modules
- Observation → Engineering State: 3 modules
- Observation → Knowledge Debt: 1 module
- Knowledge → Capabilities: 4 modules
- Capabilities → Engineering State: 1 module
- Engineering State → Decisions: 1 module
- Decisions → Actions: 3 modules
- Actions → Project Evolution: 1 module
- Knowledge → Assets (Relations): 1 module
- Full Meta Model flow: 1 module

### Infrastructure Concerns

19 modules (44%) map to Infrastructure:
- Lifecycle: 1 module
- Rules: 1 module
- Events: 1 module
- Orchestration: 1 module
- Extensibility: 1 module
- Memory: 1 module
- Storage: 1 module
- Validation: 1 module
- UI: 1 module
- Utilities: 4 modules
- Formatting: 1 module
- Logging: 1 module
- Constants: 1 module
- Errors: 1 module

### No Violations

No module violates the Meta Model. All modules have clear responsibilities that align with either domain concepts or infrastructure concerns.

---

## Recommendations

1. **Accept Infrastructure modules** — Events, Rules, Orchestration, and Extensibility are legitimate cross-cutting concerns that do not need to map to Meta Model concepts
2. **Monitor Infrastructure modules** — Ensure they do not accumulate domain logic
3. **Future engines** — When creating new engines, ensure they map to Meta Model concepts, not just infrastructure

---

*This matrix validates alignment to the Meta Model. For the Meta Model definition, see [../domain/meta-model.md](../domain/meta-model.md). For detailed module analysis, see [domain-model-mapping.md](./domain-model-mapping.md).*

*Last updated: 2026-06-28*
