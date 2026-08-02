---
category: domain
lifecycle: Active
---

# Engineering State

> How to measure and govern the health of an engineering project.

## Definition

**Engineering State** is the measurable condition of a project's engineering practices, governance maturity, and knowledge health at a specific point in time.

It is not a single number. It is a multi-dimensional snapshot that answers three questions:

1. **Where are we now?** (maturity profile)
2. **What's wrong?** (knowledge debt, health issues)
3. **What should we do next?** (recommendations)

The Engineering State is the single source of truth for understanding a project's actual condition.

---

## The Three Components

### 1. Maturity Profile

Seven dimensions, each scored 0-100:

| Dimension | What It Measures | Weight |
|-----------|-----------------|--------|
| Architecture | Design docs, ADRs, modularity, monorepo | 0.18 |
| Quality | Tests, linting, TDD practices | 0.18 |
| Automation | CI/CD, scripts, build pipeline | 0.15 |
| Documentation | Skills, guides, runbooks | 0.15 |
| Governance | Workflows, contracts, context buffer | 0.12 |
| AI | Agent contracts, cognition layer | 0.12 |
| Observability | Reports, history, metrics | 0.10 |

**Overall Score:** Weighted average of all dimensions.

Each dimension is computed independently. Teams can be strong in some dimensions and weak in others. Shugo recommends capabilities to strengthen weak dimensions.

---

### 2. Knowledge Debt

Gaps between what should exist and what does exist:

| Debt Type | Description |
|-----------|-------------|
| `adr_missing` | No ADRs for a project with decisions |
| `runbook_missing` | No runbooks for operational tasks |
| `skill_missing` | No skills extracted from patterns |
| `docs_missing` | Critical governance docs missing |
| `automation_missing` | Manual processes that should be automated |
| `contract_missing` | AI agents without governance contracts |
| `workflow_missing` | No defined workflow |
| `review_missing` | No session review process |
| `test_missing` | No tests for codebase |
| `adr_stale` | ADRs that reference outdated information |

---

### 3. Recommendations

Prioritized next actions based on current state:

| Priority | Description |
|----------|-------------|
| `urgent` | Must be addressed now |
| `high` | Should be addressed soon |
| `medium` | Worth addressing |
| `low` | Nice to have |

---

## How It's Measured

### Static Metrics (project structure)

These metrics derive from the project's physical structure:
- Package count
- App count
- Source file count
- Dependency count
- Monorepo detection
- TypeScript usage

### Behavioral Metrics (team behavior)

These metrics derive from team activity:
- Commits per week
- Validation failures
- ADR count
- Open branches
- Sessions without close
- Bug fix commits

### Per-Area Metrics

Each project subdirectory gets its own complexity score:

| Metric | What It Measures |
|--------|-----------------|
| Churn | How often files change |
| Violations | How often rules are broken |
| Sensitive Surface | How many critical files exist |
| Dependency Depth | How many layers of imports |
| Incident-Free Age | How long since last issue |
| Context Pressure | How much context is needed |

---

## Engineering State and the Meta Model

In the Meta Model, Engineering State occupies this position:

```
Capabilities → Engineering State → Decisions
```

Capabilities are evaluated to produce the Engineering State. The Engineering State is analyzed to produce Decisions. This makes Engineering State the bridge between what the project has (capabilities) and what it should do next (decisions).

---

## Engineering State and AI

AI agents need context to be useful. The Engineering State provides the most important context: the current condition of the project.

When an AI agent receives the Engineering State, it understands:
- What capabilities are installed
- What dimensions are strong or weak
- What knowledge debt exists
- What recommendations are pending

This prevents AI agents from making decisions that conflict with the project's actual condition.

---

## Invariants

1. Engineering State answers three questions: where are we, what's wrong, what's next
2. It is a snapshot, not a history
3. It is computed from evidence, not opinion
4. It is the single source of truth for project condition
5. It changes on each analysis (overwritten, not accumulated)

---

*This document defines the Engineering State concept. For the formal specification, see [ubiquitous-language.md](./ubiquitous-language.md). For implementation details, see [architecture/engineering-state-architecture.md](../architecture/engineering-state-architecture.md).*

*Last updated: 2026-06-28*
