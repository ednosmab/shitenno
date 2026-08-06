/**
 * reporter/summary.ts — Summary Generation for Performance Reports
 */

import type { PerformanceMetric, DimensionReport } from "../application/performance-reporter.js";
import type { SessionMetrics } from "../infrastructure/session-tracker.js";
import type { GrowthProfile } from "../infrastructure/growth-profile.js";

export interface SummaryContext {
  dimensions: Record<PerformanceMetric, DimensionReport>;
  sessionMetrics: SessionMetrics;
  totalInteractions: number;
  accepted: number;
  rejected: number;
  growthProfile: GrowthProfile;
}

export function generateSummary(ctx: SummaryContext): string {
  const parts: string[] = [];

  const dimScores = Object.values(ctx.dimensions).map((d) => d.score);
  const avgScore = dimScores.length > 0
    ? Math.round(dimScores.reduce((a, b) => a + b, 0) / dimScores.length)
    : 0;

  parts.push(`Score médio: ${avgScore}/100.`);
  parts.push(`${ctx.sessionMetrics.totalSessions} sessões.`);
  parts.push(`${ctx.totalInteractions} interações (${ctx.accepted} aceites, ${ctx.rejected} rejeitadas).`);
  parts.push(`Capacidade de crescimento: ${Math.round(ctx.growthProfile.growthCapacity * 100)}%.`);

  return parts.join(" ");
}
