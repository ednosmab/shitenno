---
category: architecture
lifecycle: Active
---

# 03 — DESIGN PRINCIPLES

> These principles are immutable. They govern every decision in the Shitenno.

## 1. SÓ PROPÕE, nunca aplica

Shugo proposes. Humans decide.

Every recommendation, every rule, every suggestion is advisory. Shugo never auto-applies changes to production code, governance rules, or project structure without explicit human approval.

**Why:** Engineering judgment is irreplaceable. Automation amplifies good decisions; it cannot replace them.

**Implementation:** `pattern-detector.ts` generates candidate rules. `health-auditor.ts` generates optimization proposals. Neither writes to production files.

## 2. Capability-Based, Not Level-Based

Install what you need, not what a label dictates.

Shugo does not force projects into L1/L2/L3 boxes. Instead, it detects which capabilities are relevant and recommends installation based on maturity dimensions.

**Why:** A project can be architecturally mature but governance-poor. Levels force false uniformity.

**Implementation:** 9 capabilities with dependency resolution. `maturity-profile.ts` recommends based on dimension scores, not labels.

## 3. Three-Tier State Separation

Knowledge is permanent. State is current. Memory is temporary.

Every piece of information in Shugo belongs to exactly one tier:

| Tier | Lifetime | Examples |
|------|----------|----------|
| Knowledge | Permanent | ADRs, skills, contracts, workflows |
| State | Current | Maturity profile, complexity score, installed capabilities |
| Memory | Temporary | Session ID, current task, blockers, reminders |

**Why:** Mixing these tiers causes confusion. A session reminder is not an ADR. A maturity score is not a skill.

**Implementation:** `state-manager.ts` with `readKnowledgeState()`, `readProjectState()`, `readSessionMemory()`, `consolidateState()`.

## 4. Graph-First Knowledge

Every artifact is a node. Every relation is an edge. The graph is the system.

Shugo models knowledge as a directed graph. Artifacts (ADRs, skills, contracts, workflows, scripts) are connected through explicit relations (generates, uses, executes, depends_on, supersedes).

**Why:** Isolated knowledge decays. Connected knowledge compounds.

**Implementation:** `knowledge-graph.ts` with 14 artifact types and 14 relation types.

## 5. Evidence Over Opinion

Measure first. Recommend second. Never guess.

Every recommendation must be backed by evidence. Complexity is scored from metrics, not feelings. Patterns are detected from history, not intuition. Health is computed from data, not vibes.

**Why:** Opinions change. Evidence persists. Governance requires traceability.

**Implementation:** `scorer.ts` computes from static + behavioral metrics. `pattern-detector.ts` analyzes history. `health-auditor.ts` checks against expected state.

## 6. Adaptation Over Prescription

The system adapts to the team, not the other way around.

Shugo adjusts its behavior based on team maturity. A junior team gets different recommendations than a senior team. A monorepo gets different analysis than a single package.

**Why:** One-size-fits-all governance fails. Adaptation sustains.

**Implementation:** `maturity-profile.ts` with 7 dimensions. `recommendation-engine.ts` adjusts based on scores. `capability-mapping.ts` installs only relevant capabilities.

## 7. Modularity Over Monolith

Small, connected modules. Not one big thing.

Each Shugo module has a single responsibility. Modules communicate through well-defined interfaces, not shared state.

**Why:** Modularity enables independent evolution, testing, and replacement.

**Implementation:** 13 core modules, each with clear boundaries. Event bus (planned) for inter-module communication.

## 8. Declarative Over Imperative

Define what, not how. Data over code.

Rules are defined as data (JSON), not code. Capabilities are defined as mappings (data), not functions. The rule engine evaluates conditions and executes actions declaratively.

**Why:** Declarative systems are auditable, explainable, and extensible without code changes.

**Implementation:** `rule-engine.ts` with trigger/condition/action data structures. 17 trigger types, 9 condition operators, 14 action types.

## 9. Progressive Disclosure

Start simple. Add complexity only when needed.

Shugo begins with minimal configuration. As the team matures, more capabilities become relevant. The context hierarchy (P0-P4) loads only what's needed.

**Why:** Premature complexity kills adoption. Progressive disclosure sustains it.

**Implementation:** `init` scaffolds only core. `upgrade` adds capabilities incrementally. `context/CONTEXT_HIERARCHY.md` defines P0-P4 loading.

## 10. Self-Governance

The system that governs should govern itself.

Shugo applies its own principles to its own development. It tracks its own knowledge debt, detects its own patterns, and recommends its own evolution.

**Why:** Credibility requires consistency. A governance tool that doesn't govern itself is hypocritical.

**Implementation:** `knowledge-debt.ts` detects gaps in Shugo's own docs. `auto-evolution.ts` recommends improvements to the system itself.
