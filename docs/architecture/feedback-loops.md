---
category: architecture
lifecycle: Active
---

# 17 — FEEDBACK LOOPS

> Recommendations → acceptance → learning.

## The Problem

Today, Shugo generates recommendations but never learns from them. If it recommends installing `governance` capability and the user accepts, the system doesn't know. If the user rejects the same recommendation 10 times, the system still recommends it.

Feedback loops close this gap.

## The Loop

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  ASSESS → RECOMMEND → ACCEPT/REJECT → LEARN → ASSESS │
│                                                      │
└──────────────────────────────────────────────────────┘
```

1. **Assess:** Measure current state
2. **Recommend:** Suggest next actions
3. **Accept/Reject:** Human decides
4. **Learn:** Adjust future recommendations
5. **Re-assess:** Measure the effect

## The Feedback Interface

```typescript
interface FeedbackRecord {
  id: string;
  recommendationId: string;
  action: "accepted" | "rejected" | "deferred";
  reason?: string;
  timestamp: string;
  context: {
    maturityScore: number;
    installedCapabilities: string[];
    knowledgeDebt: number;
  };
}

interface FeedbackSummary {
  recommendationId: string;
  acceptCount: number;
  rejectCount: number;
  deferCount: number;
  acceptanceRate: number;
  lastAction: "accepted" | "rejected" | "deferred" | null;
}
```

## Storage

Feedback is stored as JSON files:

```
shitenno/feedback/
├── records/
│   ├── 2026-06-27-001.json
│   ├── 2026-06-27-002.json
│   └── ...
└── summary.json
```

## Learning Mechanisms

### 1. Confidence Adjustment

When a recommendation is accepted, its confidence increases. When rejected, it decreases.

```typescript
function adjustConfidence(
  currentConfidence: number,
  action: "accepted" | "rejected",
  weight: number
): number {
  if (action === "accepted") {
    return Math.min(1.0, currentConfidence + (1 - currentConfidence) * weight);
  } else {
    return Math.max(0.0, currentConfidence - currentConfidence * weight);
  }
}
```

### 2. Priority Adjustment

Repeated rejections lower priority. Repeated acceptances maintain or increase it.

```typescript
function adjustPriority(
  currentPriority: RecommendationPriority,
  rejectionCount: number
): RecommendationPriority {
  if (rejectionCount >= 3) return "low";
  if (rejectionCount >= 2) return "medium";
  return currentPriority;
}
```

### 3. Recommendation Suppression

If a recommendation is rejected 5+ times, it is suppressed until context changes significantly.

```typescript
function shouldSuppress(
  summary: FeedbackSummary,
  currentContext: PipelineContext,
  lastRejectionContext: PipelineContext
): boolean {
  if (summary.rejectCount < 5) return false;
  
  // Suppress only if context hasn't changed significantly
  const contextChanged = 
    Math.abs(currentContext.maturityScore - lastRejectionContext.maturityScore) > 15;
  
  return !contextChanged;
}
```

### 4. Pattern Detection

Feedback patterns are detected:

```typescript
function detectFeedbackPatterns(records: FeedbackRecord[]): FeedbackPattern[] {
  const patterns: FeedbackPattern[] = [];
  
  // Detect: "Always rejects capability recommendations"
  // Detect: "Always accepts knowledge creation"
  // Detect: "Rejects after maturity threshold X"
  
  return patterns;
}
```

## Integration with Auto-Evolution

The auto-evolution engine consumes feedback:

```typescript
function analyzeEvolutionWithFeedback(
  projectRoot: string,
  feedbackSummary: FeedbackSummary[]
): EvolutionReport {
  const report = analyzeEvolution(projectRoot);
  
  for (const rec of report.recommendations) {
    const feedback = feedbackSummary.find(f => f.recommendationId === rec.id);
    if (feedback) {
      rec.confidence = adjustConfidence(rec.confidence, feedback.lastAction, 0.1);
      rec.priority = adjustPriority(rec.priority, feedback.rejectCount);
    }
  }
  
  return report;
}
```

## User Interface

### Recording Feedback

```typescript
import { recordFeedback } from "./feedback-loops.js";

// User accepts recommendation
recordFeedback({
  recommendationId: "EVO-001",
  action: "accepted",
  context: currentState,
});

// User rejects with reason
recordFeedback({
  recommendationId: "EVO-002",
  action: "rejected",
  reason: "Not relevant for this project type",
  context: currentState,
});
```

### Viewing Feedback History

```typescript
import { getFeedbackSummary } from "./feedback-loops.js";

const summary = getFeedbackSummary();
// Shows acceptance rates, patterns, suppressed recommendations
```

## Privacy

- Feedback is stored locally (never sent externally)
- No personally identifiable information is recorded
- Only recommendation IDs and actions are stored

## Implementation

- **File:** `src/feedback-loops.ts` (~180 lines)
- **Storage:** `shitenno/feedback/`
- **Integration:** `src/auto-evolution.ts` consumes feedback
- **CLI:** `shugo feedback` command (view history)
