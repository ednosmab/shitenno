---
category: architecture
lifecycle: Active
---

# 20 — RECOMMENDATION ENGINE

> Auto-evolution formal specification.

## The Problem

Today, Shugo generates recommendations but they are static. The same project gets the same recommendations regardless of history, feedback, or context changes.

The recommendation engine makes recommendations dynamic, context-aware, and learning.

## The Recommendation Interface

```typescript
interface EvolutionRecommendation {
  id: string;
  type: RecommendationType;
  priority: RecommendationPriority;
  title: string;
  description: string;
  expectedImpact: string;
  action: string;
  command?: string;
  affectedArtifacts: string[];
  dependencies: string[];
  confidence: number;      // 0-1, adjusted by feedback
  evidence: string[];
  suppressed?: boolean;    // If rejected too many times
}
```

## Recommendation Types

| Type | Description | Generator |
|------|-------------|-----------|
| `capability_install` | Install a new capability | Capability generator |
| `capability_upgrade` | Upgrade an existing capability | Capability generator |
| `knowledge_creation` | Create missing knowledge artifacts | Knowledge generator |
| `governance_enhancement` | Improve governance practices | Governance generator |
| `automation_addition` | Automate manual processes | Automation generator |
| `debt_remediation` | Address knowledge debt | Debt generator |
| `pattern_extraction` | Extract patterns from history | Pattern generator |
| `architecture_improvement` | Improve architecture | Architecture generator |

## The Generators

### Capability Generator

```typescript
function generateCapabilityRecommendations(
  state: ShitennoState
): EvolutionRecommendation[] {
  const recs: EvolutionRecommendation[] = [];
  
  for (const cap of state.project.recommendedCapabilities) {
    if (!state.project.installedCapabilities.includes(cap)) {
      recs.push({
        id: `EVO-CAP-${cap}`,
        type: "capability_install",
        priority: "high",
        title: `Install ${cap} capability`,
        description: `The ${cap} capability is recommended for your project maturity level.`,
        action: `Run: shugo upgrade --capability ${cap}`,
        command: `shugo upgrade --capability ${cap}`,
        confidence: 0.8,
        evidence: [`Maturity score: ${state.project.maturity?.overallScore}`],
      });
    }
  }
  
  return recs;
}
```

### Knowledge Generator

```typescript
function generateKnowledgeRecommendations(
  state: ShitennoState,
  debt: KnowledgeDebtReport
): EvolutionRecommendation[] {
  const recs: EvolutionRecommendation[] = [];
  
  // No ADRs but has source files
  if (state.knowledge.adrs.length === 0 && state.project.projectInfo.sourceFileCount > 10) {
    recs.push({
      id: "EVO-KNOW-001",
      type: "knowledge_creation",
      priority: "high",
      title: "Create first ADR",
      description: "Your project has decisions but no recorded ADRs.",
      action: "Create an ADR for your most recent architectural decision",
      confidence: 0.9,
      evidence: [`${state.project.projectInfo.sourceFileCount} source files, 0 ADRs`],
    });
  }
  
  // Many ADRs but no skills
  if (state.knowledge.adrs.length > 3 && state.knowledge.skills.length === 0) {
    recs.push({
      id: "EVO-KNOW-002",
      type: "pattern_extraction",
      priority: "medium",
      title: "Extract skills from patterns",
      description: "You have ADRs but haven't extracted reusable skills.",
      action: "Review ADRs and extract common patterns into skills",
      confidence: 0.7,
      evidence: [`${state.knowledge.adrs.length} ADRs, 0 skills`],
    });
  }
  
  return recs;
}
```

### Governance Generator

```typescript
function generateGovernanceRecommendations(
  state: ShitennoState
): EvolutionRecommendation[] {
  const recs: EvolutionRecommendation[] = [];
  
  // Has governance capability but no workflow
  if (state.project.installedCapabilities.includes("governance")) {
    const hasWorkflow = state.knowledge.governanceDocs.some(d => d.name === "WORKFLOW.md");
    if (!hasWorkflow) {
      recs.push({
        id: "EVO-GOV-001",
        type: "governance_enhancement",
        priority: "high",
        title: "Define workflow",
        description: "Governance capability is installed but no workflow is defined.",
        action: "Create governance/WORKFLOW.md",
        confidence: 0.85,
        evidence: ["Governance capability installed, no WORKFLOW.md found"],
      });
    }
  }
  
  return recs;
}
```

### Automation Generator

```typescript
function generateAutomationRecommendations(
  state: ShitennoState
): EvolutionRecommendation[] {
  const recs: EvolutionRecommendation[] = [];
  
  // Many source files but few scripts
  if (state.project.projectInfo.sourceFileCount > 30 && state.knowledge.scripts.length < 3) {
    recs.push({
      id: "EVO-AUTO-001",
      type: "automation_addition",
      priority: "medium",
      title: "Add automation scripts",
      description: "Your project is large but has few automation scripts.",
      action: "Create scripts for repetitive tasks",
      confidence: 0.6,
      evidence: [`${state.project.projectInfo.sourceFileCount} files, ${state.knowledge.scripts.length} scripts`],
    });
  }
  
  return recs;
}
```

## Confidence Scoring

Confidence is adjusted by feedback:

```typescript
function calculateConfidence(
  baseConfidence: number,
  feedback: FeedbackSummary | null
): number {
  if (!feedback) return baseConfidence;
  
  const total = feedback.acceptCount + feedback.rejectCount;
  if (total === 0) return baseConfidence;
  
  const acceptanceRate = feedback.acceptCount / total;
  return baseConfidence * 0.7 + acceptanceRate * 0.3;
}
```

## Suppression

Recommendations are suppressed after 5 rejections:

```typescript
function applySuppression(
  recommendations: EvolutionRecommendation[],
  feedback: FeedbackSummary[]
): EvolutionRecommendation[] {
  return recommendations.map(rec => {
    const fb = feedback.find(f => f.recommendationId === rec.id);
    if (fb && fb.rejectCount >= 5) {
      return { ...rec, suppressed: true };
    }
    return rec;
  });
}
```

## The Evolution Report

```typescript
interface EvolutionReport {
  analyzedAt: string;
  currentState: {
    maturityScore: number;
    installedCapabilities: string[];
    knowledgeDebt: number;
  };
  totalRecommendations: number;
  byType: Record<RecommendationType, number>;
  byPriority: Record<RecommendationPriority, number>;
  recommendations: EvolutionRecommendation[];
  topNextSteps: string[];
  summary: string;
}
```

## Implementation

- **File:** `src/auto-evolution.ts` (335 lines, existing)
- **Enhancement:** Add feedback integration
- **Enhancement:** Add confidence adjustment
- **Enhancement:** Add suppression logic
- **Integration:** `src/pipeline.ts` (evolve stage)
