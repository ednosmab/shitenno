/**
 * feedback/dimensions.ts — Dimension Tracking for Performance Reporting
 */

import type { PerformanceMetric, FeedbackRecord, DimensionSummary } from "./types.js";
import { getFeedbackRecords, recordFeedback } from "./core.js";

/** Record feedback with a performance dimension. */
export function recordDimensionFeedback(
  shitennoDir: string,
  record: {
    recommendationId: string;
    action: "accepted" | "rejected" | "deferred";
    reason?: string;
    dimension: PerformanceMetric;
    evidence: string;
    sessionId?: string;
    pathChoice?: "comfortable" | "challenging";
    context?: {
      maturityScore: number;
      installedCapabilities: string[];
      knowledgeDebt: number;
    };
  }
): FeedbackRecord {
  return recordFeedback(shitennoDir, {
    recommendationId: record.recommendationId,
    action: record.action,
    reason: record.reason,
    dimension: record.dimension,
    evidence: record.evidence,
    sessionId: record.sessionId,
    pathChoice: record.pathChoice,
    context: record.context || {
      maturityScore: 0,
      installedCapabilities: [],
      knowledgeDebt: 0,
    },
  });
}

/** Get feedback summary for a specific dimension. */
export function getDimensionSummary(
  shitennoDir: string,
  dimension: PerformanceMetric
): DimensionSummary {
  const records = getFeedbackRecords(shitennoDir);
  const filtered = records.filter((r) => r.dimension === dimension);

  return {
    dimension,
    acceptCount: filtered.filter((r) => r.action === "accepted").length,
    rejectCount: filtered.filter((r) => r.action === "rejected").length,
    deferCount: filtered.filter((r) => r.action === "deferred").length,
    evidence: filtered
      .filter((r) => r.evidence)
      .map((r) => r.evidence!)
      .slice(-5),
  };
}

/** Get feedback summaries for all dimensions. */
export function getAllDimensionSummaries(
  shitennoDir: string
): Record<PerformanceMetric, DimensionSummary> {
  const dimensions: PerformanceMetric[] = [
    "architectural_vision",
    "scope_management",
    "prompt_quality",
    "decision_making",
    "risk_management",
    "technical_communication",
    "sustainable_velocity",
  ];

  const result = {} as Record<PerformanceMetric, DimensionSummary>;
  for (const dim of dimensions) {
    result[dim] = getDimensionSummary(shitennoDir, dim);
  }
  return result;
}
