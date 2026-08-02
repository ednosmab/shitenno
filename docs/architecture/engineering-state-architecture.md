---
category: architecture
lifecycle: Active
---

# Engineering State Architecture

> Implementation of the Engineering State in software.

## Domain Concept

The [Engineering State](../domain/engineering-state.md) is the measurable condition of a project's engineering practices. This document describes how that concept is implemented.

---

## Implementation Structure

### State Manager

The State Manager consolidates three tiers into a single snapshot:

```
function consolidateState(projectRoot, shitennoDir):
  return {
    knowledge: readKnowledgeState(shitennoDir),
    project: readProjectState(projectRoot, shitennoDir),
    memory: readSessionMemory(shitennoDir),
    consolidatedAt: now()
  }
```

This function is read-only — it never modifies state.

### Scoring Engine

The Scoring Engine computes complexity from static and behavioral metrics:

**Static Metrics:**
| Metric | Weight | Source |
|--------|--------|--------|
| Package count | 25 | Filesystem analysis |
| App count | 15 | Filesystem analysis |
| Source file count | 20 | Filesystem analysis |
| Dependency count | 20 | Package manifest |
| Monorepo | 10 | Structure detection |
| TypeScript | 10 | Config detection |

**Behavioral Metrics:**
| Metric | Weight | Source |
|--------|--------|--------|
| Validation failures | 20 | Session history |
| ADR count | 15 | Knowledge state |
| Open branches | 10 | Git history |
| Commits per week | 15 | Git history |
| Sessions without close | 15 | Session history |
| Bug fix commits | 10 | Git history |
| Agent count | 5 | Configuration |

### Maturity Profiler

The Maturity Profiler evaluates 7 dimensions:

```
function evaluateDimensions(artifacts):
  dimensions = {}
  for each dimension in DIMENSIONS:
    dimensions[dimension.name] = score(artifacts, dimension)
  return dimensions
```

Each dimension is scored independently based on detected artifacts.

### Knowledge Debt Detector

The Knowledge Debt Detector identifies gaps between expected and actual artifacts:

```
function detectDebt(projectRoot):
  debt = []
  for each debtType in DEBT_TYPES:
    if not artifactExists(projectRoot, debtType.expected):
      debt.add({
        type: debtType.name,
        severity: debtType.severity,
        description: debtType.description
      })
  return debt
```

### Health Auditor

The Health Auditor computes governance health through deductions:

```
function computeHealthScore(projectRoot):
  score = 100
  score -= countDeadRules(projectRoot) * DEDUCTION
  score -= countViolationHotspots(projectRoot) * DEDUCTION
  score -= countMissingDocs(projectRoot) * DEDUCTION
  score -= countOrphanDirectories(projectRoot) * DEDUCTION
  return max(0, score)
```

---

## Key Files

| File | Lines | Responsibility |
|------|-------|---------------|
| `src/state-manager.ts` | 437 | State consolidation |
| `src/scorer.ts` | 936 | Complexity scoring |
| `src/maturity-profile.ts` | 521 | Maturity evaluation |
| `src/knowledge-debt.ts` | 505 | Debt detection |
| `src/health-auditor.ts` | 364 | Health scoring |

---

## Data Flow

```
Project Analysis → Scoring Engine → Complexity Score
                                    ↓
Knowledge State → Knowledge Debt Detector → Debt List
                                    ↓
Artifacts → Maturity Profiler → Dimension Scores
                                    ↓
                    State Manager → Engineering State Snapshot
                                    ↓
                    Health Auditor → Health Score
```

---

## Invariants

1. State consolidation is read-only
2. Scoring is computed from evidence, not opinion
3. Each dimension is scored independently
4. Debt detection compares expected vs. actual
5. Health scoring is deduction-based

---

*This document describes the implementation of the Engineering State. For the conceptual definition, see [../domain/engineering-state.md](../domain/engineering-state.md).*

*Last updated: 2026-06-28*
