---
category: reference
lifecycle: Active
---

# Events Reference

> Complete catalog of all events in the Shitenno.

## Event Categories

Events are organized by category:

1. [Session Events](#session-events)
2. [Analysis Events](#analysis-events)
3. [Knowledge Events](#knowledge-events)
4. [Asset Events](#asset-events)
5. [Capability Events](#capability-events)
6. [Pipeline Events](#pipeline-events)
7. [Governance Events](#governance-events)
8. [Recommendation Events](#recommendation-events)
9. [Validation Events](#validation-events)

---

## Session Events

### session.start

Emitted when a session begins.

- **Payload:** `{ sessionId: string, branch: string }`
- **Published by:** init, assess
- **Subscribed by:** session-tracker

### session.end

Emitted when a session ends.

- **Payload:** `{ sessionId: string, summary: SessionSummary }`
- **Published by:** close-session
- **Subscribed by:** session-tracker, knowledge-debt

### lifecycle.state_changed

Emitted when the lifecycle state changes.

- **Payload:** `{ previous: LifecycleState, current: LifecycleState, trigger: string }`
- **Published by:** shitenno-state-machine
- **Subscribed by:** event-bus, pipeline

---

## Analysis Events

### analysis.complete

Emitted when project analysis completes.

- **Payload:** `{ analysis: ProjectAnalysis }`
- **Published by:** analyser
- **Subscribed by:** scorer, pattern-detector

### score.calculated

Emitted when complexity score is calculated.

- **Payload:** `{ report: ComplexityReport }`
- **Published by:** scorer
- **Subscribed by:** health-auditor, knowledge-debt

### pattern.detected

Emitted when patterns are detected.

- **Payload:** `{ patterns: Pattern[] }`
- **Published by:** pattern-detector
- **Subscribed by:** rule-engine, auto-evolution

### health.checked

Emitted when health check completes.

- **Payload:** `{ report: HealthReport }`
- **Published by:** health-auditor
- **Subscribed by:** auto-evolution

### entropy.calculated

Emitted when entropy score is calculated.

- **Payload:** `{ entropyScore: number, factors: EntropyFactor[] }`
- **Published by:** scorer
- **Subscribed by:** knowledge-debt

---

## Knowledge Events

### debt.detected

Emitted when knowledge debt is detected.

- **Payload:** `{ report: KnowledgeDebtReport }`
- **Published by:** knowledge-debt
- **Subscribed by:** auto-evolution, rule-engine

### knowledge.analyzed

Emitted when knowledge graph analysis completes.

- **Payload:** `{ knowledgeReport: KnowledgeReport }`
- **Published by:** knowledge-graph
- **Subscribed by:** auto-evolution

### adr.created

Emitted when an ADR is created.

- **Payload:** `{ adr: ADR }`
- **Published by:** (external)
- **Subscribed by:** knowledge-graph

### skill.created

Emitted when a skill is created.

- **Payload:** `{ skill: Skill }`
- **Published by:** (external)
- **Subscribed by:** knowledge-graph

---

## Asset Events

### asset.created

Emitted when a new asset is created.

- **Payload:** `{ asset: Asset, type: AssetType }`
- **Published by:** scaffolder, (external)
- **Subscribed by:** knowledge-graph

### asset.updated

Emitted when an asset is updated.

- **Payload:** `{ asset: Asset, changes: string[] }`
- **Published by:** (external)
- **Subscribed by:** knowledge-graph

### asset.archived

Emitted when an asset is archived.

- **Payload:** `{ asset: Asset, reason: string }`
- **Published by:** (external)
- **Subscribed by:** knowledge-graph

---

## Capability Events

### capability.installed

Emitted when a capability is installed.

- **Payload:** `{ capability: string }`
- **Published by:** upgrade
- **Subscribed by:** maturity-profile, knowledge-graph

### capability.unlocked

Emitted when a capability is unlocked.

- **Payload:** `{ capability: string, triggers: string[] }`
- **Published by:** capability-engine
- **Subscribed by:** upgrade

### maturity.changed

Emitted when maturity score changes.

- **Payload:** `{ previous: MaturityProfile, current: MaturityProfile }`
- **Published by:** assess
- **Subscribed by:** auto-evolution, rule-engine

---

## Pipeline Events

### pipeline.complete

Emitted when pipeline execution completes.

- **Payload:** `{ pipelineId: string, results: PipelineResult[], duration: number }`
- **Published by:** pipeline
- **Subscribed by:** session-tracker, knowledge-debt

### pipeline.stage.start

Emitted when a pipeline stage begins execution.

- **Payload:** `{ stageName: string, pipelineId: string }`
- **Published by:** pipeline
- **Subscribed by:** session-tracker

### pipeline.stage.complete

Emitted when a pipeline stage completes.

- **Payload:** `{ stageName: string, pipelineId: string, duration: number, success: boolean }`
- **Published by:** pipeline
- **Subscribed by:** session-tracker

---

## Engineering State Events

### engineering_state.updated

Emitted when the engineering state is updated.

- **Payload:** `{ updatedAt: string, healthScore: number }`
- **Published by:** engineering-state
- **Subscribed by:** auto-evolution

### engineering_state.consolidated

Emitted when the engineering state is consolidated from all subsystems.

- **Payload:** `{ consolidatedAt: string, lifecycle: string, assetCount: number }`
- **Published by:** engineering-state
- **Subscribed by:** auto-evolution, knowledge-debt

---

## Knowledge Debt Events

### knowledge_debt.detected

Emitted when knowledge debt is detected.

- **Payload:** `{ totalGaps: number, healthScore: number, topGaps: KnowledgeGap[] }`
- **Published by:** knowledge-debt
- **Subscribed by:** auto-evolution, session-tracker

---

## Governance Events

### rule.triggered

Emitted when a governance rule triggers.

- **Payload:** `{ ruleId: string, result: RuleResult }`
- **Published by:** rule-engine
- **Subscribed by:** session-tracker

### governance.policy_applied

Emitted when a governance policy is applied.

- **Payload:** `{ policyId: string, scope: string, outcome: string }`
- **Published by:** rule-engine
- **Subscribed by:** session-tracker

---

## Recommendation Events

### evolution.recommended

Emitted when evolution recommendations are generated.

- **Payload:** `{ recommendations: Recommendation[] }`
- **Published by:** auto-evolution
- **Subscribed by:** feedback-loops

### recommendation.accepted

Emitted when a recommendation is accepted.

- **Payload:** `{ recommendation: Recommendation, userId: string }`
- **Published by:** feedback-loops
- **Subscribed by:** knowledge-graph, auto-evolution

### recommendation.rejected

Emitted when a recommendation is rejected.

- **Payload:** `{ recommendation: Recommendation, reason: string }`
- **Published by:** feedback-loops
- **Subscribed by:** knowledge-graph, auto-evolution

---

## Validation Events

### validation.completed

Emitted when validation completes.

- **Payload:** `{ results: ValidationResult[] }`
- **Published by:** validate
- **Subscribed by:** session-tracker

---

## Plan Events

### plan.created

Emitted when a new execution plan is created.

- **Payload:** `{ planId: string, title: string }`
- **Published by:** plan command
- **Subscribed by:** plan-backlog-sync

### plan.file_changed

Emitted when a plan file is modified.

- **Payload:** `{ planId: string, path: string }`
- **Published by:** file-watcher
- **Subscribed by:** plan-backlog-sync, daemon

### plan.status_changed

Emitted when a plan's status changes.

- **Payload:** `{ planId: string, previous: string, current: string }`
- **Published by:** plan-backlog-sync
- **Subscribed by:** daemon

### plan.archived

Emitted when a completed plan is archived.

- **Payload:** `{ planId: string, path: string }`
- **Published by:** daemon
- **Subscribed by:** knowledge-graph

### plan.format_warning

Emitted when a plan has format issues.

- **Payload:** `{ planId: string, issues: string[] }`
- **Published by:** plan-backlog-sync
- **Subscribed by:** session-tracker

---

## Backlog Events

### backlog.updated

Emitted when BACKLOG.md is modified.

- **Payload:** `{ changes: string[] }`
- **Published by:** file-watcher
- **Subscribed by:** plan-backlog-sync

---

## Documentation Events

### docs.sync.triggered

Emitted when documentation sync is triggered by file changes.

- **Payload:** `{ significance: number, outputLevel: string, files: string[] }`
- **Published by:** file-watcher
- **Subscribed by:** doc-sync-hook

### doc.lifecycle.audited

Emitted when documentation lifecycle is audited.

- **Payload:** `{ results: AuditResult[] }`
- **Published by:** docs-audit
- **Subscribed by:** session-tracker

---

## Task Events

### task.completed

Emitted when a task is marked as completed.

- **Payload:** `{ taskId: string, description: string }`
- **Published by:** context-buffer-writer
- **Subscribed by:** session-tracker

---

## Command Events

### command.completed

Emitted when a CLI command finishes execution.

- **Payload:** `{ command: string, duration: number, success: boolean }`
- **Published by:** CLI infrastructure
- **Subscribed by:** session-tracker, telemetry

---

## Challenge Events

### challenge.generated

Emitted when challenges are auto-generated from engineering state.

- **Payload:** `{ challenges: Challenge[] }`
- **Published by:** context command
- **Subscribed by:** rule-engine

---

## State Events

### state.mutated

Emitted when the engineering state is mutated.

- **Payload:** `{ field: string, previous: unknown, current: unknown }`
- **Published by:** context-buffer-writer
- **Subscribed by:** telemetry

---

## Event Relationships

```
session.start → analysis.complete → score.calculated → pattern.detected
                                                          ↓
                                            debt.detected → evolution.recommended
                                                          ↓
                                            recommendation.accepted/rejected
                                                          ↓
                                            pipeline.complete → session.end
```

---

*Last updated: 2026-07-13*
