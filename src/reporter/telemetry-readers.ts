/**
 * reporter/telemetry-readers.ts — Telemetry File Reading Helpers
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DimensionSummary } from "../feedback-loops.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TelemetryTrend {
  current: number;
  previous: number;
  delta: number;
}

interface TelemetrySnapshot {
  overallScore?: number;
  healthScore?: number;
  dimensions?: Record<string, number>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function getLatestTelemetryFile(shitennoDir: string, prefix: string, rank = 0): string {
  const telemetryDir = join(shitennoDir, "telemetry");
  if (!existsSync(telemetryDir)) return "";
  try {
    const files = readdirSync(telemetryDir)
      .filter((f: string) => f.startsWith(`${prefix}-`) && f.endsWith(".json"))
      .sort()
      .reverse();
    return files[rank] ? join(telemetryDir, files[rank]) : "";
  } catch {
    return "";
  }
}

export function readJsonFile<T>(path: string, fallback: T): T {
  if (!path || !existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return fallback;
  }
}

export function calculateDimensionScore(summary: DimensionSummary): number {
  const total = summary.acceptCount + summary.rejectCount + summary.deferCount;
  if (total === 0) return 50;
  const base = (summary.acceptCount / total) * 100;
  const penalty = (summary.rejectCount / total) * 30;
  return Math.max(0, Math.min(100, Math.round(base - penalty + 20)));
}

export function detectTrend(current: number, previous: number): "improving" | "stable" | "declining" {
  const delta = current - previous;
  if (delta > 5) return "improving";
  if (delta < -5) return "declining";
  return "stable";
}

export function readTelemetryValue(
  shitennoDir: string,
  prefix: string,
  extract: (data: TelemetrySnapshot) => number | undefined,
  options?: { rank?: number; fallback?: number }
): number {
  const rank = options?.rank ?? 0;
  const fallback = options?.fallback ?? 0;
  const file = getLatestTelemetryFile(shitennoDir, prefix, rank);
  const data = file ? readJsonFile<TelemetrySnapshot>(file, {}) : {};
  return extract(data) ?? fallback;
}
