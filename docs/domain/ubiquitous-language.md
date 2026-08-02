---
category: domain
lifecycle: Active
---

# Ubiquitous Language

> Official domain specification of the Shitenno. Every term here has exactly one meaning. When in doubt, refer here.

This is the primary conceptual reference of the project. In case of conflict between documents, the definition in this Domain layer prevails.

---

## Observation

- **Definition:** A perception of something in the project that deserves attention. It is the rawest form of knowledge — an insight before it is validated or formalized.
- **Responsibility:** Capture what was noticed. Nothing more.
- **When born:** Stage 1 of the Knowledge Lifecycle. The moment someone — human or AI — notices a pattern, an anomaly, a risk, or an opportunity.
- **Produced by:** Engineers, AI agents, monitoring systems, analysis engines.
- **Consumed by:** Hypothesis stage, Knowledge Engine, pattern detectors.
- **Relationships:** → Hypothesis (when validated), → Knowledge (when formalized), → Knowledge Debt (when not captured).
- **Examples:** "When I forget to run tests before committing, bugs slip through." / "This module has been modified 47 times in 3 months."
- **Anti-examples:** A measured metric (that is a Measurement, not an Observation). A documented decision (that is Knowledge, not an Observation).

---

## Knowledge

- **Definition:** Validated understanding that has been formalized and stored persistently. Knowledge is information that has been processed, connected, and made actionable.
- **Responsibility:** Represent what the team knows in a form that can be referenced, connected, and evolved.
- **When born:** When an Observation passes through formalization stages (Hypothesis → Experiment → Decision → Record).
- **Produced by:** Humans (through decisions), AI agents (through analysis), the Knowledge Lifecycle (through formalization).
- **Consumed by:** Engineering Assets (as content), Capabilities (as foundation), Decisions (as context), AI agents (as governed input).
- **Relationships:** ← Observation (source), → Engineering Assets (container), → Decisions (context), → Capabilities (foundation).
- **Examples:** An ADR recording why a database was chosen. / A skill describing when to apply TDD. / A contract defining AI agent permissions.
- **Anti-examples:** A raw metric (that is Data, not Knowledge). A session note (that is Memory, not Knowledge). An unvalidated assumption (that is a Hypothesis, not Knowledge).

---

## Engineering Asset

- **Definition:** A persistent artifact that contains knowledge. Engineering Assets are the containers of knowledge — they make knowledge tangible, storable, and connectable.
- **Responsibility:** Persist knowledge in a form that can be discovered, referenced, and evolved.
- **When born:** When knowledge is recorded in a structured format (ADR, Skill, Contract, Workflow, Runbook, Script).
- **Produced by:** Engineers (through documentation), AI agents (through generation), the scaffolding system (through templates).
- **Consumed by:** Humans (for reference), AI agents (for context), the Knowledge Graph (for relations), Capabilities (for detection).
- **Relationships:** ← Knowledge (content), → Knowledge Graph (as nodes), → Capabilities (as detection criteria), → AI Context (as governed input).
- **Examples:** ADR-001.md / skill-tdd.md / contract-frontend-agent.yaml / workflow-feature.md / runbook-deploy.md
- **Anti-examples:** A temporary session note (that is Memory). A computed metric (that is State). A raw log entry (that is Data).

---

## Capability

- **Definition:** A modular unit of governance functionality that represents a dimension of engineering maturity. Capabilities are not features — they are commitments to govern a specific aspect of engineering practice.
- **Responsibility:** Encapsulate a coherent set of governance behaviors that strengthen a specific maturity dimension.
- **When born:** When a team needs to govern a new aspect of their engineering practice (e.g., AI integration, compliance, metrics).
- **Produced by:** The Capability Engine (through recommendation), humans (through installation decision).
- **Consumed by:** Engineering State (as a component of maturity), Recommendations (as installable units), the Upgrade process (as targets).
- **Relationships:** ← Maturity Profile (dimension scores drive recommendation), → Engineering Assets (creates file structures), → Engineering State (installed capabilities affect score).
- **Examples:** `core`, `knowledge`, `architecture`, `governance`, `ai`, `quality`, `metrics`, `operations`, `compliance`.
- **Anti-examples:** A CLI command (that is a Functionality, not a Capability). A configuration option (that is a Setting, not a Capability).

---

## Engineering State

- **Definition:** The measurable condition of a project's engineering practices, governance maturity, and knowledge health at a specific point in time. It is the single source of truth for understanding a project's actual condition.
- **Responsibility:** Answer three questions: Where are we now? What's wrong? What should we do next?
- **When born:** When the system first analyzes a project. Updated on each subsequent analysis.
- **Produced by:** The consolidation of Maturity Profile, Knowledge Debt, and Recommendations.
- **Consumed by:** Recommendations (as input), AI agents (as governed context), humans (for decision-making), Evolution (as baseline).
- **Relationships:** ← Maturity Profile (scores), ← Knowledge Debt (gaps), ← Complexity Score (structural assessment), → Recommendations (next actions), → AI Context (governed input).
- **Examples:** A snapshot showing maturity score 58, 12 knowledge gaps, and 3 urgent recommendations.
- **Anti-examples:** A single metric (that is a Measurement, not a State). A code coverage report (that is a Report, not a State). A git log (that is History, not a State).

---

## Decision

- **Definition:** A choice made between alternatives, recorded with context, rationale, and consequences. Decisions are the bridge between knowledge and action.
- **Responsibility:** Make explicit what was chosen, why it was chosen, and what the alternatives were.
- **When born:** When a team commits to a course of action after considering alternatives.
- **Produced by:** Humans (through deliberation), AI agents (through recommendation with confidence).
- **Consumed by:** ADRs (as formal records), Skills (as patterns), Contracts (as constraints), Evolution (as evidence).
- **Relationships:** ← Knowledge (context), ← Engineering State (current condition), → ADR (formal record), → Action (execution plan), → Knowledge Lifecycle (formalization).
- **Examples:** "We decided to use PostgreSQL because of JSONB support and team expertise." / "We decided to require test execution before commit."
- **Anti-examples:** A recommendation (that is a Proposal, not a Decision). A directive from management (that is a Policy, not a Decision). A guess (that is a Hypothesis, not a Decision).

---

## Action

- **Definition:** An operation that modifies the project. Actions are the execution of decisions — they change the actual state of the codebase, governance structure, or knowledge artifacts.
- **Responsibility:** Execute decisions in a way that is traceable, reversible when possible, and consistent with governance rules.
- **When born:** When a decision is translated into specific operations (create file, update record, install capability, run script).
- **Produced by:** The Governance Engine (through sequencing), humans (through approval), automation (through scripts).
- **Consumed by:** Project Evolution (as changes), Feedback Loops (as outcomes), Engineering State (as updates).
- **Relationships:** ← Decision (source), → Project Evolution (effect), → Feedback Loop (outcome), → Engineering State (update).
- **Examples:** Creating an ADR. / Installing a capability. / Running a validation script. / Updating a workflow.
- **Anti-examples:** A recommendation (that is a Proposal, not an Action). A plan (that is an Intent, not an Action). A thought (that is a Decision, not an Action).

---

## Knowledge Debt

- **Definition:** The accumulated cost of missing, stale, or disconnected engineering knowledge. It represents the gap between what should exist and what does exist.
- **Responsibility:** Quantify the risk of missing knowledge so that teams can prioritize remediation.
- **When born:** When a knowledge artifact is expected but absent, or when existing artifacts become outdated or disconnected.
- **Produced by:** The Knowledge Debt detector (through analysis of expected vs. existing artifacts).
- **Consumed by:** Engineering State (as a health component), Recommendations (as prioritization input), Humans (for awareness).
- **Relationships:** ← Engineering Assets (gap analysis), → Engineering State (health score), → Recommendations (prioritization), → Knowledge Lifecycle (remediation targets).
- **Examples:** No ADRs for a project with architectural decisions. / An ADR referencing a library that was replaced 6 months ago. / No skills extracted from recurring patterns.
- **Anti-examples:** Code debt (that is Technical Debt, not Knowledge Debt). Missing tests (that is Quality Debt, only partially Knowledge Debt). A bug (that is a Defect, not Knowledge Debt).

---

## Maturity Profile

- **Definition:** A multi-dimensional assessment of engineering maturity across seven dimensions. It shows where a team is strong and where it needs improvement.
- **Responsibility:** Provide a nuanced view of maturity that avoids false uniformity.
- **When born:** When the system first analyzes a project. Re-evaluated on each `shugo assess` run.
- **Produced by:** The Maturity Profiler (through scoring each dimension based on detected artifacts and practices).
- **Consumed by:** Capability Engine (as recommendation input), Engineering State (as a component), Humans (for self-assessment).
- **Relationships:** ← Engineering Assets (detection), → Capability Engine (recommendation input), → Engineering State (component).
- **Examples:** Architecture: 80, Quality: 90, Automation: 40, AI: 20, Documentation: 70, Observability: 30, Governance: 60. Overall: 58.
- **Anti-examples:** A single score (that is a Metric, not a Profile). A code quality report (that is a Report, not a Profile). A team survey (that is Perception, not a Profile).

---

## Complexity Score

- **Definition:** A composite score combining static metrics (project structure) and behavioral metrics (team behavior) to quantify the complexity of a project.
- **Responsibility:** Provide an objective measure of project complexity that goes beyond lines of code.
- **When born:** When the system analyzes a project's structure and history.
- **Produced by:** The Scoring Engine (through weighted combination of static and behavioral metrics).
- **Consumed by:** Engineering State (as a component), Recommendations (as context), Humans (for awareness).
- **Relationships:** ← Static Metrics (structural), ← Behavioral Metrics (activity), → Engineering State (component), → Per-Area Scores (decomposition).
- **Examples:** Overall score 67 (level: moderate). / Per-area: src/core: 82, src/commands: 45, src/utils: 23.
- **Anti-examples:** Lines of code (that is a Size Metric, not a Complexity Score). Number of commits (that is an Activity Metric, not a Complexity Score).

---

## Pattern

- **Definition:** A recurring behavior detected from historical data. Patterns reveal what the team actually does, as opposed to what they say they do.
- **Responsibility:** Surface recurring behaviors that may need to be formalized as skills, automated, or corrected.
- **When born:** When the same behavior is observed multiple times across sessions, commits, or validations.
- **Produced by:** The Pattern Detector (through analysis of history, commits, and validation results).
- **Consumed by:** Recommendations (as evidence), Skills (as source material), Knowledge Debt (as indicators).
- **Relationships:** ← History (source), → Recommendations (evidence), → Skills (pattern formalization), → Knowledge Debt (indicators).
- **Examples:** Recurring error in the same module. / Decisions reverted after implementation. / Hot area with disproportionate modification frequency.
- **Anti-examples:** A one-time event (that is an Incident, not a Pattern). A documented convention (that is a Rule, not a Pattern). A hypothesis about behavior (that is a Theory, not a Pattern).

---

## Health Score

- **Definition:** A 0-100 score measuring governance health. It accounts for dead rules, violation hotspots, missing documentation, orphan directories, and stale context.
- **Responsibility:** Quantify the health of the governance structure itself, separate from project complexity.
- **When born:** When the system audits governance artifacts against expected state.
- **Produced by:** The Health Auditor (through deduction-based scoring).
- **Consumed by:** Engineering State (as a health component), Recommendations (as prioritization input), Humans (for awareness).
- **Relationships:** ← Governance Artifacts (audit target), → Engineering State (health component), → Recommendations (prioritization).
- **Examples:** Score 72 with deductions: -8 dead rules, -12 violation hotspots, -5 missing docs, -3 orphan directories.
- **Anti-examples:** Code coverage percentage (that is a Quality Metric, not a Health Score). Uptime percentage (that is an Operational Metric, not a Health Score).

---

## Rule

- **Definition:** A declarative governance behavior consisting of a trigger, conditions, and actions. Rules are the nervous system of Shugo — they respond to events automatically.
- **Responsibility:** Automate governance behaviors without requiring human intervention for routine decisions.
- **When born:** When a governance behavior needs to be automated (e.g., "when a session starts, load context hierarchy").
- **Produced by:** Humans (through definition), AI agents (through recommendation), the Rule Engine (through evaluation).
- **Consumed by:** The Rule Engine (for evaluation), Events (as triggers), Actions (as executors).
- **Relationships:** ← Events (triggers), → Conditions (predicates), → Actions (side effects), → Rule Engine (evaluation).
- **Examples:** "When `session_start` fires AND project has AI agents, load context hierarchy P0-P4."
- **Anti-examples:** A policy document (that is a Guideline, not a Rule). A hardcoded behavior (that is Logic, not a Rule). A configuration option (that is a Setting, not a Rule).

---

## Event

- **Definition:** A signal that something happened in the system. Events are the communication mechanism between modules — they enable decoupled, event-driven architecture.
- **Responsibility:** Notify the system that a state change occurred, without requiring direct coupling between producer and consumer.
- **When born:** When any significant state change occurs in the system (session start, analysis complete, pattern detected, etc.).
- **Produced by:** Any module that detects or causes a state change.
- **Consumed by:** The Event Bus (for distribution), Rules (as triggers), Feedback Loops (as inputs).
- **Relationships:** ← Modules (producers), → Event Bus (distribution), → Rules (triggers), → Feedback Loops (inputs).
- **Examples:** `session.start`, `analysis.complete`, `pattern.detected`, `recommendation.accepted`, `capability.installed`.
- **Anti-examples:** A log message (that is Diagnostic, not an Event). A metric update (that is Measurement, not an Event). A file change (that is a Side Effect, not an Event).

---

## Feedback Loop

- **Definition:** A cycle where the acceptance or rejection of recommendations influences future recommendations. The system learns from human decisions.
- **Responsibility:** Ensure that the system improves its recommendations over time based on actual outcomes.
- **When born:** When a recommendation is accepted or rejected by a human.
- **Produced by:** The Feedback system (through recording of outcomes).
- **Consumed by:** Recommendations (as learning input), Evolution (as evidence of improvement).
- **Relationships:** ← Recommendations (source), ← Humans (acceptance/rejection), → Recommendations (learning input), → Evolution (evidence).
- **Examples:** "Recommendation to install `ai` capability was accepted → increase confidence for similar recommendations." / "Recommendation to restructure was rejected → decrease confidence for similar recommendations."
- **Anti-examples:** A one-time correction (that is a Fix, not a Feedback Loop). A survey response (that is Perception, not a Feedback Loop). A metric change (that is Measurement, not a Feedback Loop).

---

*This document is the single source of truth for domain terminology. All architecture and implementation documents must be consistent with these definitions.*

*Last updated: 2026-06-28*
