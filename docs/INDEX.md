---
category: product
lifecycle: Active
---

# Shitenno — Knowledge Organization

> This is the Constitution of the Shitenno. Every document here is a source of truth for humans and AI agents.

## Start here, depending on what you're looking for

- **What is the project?** → [`docs/domain/identity.md`](domain/identity.md)
- **Why does it exist?** → [`docs/domain/problem-statement.md`](domain/problem-statement.md)
- **Where is it going?** → [`docs/evolution/00-EXECUTIVE-SUMMARY.md`](evolution/00-EXECUTIVE-SUMMARY.md)
- **How do I use it?** → [`docs/handbook/01-fundamentals/quick-start.md`](handbook/01-fundamentals/quick-start.md)
- **How do I contribute?** → [`docs/engineering/CONTRIBUTING.md`](engineering/CONTRIBUTING.md)
- **What does Shitenno generate inside my project?** → `src/templates/base/` (product domain — distinct from the docs above, which describe Shitenno itself)
- **Project vocabulary?** → [`docs/domain/ubiquitous-language.md`](domain/ubiquitous-language.md)

---

## The Four Levels

The Shugo documentation is organized into four hierarchical levels. Each level answers a specific question and depends only on the levels above it.

```
Philosophy
    ↓
Domain
    ↓
Architecture
    ↓
Implementation
```

Every decision in the Shitenno must answer four questions:
1. Does this respect the Philosophy?
2. Does this make sense within the Domain?
3. Does this preserve the Architecture?
4. Only then can it be implemented.

---

### Philosophy (Why)

**Question:** Why does the Shugo exist?

Documents in this layer contain no implementation details, no code, no technology references. They define the identity of the project.

| Document | Purpose |
|----------|---------|
| [Engineering Manifesto](./handbook/philosophy/engineering-manifesto.md) | Why Shugo exists — the problem, the role of AI, the role of the engineer |
| [Principles](./handbook/philosophy/principles.md) | Six immutable principles that govern all decisions |
| [Vision](./handbook/philosophy/vision.md) | Long-term direction — three phases of evolution |

**Read this first** if you want to understand what Shugo is and why it exists.

---

### Domain (What)

**Question:** How does Shugo interpret a project of engineering?

Documents in this layer define the mental model of Shugo. They describe concepts, responsibilities, relationships, and rules. They contain no implementation details.

| Document | Purpose |
|----------|---------|
| [Meta Model](./domain/meta-model.md) | The conceptual flow: Reality → Observation → Knowledge → Assets → Capabilities → State → Decisions → Actions → Evolution |
| [Ubiquitous Language](./domain/ubiquitous-language.md) | Official domain specification — 15 concepts with definitions, responsibilities, relationships |
| [Three-Tier State](./domain/three-tier-state.md) | Knowledge (permanent), State (current), Memory (temporary) |
| [Knowledge Lifecycle](./domain/knowledge-lifecycle.md) | 9 stages: Observation → Hypothesis → Experiment → Decision → ADR → Skill → Contract → Automation → Command |
| [Capability Model](./domain/capability-model.md) | 9 capabilities, dependencies, maturity dimensions |
| [Engineering State](./domain/engineering-state.md) | Measurable condition of engineering practices |
| [Problem Statement](./domain/problem-statement.md) | The problem Shugo exists to solve |
| [Knowledge](./domain/knowledge.md) | What knowledge means in the Shugo context |
| [Engineering Assets](./domain/engineering-assets.md) | What characterizes an engineering asset |
| [Decisions](./domain/decisions.md) | How decisions are modeled |

**Read this** if you want to understand how Shugo thinks.

---

### Architecture (How)

**Question:** How are domain concepts organized to function?

Documents in this layer describe how domain concepts are implemented in software. They contain interfaces, modules, patterns, and technical contracts.

| Document | Purpose |
|----------|---------|
| [Design Principles](./architecture/design-principles.md) | Immutable principles for implementation |
| [Capability Engine](./architecture/capability-engine.md) | Implementation of the Capability Model |
| [Engineering State Architecture](./architecture/engineering-state-architecture.md) | Implementation of the Engineering State |
| [Domain Model Mapping](./architecture/domain-model-mapping.md) | Module-to-Meta-Model alignment |
| [Validation Matrix](./architecture/validation-matrix.md) | Complete module alignment validation |
| [Future Engines](./architecture/future-engines.md) | 5 future engines specification |
| [Complexity Scoring](./architecture/complexity-scoring.md) | Scoring engine implementation |
| [AI Readiness](./architecture/ai-readiness.md) | AI readiness criteria |
| [Knowledge Debt](./architecture/knowledge-debt.md) | Debt detection implementation |
| [Context Management](./architecture/context-management.md) | P0-P4 hierarchy |
| [Adaptive Governance](./architecture/adaptive-governance.md) | Rule engine specification |
| [Knowledge Graph](./architecture/knowledge-graph.md) | Artifact graph implementation |
| [Event Bus](./architecture/event-bus.md) | Pub/sub architecture |
| [Pipeline Engine](./architecture/pipeline-engine.md) | Command orchestration |
| [Feedback Loops](./architecture/feedback-loops.md) | Learning from acceptance/rejection |
| [State Machine](./architecture/state-machine.md) | Lifecycle gates |
| [Plugin System](./architecture/plugin-system.md) | Hooks and extensibility |
| [Recommendation Engine](./architecture/recommendation-engine.md) | Auto-evolution specification |
| [Command Architecture](./architecture/command-architecture.md) | Command patterns |
| [Quality Attributes](./architecture/quality-attributes.md) | Performance, security, usability |
| [AI Agent Guidelines](./architecture/ai-agent-guidelines.md) | Rules for AI agents |
| [Anti-Patterns](./architecture/anti-patterns.md) | What NOT to do |
| [Ubiquitous Language (Quick)](./architecture/ubiquitous-language-quick.md) | Quick reference for daily development |

**Read this** if you want to understand how Shugo is built.

---

### Implementation (Build)

**Question:** How was everything built?

Documents in this layer describe the implementation history, refactoring plans, and roadmap.

| Document | Purpose |
|----------|---------|
| [README Refactor](./implementation/readme-refactor.md) | Plan to rewrite the README |
| [CLI Refactor](./implementation/cli-refactor.md) | Plan to refactor CLI commands |
| [Core Evolution](./implementation/core-evolution.md) | Core evolution roadmap |
| [Validation Checklist](./implementation/validation-checklist.md) | Validation checklist per capability |
| [Roadmap](./implementation/roadmap.md) | Visual roadmap with phases and milestones |

---

### Evolution (Direction)

**Question:** How should the system evolve?

Documents in this layer describe the target architecture, migration strategy, and future roadmap.

| Document | Purpose |
|----------|---------|
| [Evolution README](./evolution/README.md) | Navigation hub for all evolution documents |
| [Executive Summary](./evolution/00-EXECUTIVE-SUMMARY.md) | High-level priorities |
| [Current State Assessment](./evolution/01-CURRENT-STATE-ASSESSMENT.md) | Strengths and risks |
| [Target Architecture](./evolution/03-TARGET-ARCHITECTURE.md) | Target architecture direction |
| [Master Evolution Plan](./evolution/ai/MASTER_EVOLUTION_PLAN.md) | Strategic objectives and roadmap |
| [Migration Waves](./evolution/roadmap/) | Wave 1-4 migration plans |

**Read this** if you want to understand where Shugo is heading.

---

### Engineering (Process)

**Question:** How do we work?

Documents in this layer describe development process, contributing guidelines, and governance rules.

| Document | Purpose |
|----------|---------|
| [Backlog](./BACKLOG.md) | Active work tracker with P0-P3 priorities |

**Read this** if you want to contribute to Shugo.

---

## Reading Guide

| Task | Read |
|------|------|
| Understand why Shugo exists | Philosophy: engineering-manifesto.md |
| Learn the domain model | Domain: meta-model.md |
| Understand a concept | Domain: ubiquitous-language.md |
| See how concepts are implemented | Architecture: domain-model-mapping.md |
| Add a new feature | Architecture: design-principles.md + affected module |
| Validate architecture | Architecture: validation-matrix.md |
| Understand future direction | Architecture: future-engines.md |
| Plan implementation | Implementation: roadmap.md |

## For AI Agents

When working on Shugo, read only the document(s) relevant to your task:

| Task | Read |
|------|------|
| Implement a feature | Philosophy: principles.md + Architecture: the specific module |
| Fix a bug | Architecture: engineering-state-architecture.md + the affected module |
| Add a new capability | Domain: capability-model.md + Architecture: capability-engine.md |
| Refactor commands | Architecture: command-architecture.md |
| Write tests | Philosophy: principles.md + Architecture: quality-attributes.md |
| Review a PR | Philosophy: principles.md + Architecture: anti-patterns.md + validation-matrix.md |
| Understand the system | Philosophy: engineering-manifesto.md → Domain: meta-model.md → ubiquitous-language.md |

---

*This document is the master index of the Shitenno. It organizes knowledge into four levels: Philosophy, Domain, Architecture, Implementation.*

*Last updated: 2026-06-28*
