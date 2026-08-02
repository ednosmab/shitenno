---
category: architecture
lifecycle: Active
---

# 11 — KNOWLEDGE DEBT

> The silent killer of engineering productivity.

## Definition

**Knowledge Debt** is the accumulated cost of missing, stale, or disconnected engineering knowledge. It compounds over time, just like technical debt.

> For the formal domain definition, see [ubiquitous-language.md](../domain/ubiquitous-language.md#knowledge-debt).

## The 10 Debt Types

| Type | Description | Severity Range |
|------|-------------|---------------|
| `adr_missing` | No ADRs for a project with decisions | high-critical |
| `runbook_missing` | No runbooks for operational tasks | medium-high |
| `skill_missing` | No skills extracted from patterns | medium |
| `docs_missing` | Critical governance docs missing | high-critical |
| `automation_missing` | Manual processes that should be automated | medium |
| `contract_missing` | AI agents without governance contracts | high |
| `workflow_missing` | No defined workflow | high |
| `review_missing` | No session review process | medium |
| `test_missing` | No tests for codebase | high-critical |
| `adr_stale` | ADRs that reference outdated information | medium-high |

## Detection Functions

Each debt type has a dedicated detection function:

```typescript
// 8 detection functions
function detectMissingADRs(shitennoDir: string, analysis: ProjectAnalysis): KnowledgeGap[];
function detectMissingRunbooks(shitennoDir: string): KnowledgeGap[];
function detectMissingSkills(shitennoDir: string): KnowledgeGap[];
function detectMissingDocs(shitennoDir: string): KnowledgeGap[];
function detectMissingAutomation(shitennoDir: string, analysis: ProjectAnalysis): KnowledgeGap[];
function detectMissingContracts(shitennoDir: string): KnowledgeGap[];
function detectMissingWorkflow(shitennoDir: string): KnowledgeGap[];
function detectStaleADRs(shitennoDir: string): KnowledgeGap[];
```

## The Knowledge Gap Interface

```typescript
interface KnowledgeGap {
  type: DebtType;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  affectedArtifacts: string[];
  recommendation: string;
  effort: "low" | "medium" | "high";
}
```

## Severity Calculation

Severity is determined by:

1. **Impact:** How much does this gap affect governance?
2. **Urgency:** How soon should this be addressed?
3. **Effort:** How hard is it to fix?

| Factor | Weight |
|--------|--------|
| Impact on governance | 40% |
| Impact on AI readiness | 30% |
| Impact on team velocity | 20% |
| Risk of knowledge loss | 10% |

## Health Score

Knowledge debt is summarized as a health score (0-100):

```
healthScore = 100 - (totalSeverityWeight / maxPossibleSeverity * 100)
```

| Score Range | Health |
|-------------|--------|
| 90-100 | Excellent |
| 70-89 | Good |
| 50-69 | Needs attention |
| 30-49 | Warning |
| 0-29 | Critical |

## Remediation

Each gap includes a remediation recommendation:

| Gap Type | Typical Remediation |
|----------|-------------------|
| `adr_missing` | Create ADRs for recent decisions |
| `runbook_missing` | Document operational procedures |
| `skill_missing` | Extract patterns from repeated practices |
| `docs_missing` | Create missing governance documents |
| `automation_missing` | Automate manual processes |
| `contract_missing` | Create agent contracts |
| `workflow_missing` | Define workflow in WORKFLOW.md |
| `review_missing` | Add session review template |
| `test_missing` | Add test coverage |
| `adr_stale` | Update outdated ADRs |

## The Auto-Evolution Connection

Knowledge debt feeds directly into the auto-evolution engine:

```
detectKnowledgeDebt() → KnowledgeDebtReport → analyzeEvolution() → Recommendations
```

Critical and high severity gaps generate urgent recommendations.

## Implementation

- **Detection:** `detectKnowledgeDebt()` in `src/knowledge-debt.ts:77`
- **Scoring:** `calculateHealthScore()` in `src/knowledge-debt.ts:424`
- **Report writer:** `writeKnowledgeDebtReport()` in `src/knowledge-debt.ts:487`
- **Integration:** `src/commands/doctor.ts` uses `detectKnowledgeDebt()`
