/**
 * reporter/assembly.ts — Performance Report Assembly
 */

import type { PerformanceMetric, DimensionSummary, FeedbackRecord, FeedbackPattern } from "../feedback-loops.js";
import type { SessionMetrics } from "../session-tracker.js";
import type { GrowthProfile } from "../growth-profile.js";
import type { DimensionReport, PerformanceReport, Insight } from "../performance-reporter.js";

import { calculateDimensionScore, detectTrend } from "./telemetry-readers.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface FeedbackMetrics {
  totalInteractions: number;
  accepted: number;
  rejected: number;
  challenging: number;
  totalPathChoices: number;
}

export interface DimensionReportResult {
  dimensions: Record<PerformanceMetric, DimensionReport>;
  dominantDim: PerformanceMetric | null;
  weakestDim: PerformanceMetric | null;
}

export interface ReportData {
  periodStart: Date;
  now: Date;
  days: number;
  dominantDim: PerformanceMetric | null;
  weakestDim: PerformanceMetric | null;
  dimensions: Record<PerformanceMetric, DimensionReport>;
  sessionMetrics: SessionMetrics;
  dayFrequency: Record<string, number>;
  feedbackMetrics: FeedbackMetrics;
  patterns: FeedbackPattern[];
  debtTrend: import("./telemetry-readers.js").TelemetryTrend;
  maturityTrend: import("./telemetry-readers.js").TelemetryTrend;
  growthProfile: GrowthProfile;
  insights: Insight[];
  nextSteps: string[];
  summary: string;
}

// ── Dimension Reports ──────────────────────────────────────────────────────

export function buildDimensionReports(
  dimensionSummaries: Record<string, DimensionSummary>,
  feedbackRecords: FeedbackRecord[],
  periodStart: Date,
  days: number
): DimensionReportResult {
  const dimensions = {} as Record<PerformanceMetric, DimensionReport>;
  let maxScore = -1;
  let minScore = 101;
  let dominantDim: PerformanceMetric | null = null;
  let weakestDim: PerformanceMetric | null = null;

  const previousPeriodStart = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);
  const previousPeriodRecords = feedbackRecords.filter(
    (r) => new Date(r.timestamp) >= previousPeriodStart && new Date(r.timestamp) < periodStart
  );

  for (const [dim, summary] of Object.entries(dimensionSummaries)) {
    const d = dim as PerformanceMetric;
    const score = calculateDimensionScore(summary);
    const previousDimRecords = previousPeriodRecords.filter((r) => r.dimension === d);
    const previousSummary: DimensionSummary = {
      dimension: d,
      acceptCount: previousDimRecords.filter((r) => r.action === "accepted").length,
      rejectCount: previousDimRecords.filter((r) => r.action === "rejected").length,
      deferCount: previousDimRecords.filter((r) => r.action === "deferred").length,
      evidence: [],
    };
    const previousScore = calculateDimensionScore(previousSummary);

    dimensions[d] = {
      score,
      trend: detectTrend(score, previousScore),
      acceptRate: summary.acceptCount + summary.rejectCount > 0
        ? Math.round((summary.acceptCount / (summary.acceptCount + summary.rejectCount)) * 100)
        : 50,
      evidence: summary.evidence,
    };

    if (score > maxScore) { maxScore = score; dominantDim = d; }
    if (score < minScore) { minScore = score; weakestDim = d; }
  }

  if (maxScore === minScore && maxScore >= 0) {
    dominantDim = null;
    weakestDim = null;
  }

  return { dimensions, dominantDim, weakestDim };
}

export function computeFeedbackMetrics(periodRecords: FeedbackRecord[]): FeedbackMetrics {
  return {
    totalInteractions: periodRecords.length,
    accepted: periodRecords.filter((r) => r.action === "accepted").length,
    rejected: periodRecords.filter((r) => r.action === "rejected").length,
    challenging: periodRecords.filter((r) => r.pathChoice === "challenging").length,
    totalPathChoices: periodRecords.filter((r) => r.pathChoice).length,
  };
}

export function computeDayFrequency(feedbackRecords: FeedbackRecord[]): Record<string, number> {
  const dayFrequency: Record<string, number> = {};
  for (const record of feedbackRecords) {
    const day = record.timestamp.split("T")[0];
    if (day) {
      dayFrequency[day] = (dayFrequency[day] || 0) + 1;
    }
  }
  return dayFrequency;
}

export function assembleReport(data: ReportData): PerformanceReport {
  return {
    period: {
      from: data.periodStart.toISOString().slice(0, 10),
      to: data.now.toISOString().slice(0, 10),
      days: data.days,
    },
    profile: {
      dominantDimension: data.dominantDim,
      weakestDimension: data.weakestDim,
      growthPattern: data.growthProfile.patterns[0]?.type || "balanced",
      growthCapacity: data.growthProfile.growthCapacity,
      challengeLevel: data.growthProfile.challengeLevel,
    },
    dimensions: data.dimensions,
    sessions: {
      total: data.sessionMetrics.totalSessions,
      avgDuration: data.sessionMetrics.avgDuration,
      mostActiveDay: Object.entries(data.dayFrequency).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A",
      commandFrequency: data.sessionMetrics.commandFrequency,
    },
    feedback: {
      totalInteractions: data.feedbackMetrics.totalInteractions,
      acceptanceRate: data.feedbackMetrics.totalInteractions > 0
        ? Math.round((data.feedbackMetrics.accepted / data.feedbackMetrics.totalInteractions) * 100)
        : 0,
      challengingRatio: data.feedbackMetrics.totalPathChoices > 0
        ? Math.round((data.feedbackMetrics.challenging / data.feedbackMetrics.totalPathChoices) * 100)
        : 50,
      patterns: data.patterns.map((p) => p.description),
      suppressedCount: data.patterns.filter((p) => p.type === "always_rejects").length,
    },
    debtTrend: data.debtTrend,
    maturityTrend: data.maturityTrend,
    insights: data.insights,
    nextSteps: data.nextSteps,
    summary: data.summary,
  };
}
