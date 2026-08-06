/**
 * performance-reporter.ts — User Performance Reporting (barrel)
 *
 * Generates rich performance reports for the user, inspired by the
 * manual feedback templates in feedback/. Captures 7 dimensions,
 * growth trajectory, session metrics, and personal insights.
 *
 * PRINCIPLE: To improve, one must first see oneself clearly.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readTelemetryValue } from "../reporter/telemetry-readers.js";
import { buildDimensionReports, computeFeedbackMetrics, computeDayFrequency, assembleReport } from "../reporter/assembly.js";
import { generateInsights, generateNextSteps } from "../reporter/insights.js";
import { generateSummary } from "../reporter/summary.js";
import { getAllDimensionSummaries, getFeedbackRecords, detectFeedbackPatterns } from "./feedback-loops.js";
import { getSessionMetrics } from "../infrastructure/session-tracker.js";
import { loadGrowthProfile } from "../infrastructure/growth-profile.js";
import type { PerformanceReport, PerformanceRecommendation } from "../reporter/types.js";

// ── Re-exports from sub-modules ────────────────────────────────────────────

export type { PerformanceMetric, DimensionReport, Insight, DimensionExtremes, InsightContext, PerformanceReport, PerformancePeriod, PerformanceProfile, SessionReport, FeedbackReport, PerformanceRecommendation } from "../reporter/types.js";
export { METRIC_KEYS, METRIC_LABELS } from "../reporter/types.js";

export type { TelemetryTrend } from "../reporter/telemetry-readers.js";
export { getLatestTelemetryFile, readJsonFile, calculateDimensionScore, detectTrend, readTelemetryValue } from "../reporter/telemetry-readers.js";

export type { FeedbackMetrics, DimensionReportResult, ReportData } from "../reporter/assembly.js";
export { buildDimensionReports, computeFeedbackMetrics, computeDayFrequency, assembleReport } from "../reporter/assembly.js";

export { findDimensionExtremes, generateInsights, generateNextSteps } from "../reporter/insights.js";
export type { SummaryContext } from "../reporter/summary.js";
export { generateSummary } from "../reporter/summary.js";

// ── Main ───────────────────────────────────────────────────────────────────

export function generatePerformanceReport(
  _projectRoot: string,
  shitennoDir: string,
  options?: { days?: number }
): PerformanceReport {
  const days = options?.days || 30;
  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const dimensionSummaries = getAllDimensionSummaries(shitennoDir);
  const feedbackRecords = getFeedbackRecords(shitennoDir);

  const { dimensions, dominantDim, weakestDim } = buildDimensionReports(
    dimensionSummaries, feedbackRecords, periodStart, days
  );

  const periodRecords = feedbackRecords.filter(
    (r) => new Date(r.timestamp) >= periodStart
  );
  const feedbackMetrics = computeFeedbackMetrics(periodRecords);
  const dayFrequency = computeDayFrequency(feedbackRecords);

  const sessionMetrics = getSessionMetrics(shitennoDir);
  const patterns = detectFeedbackPatterns(shitennoDir);
  const growthProfile = loadGrowthProfile(shitennoDir);

  const debtTrend = {
    current: readTelemetryValue(shitennoDir, "knowledge-debt", (d) => d.healthScore, { fallback: 100 }),
    previous: readTelemetryValue(shitennoDir, "knowledge-debt", (d) => d.healthScore, { rank: 1, fallback: 100 }),
    delta: 0,
  };
  debtTrend.delta = debtTrend.current - debtTrend.previous;

  const maturityTrend = {
    current: readTelemetryValue(shitennoDir, "maturity", (d) => d.overallScore),
    previous: readTelemetryValue(shitennoDir, "maturity", (d) => d.overallScore, { rank: 1 }),
    delta: 0,
  };
  maturityTrend.delta = maturityTrend.current - maturityTrend.previous;

  const insights = generateInsights({
    dimensions, sessionMetrics, debtTrend, maturityTrend, growthProfile,
  });

  const nextSteps = generateNextSteps(insights, growthProfile);

  const summary = generateSummary({
    dimensions, sessionMetrics,
    totalInteractions: feedbackMetrics.totalInteractions,
    accepted: feedbackMetrics.accepted, rejected: feedbackMetrics.rejected,
    growthProfile,
  });

  return assembleReport({
    periodStart, now, days, dominantDim, weakestDim, dimensions,
    sessionMetrics, dayFrequency, feedbackMetrics,
    patterns, debtTrend, maturityTrend,
    growthProfile, insights, nextSteps, summary,
  });
}

export function writePerformanceReport(projectRoot: string, report: PerformanceReport): string | null {
  const shitennoDir = join(projectRoot, ".shitenno");
  try {
    if (!existsSync(shitennoDir)) {
      mkdirSync(shitennoDir, { recursive: true });
    }
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const filename = `performance-${dateStr}.json`;
    const reportPath = join(shitennoDir, filename);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    return filename;
  } catch {
    return null;
  }
}

export function getRecommendations(report: PerformanceReport): PerformanceRecommendation[] {
  const recs: PerformanceRecommendation[] = [];
  if (report.profile.dominantDimension) {
    recs.push({ dimension: report.profile.dominantDimension, action: "continuar",
      reason: `Sua força em ${report.profile.dominantDimension} deve ser mantida`, priority: "low" });
  }
  if (report.profile.weakestDimension) {
    recs.push({ dimension: report.profile.weakestDimension, action: "focar",
      reason: `Área com mais potencial de crescimento`, priority: "high" });
  }
  if (report.feedback.challengingRatio < 30) {
    recs.push({ dimension: "decision_making", action: "desafiar",
      reason: "Busque recomendações mais desafiadoras para acelerar crescimento", priority: "medium" });
  }
  return recs;
}
