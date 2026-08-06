/**
 * trend-engine.ts — Trend Prediction Engine
 *
 * Analyses historical snapshots to predict future state.
 * Provides actionable insights about where the project is heading.
 *
 * PRINCIPLE: Data-driven predictions, not guesses.
 */

import type { EngineeringState } from "../../application/engineering-state.js";
import { logger } from "../../shared/logger.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface TrendSnapshot {
  timestamp: string;
  healthScore: number;
  entropyScore: number;
  maturityScore: number;
  assetCount: number;
}

export interface TrendDirection {
  metric: string;
  direction: "improving" | "stable" | "degrading";
  rate: number;
}

export interface TrendForecast {
  current: TrendSnapshot;
  trends: TrendDirection[];
  predictions: TrendPrediction[];
  confidence: number;
}

export interface TrendPrediction {
  metric: string;
  currentValue: number;
  predictedValue: number;
  timeframe: "short" | "medium" | "long";
  confidence: number;
}

// ── Trend Analysis ──────────────────────────────────────────────────────────

/**
 * Calculate trend direction from a series of values.
 */
function calculateTrend(values: number[]): TrendDirection {
  if (values.length < 2) {
    return { metric: "", direction: "stable", rate: 0 };
  }

  const changes: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const current = values[i];
    const previous = values[i - 1];
    if (current !== undefined && previous !== undefined) {
      changes.push(current - previous);
    }
  }

  const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
  const rate = Math.abs(avgChange);

  let direction: "improving" | "stable" | "degrading";
  if (avgChange > 0.5) {
    direction = "improving";
  } else if (avgChange < -0.5) {
    direction = "degrading";
  } else {
    direction = "stable";
  }

  return { metric: "", direction, rate };
}

/**
 * Build trend snapshots from a list of engineering states.
 */
export function buildTrendSnapshots(states: EngineeringState[]): TrendSnapshot[] {
  return states.map((state) => ({
    timestamp: state.consolidatedAt,
    healthScore: state.healthScores.overall,
    entropyScore: state.entropy.score,
    maturityScore: state.maturity?.overallScore ?? 0,
    assetCount: state.assets.length,
  }));
}

/**
 * Analyse trends from snapshots.
 */
export function analyseTrends(snapshots: TrendSnapshot[]): TrendDirection[] {
  if (snapshots.length < 2) {
    return [];
  }

  const healthScores = snapshots.map((s) => s.healthScore);
  const entropyScores = snapshots.map((s) => s.entropyScore);
  const maturityScores = snapshots.map((s) => s.maturityScore);
  const assetCounts = snapshots.map((s) => s.assetCount);

  const trends: TrendDirection[] = [
    { ...calculateTrend(healthScores), metric: "health" },
    { ...calculateTrend(entropyScores), metric: "entropy" },
    { ...calculateTrend(maturityScores), metric: "maturity" },
    { ...calculateTrend(assetCounts), metric: "assets" },
  ];

  return trends;
}

/**
 * Generate predictions based on trends.
 */
export function generatePredictions(
  current: TrendSnapshot,
  trends: TrendDirection[]
): TrendPrediction[] {
  const predictions: TrendPrediction[] = [];

  for (const trend of trends) {
    const currentValue = getCurrentValue(current, trend.metric);
    if (currentValue === null) continue;

    const rate = trend.direction === "improving" ? trend.rate : -trend.rate;

    predictions.push({
      metric: trend.metric,
      currentValue,
      predictedValue: currentValue + rate * 5,
      timeframe: "short",
      confidence: 0.7,
    });

    predictions.push({
      metric: trend.metric,
      currentValue,
      predictedValue: currentValue + rate * 20,
      timeframe: "medium",
      confidence: 0.5,
    });
  }

  return predictions;
}

function getCurrentValue(snapshot: TrendSnapshot, metric: string): number | null {
  switch (metric) {
    case "health":
      return snapshot.healthScore;
    case "entropy":
      return snapshot.entropyScore;
    case "maturity":
      return snapshot.maturityScore;
    case "assets":
      return snapshot.assetCount;
    default:
      return null;
  }
}

/**
 * Full forecast: analyse trends and generate predictions.
 */
export function generateForecast(states: EngineeringState[]): TrendForecast | null {
  if (states.length < 2) {
    logger.debug("trend-engine", "Insufficient data for forecast (need ≥ 2 snapshots)");
    return null;
  }

  const snapshots = buildTrendSnapshots(states);
  const current = snapshots[snapshots.length - 1];
  if (!current) return null;

  const trends = analyseTrends(snapshots);
  const predictions = generatePredictions(current, trends);

  const confidence = Math.min(0.9, 0.5 + snapshots.length * 0.05);

  return {
    current,
    trends,
    predictions,
    confidence,
  };
}
