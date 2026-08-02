---
category: architecture
lifecycle: Active
---

# Engine Consolidation Audit

**Date:** 2026-07-17
**Plan:** PLAN-2026-07-17-consolidacao-produtizacao-multi-projeto
**Phase:** 1 — Auditoria de Consolidação

---

## Scope

All files matching `*-engine*`, `*-detector*`, `*-analyser*` in `src/` (excluding `__tests__/`).

**Total engine/detector/analyser source files:** 57
**Total lines:** ~12,800

---

## 1. Root-Level Engines (`src/`)

| # | File | Lines | Responsibility | Overlaps with | Decision | Consumers |
|---|------|-------|---------------|---------------|----------|-----------|
| 1 | `rule-engine.ts` | 54 | Facade re-exporting `src/rule-engine/*` sub-modules | `policy-engine.ts` — **NO overlap** (see §A) | **Manter** | MCP server, daemon, CLI init, decision-core |
| 2 | `policy-engine.ts` | 430 | Governance gate: evaluates context → allow/deny/veto before action execution | `rule-engine.ts` — **NO overlap** (see §A) | **Manter** (吸收 `mode` field if desired, but distinct) | action-engine, decision-core/policy-gate, CLI policy/audit |
| 3 | `plan-engine.ts` | 375 | JSON plans with rollback/idempotência, action execution per step | `markdown-plan-engine.ts` — **significant overlap** (see §B) | **Descontinuar** — migrate consumers to markdown | CLI bare `plan *` commands only (legacy) |
| 4 | `markdown-plan-engine.ts` | 578 | Markdown plans with YAML frontmatter, status lifecycle (andamento/parado/done) | `plan-engine.ts` — canonical | **Manter como canônico** | plan-lifecycle, inference-engine, plan-backlog-sync, CLI `plan md *`, runPrepare |
| 5 | `action-engine.ts` | 446 | Executes action requests via executors (log, notify, file), records history | None | **Manter** | plan-engine, decision-core |
| 6 | `analyser.ts` | 239 | Analyses project structure, produces `ProjectAnalysis` | None | **Manter** | engineering-state |
| 7 | `capability-engine.ts` | 40 | Facade for `src/capability-engine/*` — maturity detection + recommendations | None | **Manter** (already modular) | recommendation-engine, engineering-state |
| 8 | `doc-engine.ts` | 348 | Generates documentation artifacts from engineering state | None | **Manter** | None (standalone) |
| 9 | `feedback-engine.ts` | 32 | Facade for `src/engine/feedback/*` — personalized feedback generation | None | **Manter** (already modular) | None (standalone) |
| 10 | `goal-engine.ts` | 282 | Goal persistence (CRUD) + status tracking | `decision-engine.ts`, `recommendation-engine.ts` — same domain (see §C) | **Fundir** em `src/prioritization/` | None (standalone) |
| 11 | `decision-engine.ts` | 452 | Multi-evaluator scoring (goal, risk, impact, confidence, debt) → recommendation | `goal-engine.ts`, `recommendation-engine.ts` — same domain (see §C) | **Fundir** em `src/prioritization/` | None (standalone) |
| 12 | `recommendation-engine.ts` | 492 | Aggregates signals → "next best action" recommendations | `goal-engine.ts`, `decision-engine.ts` — same domain (see §C) | **Fundir** em `src/prioritization/` | None (standalone) |
| 13 | `proactive-engine.ts` | 179 | Subscribes to event bus, triggers proactive recommendations | `recommendation-engine.ts` — triggers it (see §C) | **Fundir** em `src/prioritization/` | None (standalone) |
| 14 | `inference-engine.ts` | 329 | Infers plan status from checkboxes + metadata | None | **Manter** | CLI lifecycle |
| 15 | `trend-engine.ts` | 188 | Builds trend snapshots + forecasts from engineering state | None | **Manter** | proactive-engine |
| 16 | `complexity-detector.ts` | 197 | Detects project complexity factors | None | **Manter** | analyser |
| 17 | `pattern-detector.ts` | 338 | Detects patterns, generates candidate rules | None | **Manter** | recommendation-engine |
| 18 | `semantic-drift-detector.ts` | 227 | Detects semantic drift between code and docs | None | **Manter** | None (standalone) |

### §A — rule-engine vs policy-engine: NO overlap

**Original assumption was wrong.** These are complementary, not duplicate:

| Dimension | Rule Engine | Policy Engine |
|-----------|-------------|---------------|
| Purpose | **Reactive automation** — "when X happens, do Y" | **Governance gate** — "is this action allowed?" |
| Paradigm | Event-driven rules with 27 TriggerTypes | Declarative policy with enforce/advisory modes |
| Execution | Executes actions (side effects) | Evaluates only (no side effects) |
| Pipeline position | DOWNSTREAM of policy gate | UPSTREAM (vetoes before rules fire) |
| Trigger mechanism | Tied to specific TriggerType events | Context-agnostic — evaluates any Record |
| Condition operators | 9 operators | 15 operators (richer) |
| Storage | `governance/rules/` | `governance/policies/` |

**Execution flow:**
```
Event Bus → rule-engine (matches TriggerType) → for each action:
  → Gate 1: PolicyEngine.evaluate() → allow/deny
  → Gate 2: precedence check
  → Execute action
```

**Decision: Manter ambos.** They serve different architectural roles. Minor consolidation opportunity: unify `evaluateCondition()` (policy-engine has richer operators) — but this is a refactor, not a merge.

### §B — plan-engine vs markdown-plan-engine: legacy vs canonical

| Dimension | plan-engine (JSON) | markdown-plan-engine |
|-----------|-------------------|---------------------|
| Storage | JSON files in `.shitenno/plans/` | `.md` files in `governance/plans/` |
| Features | Rollback, idempotência, action execution per step | Status lifecycle, YAML frontmatter, checklist tracking |
| CLI commands | `plan create/execute/rollback/cancel/list/show/stats/delete` (8 bare commands) | `plan md list/show/status/done/create/prepare/lifecycle` (7 md commands) |
| Core infrastructure | **NONE** — not wired into lifecycle, inference, or backlog sync | **DEEP** — plan-lifecycle, inference-engine, plan-backlog-sync, runPrepare |
| Active in governance | No | Yes — all governance plans use markdown format |

**Decision: Descontinuar plan-engine.** Migration path:
1. Port rollback/idempotência functionality to markdown-plan-engine if needed
2. Migrate bare `plan *` commands to use markdown-plan-engine
3. Remove `plan-engine.ts` and `src/commands/plan/helpers.ts`

### §C — goal/decision/recommendation/proactive: consolidate into prioritization/

All four engines orbit "what's the next right action":

| Engine | Role | Cross-deps |
|--------|------|-----------|
| `goal-engine.ts` | Goal CRUD + status tracking | None |
| `decision-engine.ts` | Multi-evaluator scoring | None |
| `recommendation-engine.ts` | Aggregates signals → next action | Imports capability-engine, pattern-detector |
| `proactive-engine.ts` | Event-driven triggers | Imports engineering-state, trend-engine |

**Decision: Consolidar em `src/prioritization/`**

Proposed structure:
```
src/prioritization/
  goals.ts           # ex-goal-engine
  evaluators.ts      # ex-decision-engine (scoring)
  recommend.ts       # ex-recommendation-engine
  triggers.ts        # ex-proactive-engine
  index.ts           # public API
```

---

## 2. Engineering State Files (`src/engineering-state-*`)

| # | File | Lines | Responsibility | Decision |
|---|------|-------|---------------|----------|
| 19 | `engineering-state.ts` | 320 | Consolidation orchestrator + re-exports | **→ core.ts** |
| 20 | `engineering-state-access.ts` | 98 | Cache layer (get/clear) | **→ core.ts** (absorbed) |
| 21 | `engineering-state-discovery.ts` | 309 | Asset discovery from filesystem | **→ io.ts** |
| 22 | `engineering-state-evolved.ts` | 388 | Event-sourced state, lifecycle tracking | **→ core.ts** |
| 23 | `engineering-state-history.ts` | 147 | Snapshot diffing | **→ events.ts** |
| 24 | `engineering-state-io.ts` | 145 | Save/load/toText | **→ io.ts** |
| 25 | `engineering-state-mutations.ts` | 131 | Mutation log + propose | **→ events.ts** |
| 26 | `engineering-state-subscription.ts` | 33 | Subscribe to state changes | **→ events.ts** |
| 27 | `domain/entities/engineering-state.ts` | 246 | Pure domain types | **Manter** (types) |

**Total: 9 files, 1,817 lines → 3 files + types**

Proposed structure:
```
src/engineering-state/
  types.ts           # from domain/entities/engineering-state.ts (pure types)
  core.ts            # from engineering-state.ts + -access.ts + -evolved.ts
  io.ts              # from engineering-state-io.ts + -discovery.ts
  events.ts          # from engineering-state-history.ts + -mutations.ts + -subscription.ts
  index.ts           # public API
```

---

## 3. Audit Engines (`src/audit/`)

### Audit infrastructure

| # | File | Lines | Decision |
|---|------|-------|----------|
| 28 | `autofix-engine.ts` | 140 | **Manter** — no test (add test) |
| 29 | `suggestion-engine.ts` | 227 | **Manter** — no test (add test) |
| 30 | `detector-map.ts` | 437 | **Manter** — aggregates all detectors |

### Engineering detectors

| # | File | Lines | Decision |
|---|------|-------|----------|
| 31 | `engineering-detectors.ts` | 50 | **Manter** (facade) |
| 32 | `engineering-detectors-quality.ts` | 565 | **Manter** |
| 33 | `engineering-detectors-security.ts` | 581 | **Manter** |
| 34 | `engineering-detectors-supply.ts` | 383 | **Manter** |

### Governance detectors

| # | File | Lines | Decision |
|---|------|-------|----------|
| 35 | `governance-detectors.ts` | 49 | **Manter** (facade) |
| 36 | `governance-detectors-config.ts` | 513 | **Manter** |
| 37 | `governance-detectors-docs.ts` | 542 | **Manter** |
| 38 | `governance-detectors-rules.ts` | 431 | **Manter** |
| 39 | `governance-enforcement-detectors.ts` | 313 | **Manter** |

### Domain-specific detectors

| # | File | Lines | Decision |
|---|------|-------|----------|
| 40 | `architecture-detectors.ts` | 327 | **Manter** |
| 41 | `code-quality-detectors.ts` | 524 | **Manter** |
| 42 | `compliance-detectors.ts` | 459 | **Manter** |
| 43 | `context-tier-detectors.ts` | 140 | **Manter** |
| 44 | `data-architecture-detectors.ts` | 145 | **Manter** |
| 45 | `git-detectors.ts` | 290 | **Manter** |
| 46 | `observability-detectors.ts` | 252 | **Manter** |
| 47 | `operations-detectors.ts` | 241 | **Manter** |
| 48 | `performance-detectors.ts` | 183 | **Manter** |
| 49 | `product-detectors.ts` | 290 | **Manter** |
| 50 | `reliability-detectors.ts` | 256 | **Manter** |
| 51 | `security-advanced-detectors.ts` | 269 | **Manter** |
| 52 | `supply-chain-detectors.ts` | 225 | **Manter** |
| 53 | `tech-debt-detectors.ts` | 310 | **Manter** |

### Doc lifecycle

| # | File | Lines | Decision |
|---|------|-------|----------|
| 54 | `doc-lifecycle/detectors.ts` | 168 | **Manter** |

---

## 4. Other Engine-Adjacent Files

| # | File | Lines | Decision |
|---|------|-------|----------|
| 55 | `src/knowledge-debt/engine.ts` | 102 | **Manter** (already modular) |
| 56 | `src/capability-engine/engine.ts` | 66 | **Manter** (already modular) |
| 57 | `src/console/tabs/engineering.tsx` | 123 | **Manter** (UI component, not engine) |

---

## 5. Consolidation Summary

| Action | Files affected | Lines saved (est.) | Risk |
|--------|---------------|-------------------|------|
| **Manter rule-engine + policy-engine** | 0 | 0 | Low — no change |
| **Descontinuar plan-engine** | 1 file + 8 CLI commands | ~375 + ~500 | Medium — migrate CLI commands |
| **Fundir goal/decision/recommendation/proactive → prioritization/** | 4 files → 5 (module) | ~0 (restructure) | Low — no logic change |
| **Consolidar engineering-state (9 → 5 files)** | 8 files → 4 + types | ~0 (restructure) | Medium — update all imports |
| **Manter audit detectors** | 0 | 0 | Low — no change |

**Net result:**
- Before: 57 engine/detector/analyser files
- After: ~48 files (remove plan-engine, restructure engineering-state and prioritization)
- Key metric: **zero functional overlap** between remaining engines

---

## 6. Cross-Engine Dependency Graph

```
plan-engine ──────> action-engine ──────> policy-engine (gate)
                                              ↑
inference-engine ──> markdown-plan-engine     │
                                              │
doc-engine ────────> engineering-state ───────┤
trend-engine ──────> engineering-state        │
recommendation-engine > engineering-state     │
                       > capability-engine    │
                       > pattern-detector     │
proactive-engine ──> engineering-state        │
                     > trend-engine           │
engineering-state ─> analyser                 │
                                              │
[proposed: prioritization/ consolidates goal, │
 decision, recommendation, proactive]         │
```

---

## 7. Test Coverage Gaps

Files **without tests** that need them before Phase 2:

| File | Lines | Priority |
|------|-------|----------|
| `audit/autofix-engine.ts` | 140 | High |
| `audit/suggestion-engine.ts` | 227 | High |
| `audit/detector-map.ts` | 437 | Medium |
| `complexity-detector.ts` | 197 | Medium |
| `audit/governance-detectors.ts` | 49 | Low (facade) |
| All governance/domain detectors (13 files) | ~4,500 | Low (covered by integration) |
