import { calculateHealthPenalty } from "../shared/formatting.js";
import type { KnowledgeGap, DebtType } from "./types.js";

export function calculateDebtHealth(gaps: KnowledgeGap[]): number {
  let score = 100;

  for (const gap of gaps) {
    score -= calculateHealthPenalty(gap.severity);
  }

  return Math.max(0, Math.min(100, score));
}

export function generateRecommendations(gaps: KnowledgeGap[]): string[] {
  const recommendations: string[] = [];

  const critical = gaps.filter((g) => g.severity === "critical");
  const high = gaps.filter((g) => g.severity === "high");

  if (critical.length > 0) {
    recommendations.push(
      `URGENT: ${critical.length} critical gap(s) — address immediately`
    );
  }

  if (high.length > 0) {
    recommendations.push(
      `HIGH: ${high.length} high-severity gap(s) — address this sprint`
    );
  }

  const byType = new Map<DebtType, KnowledgeGap[]>();
  for (const gap of gaps) {
    const list = byType.get(gap.type) || [];
    list.push(gap);
    byType.set(gap.type, list);
  }

  for (const [, typeGaps] of byType) {
    if (typeGaps.length > 0) {
      const firstGap = typeGaps[0];
      if (firstGap) recommendations.push(firstGap.recommendation);
    }
  }

  return recommendations.slice(0, 5);
}
