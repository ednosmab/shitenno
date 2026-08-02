---
category: architecture
lifecycle: Active
---

# 02 — UBIQUITOUS LANGUAGE

> Every term in this document has exactly one meaning. When in doubt, refer here.

## Core Concepts

### Shitenno
The complete governance framework consisting of CLI commands, core modules, templates, and documentation. The system that governs engineering knowledge.

### Shugo CLI
The command-line interface to the Shitenno. Provides 13 commands: `init`, `status`, `detect`, `audit`, `evolve`, `run`, `upgrade`, `validate`, `sync`, `assess`, `clean`, `doctor`, `report`.

### Governance
The practice of making engineering decisions explicit, traceable, and enforceable. Not bureaucracy — clarity.

### Knowledge
Permanent engineering artifacts: ADRs, skills, contracts, workflows, runbooks, scripts, documentation.

### State
Current project information: maturity profile, installed capabilities, complexity score, project metadata.

### Memory
Temporary session information: current task, blockers, reminders, loaded documents.

## Knowledge Types

### ADR (Architecture Decision Record)
A formal document recording an architectural decision: context, decision, consequences, alternatives considered. Status: `accepted`, `superseded`, `deprecated`.

### Skill
A reusable engineering pattern extracted from experience. Contains: description, when to apply, when NOT to apply, example, anti-patterns.

### Contract
A formal agreement defining an AI agent's permissions, responsibilities, and constraints. Specifies: allowed actions, restricted actions, inputs, outputs, failure policy.

### Workflow
A defined sequence of steps for a specific operation type (FEATURE, BUG, REFACTOR, etc.). The single entry point for all agents.

### Runbook
A step-by-step procedure for a specific operational task (merge, deploy, rollback).

### SDR (Solution Decision Record)
A document recording a specific solution decision: problem, root cause, solution, affected files.

## Capability System

### Capability
A modular unit of governance functionality. 9 capabilities: `core`, `knowledge`, `architecture`, `governance`, `ai`, `quality`, `metrics`, `operations`, `compliance`.

### Capability Mapping
The single source of truth for which files and directories each capability creates. Defined in `capability-mapping.ts`.

### Capability Installation
The process of adding a capability to a project via `shugo upgrade --capability <name>`.

### Capability Dependency
A prerequisite capability that must be installed before another. Example: `ai` requires `governance`.

## Maturity System

### Maturity Profile
A multi-dimensional assessment of engineering maturity. 7 dimensions: `architecture`, `governance`, `quality`, `automation`, `ai`, `documentation`, `observability`. Each scored 0-100.

### Maturity Dimension
One axis of the maturity profile. Each dimension measures a specific aspect of engineering practice.

### Overall Score
Weighted average of all 7 dimensions. Weights: architecture (0.18), quality (0.18), automation (0.15), documentation (0.15), governance (0.12), ai (0.12), observability (0.10).

## Analysis Engine

### Complexity Score
A composite score combining static metrics (packages, files, dependencies) and behavioral metrics (commits, violations, sessions). Range: 0-100.

### Static Metric
A metric derived from project structure: file count, dependency count, monorepo detection, TypeScript usage.

### Behavioral Metric
A metric derived from team behavior: commit frequency, violation count, session patterns, bug fix rate.

### Area Score
Complexity score computed per project area (subdirectory). Used for hotspot detection.

### Pattern
A recurring behavior detected from history: repeated errors, reverted decisions, hot areas.

### Health Score
A 0-100 score measuring governance health. Deductions for: dead rules, violation hotspots, missing docs, orphan directories, stale context.

## Infrastructure

### Event Bus
A pub/sub system that enables communication between modules. Events: `session.start`, `analysis.complete`, `pattern.detected`, etc.

### Pipeline
An orchestration engine that chains analysis stages: analyze → score → detect → audit → evolve → recommend.

### State Machine
A finite state machine governing Shugo's own lifecycle: `uninitialized → discovered → assessed → governed → evolved → mature`.

### Feedback Loop
A cycle where recommendation acceptance/rejection influences future recommendations. The system learns from human decisions.

### Plugin System
An extensibility mechanism allowing projects to add custom checks, recommendations, and capabilities without modifying Shugo core.

## Knowledge Debt

### Knowledge Debt
The accumulated cost of missing, stale, or disconnected engineering knowledge. Detected across 10 types: `adr_missing`, `runbook_missing`, `skill_missing`, `docs_missing`, `automation_missing`, `contract_missing`, `workflow_missing`, `review_missing`, `test_missing`, `adr_stale`.

### Debt Severity
The impact level of a knowledge gap: `critical`, `high`, `medium`, `low`.

### Debt Remediation
The process of addressing knowledge debt: creating missing artifacts, updating stale ones, connecting disconnected ones.

## Governance Rules

### Rule
A declarative governance behavior: trigger + conditions + actions. Defined in JSON files under `governance/rules/`.

### Trigger
An event that activates a rule: `session_start`, `validation_fail`, `maturity_change`, etc.

### Condition
A predicate evaluated against the current context. All conditions must be true (AND logic).

### Action
A side effect executed when a rule fires: `create_reminder`, `log_event`, `update_backlog`, etc.

### SÓ PROPÕE, nunca aplica
The absolute principle: Shugo proposes changes, never auto-applies them. Humans maintain final authority.
