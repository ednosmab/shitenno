import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getEventBus } from "../event-bus.js";
import type { KnowledgeGap, DebtType, DebtSeverity, KnowledgeDebtReport } from "./types.js";
import {
  detectMissingAdrs,
  detectMissingRunbooks,
  detectMissingSkills,
  detectMissingDocs,
  detectMissingAutomation,
  detectMissingContracts,
  detectMissingWorkflows,
  detectStaleAdrs,
} from "./detection.js";
import { calculateDebtHealth, generateRecommendations } from "./scoring.js";

function collectGaps(shitennoDir: string, now: string): KnowledgeGap[] {
  return [
    ...detectMissingAdrs(shitennoDir, now),
    ...detectMissingRunbooks(shitennoDir, now),
    ...detectMissingSkills(shitennoDir, now),
    ...detectMissingDocs(shitennoDir, now),
    ...detectMissingAutomation(shitennoDir, now),
    ...detectMissingContracts(shitennoDir, now),
    ...detectMissingWorkflows(shitennoDir, now),
    ...detectStaleAdrs(shitennoDir, now),
  ];
}

function countGaps(gaps: KnowledgeGap[]): {
  gapsBySeverity: Record<DebtSeverity, number>;
  gapsByType: Record<DebtType, number>;
} {
  const gapsBySeverity: Record<DebtSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  const gapsByType: Record<DebtType, number> = {} as Record<DebtType, number>;
  for (const gap of gaps) {
    gapsBySeverity[gap.severity]++;
    gapsByType[gap.type] = (gapsByType[gap.type] || 0) + 1;
  }
  return { gapsBySeverity, gapsByType };
}

function buildSummary(gaps: KnowledgeGap[], healthScore: number): string {
  const critical = gaps.filter((g) => g.severity === "critical").length;
  const high = gaps.filter((g) => g.severity === "high").length;
  const parts: string[] = [];
  parts.push(`${gaps.length} knowledge gap(s) detected.`);
  if (critical > 0) parts.push(`${critical} critical.`);
  if (high > 0) parts.push(`${high} high.`);
  parts.push(`Debt Health: ${healthScore}/100.`);
  return parts.join(" ");
}

function publishDebtEvents(gaps: KnowledgeGap[]): void {
  for (const gap of gaps) {
    getEventBus().publish("debt.detected", {
      debtType: "knowledge",
      severity: gap.severity,
      source: gap.location || "unknown",
      description: gap.description,
      timestamp: new Date().toISOString(),
    });
  }
  getEventBus().publish("knowledge_debt.detected", {
    gapCount: gaps.length,
    gaps: gaps.map((g) => ({ source: g.location || "unknown", gap: g.description, severity: g.severity })),
    timestamp: new Date().toISOString(),
  });
}

export function detectKnowledgeDebt(
  _projectRoot: string,
  shitennoDir: string
): KnowledgeDebtReport {
  const now = new Date().toISOString();
  const gaps = collectGaps(shitennoDir, now);
  const { gapsBySeverity, gapsByType } = countGaps(gaps);
  const healthScore = calculateDebtHealth(gaps);
  const recommendations = generateRecommendations(gaps);

  publishDebtEvents(gaps);

  return {
    generatedAt: now,
    totalGaps: gaps.length,
    gapsBySeverity,
    gapsByType,
    gaps,
    healthScore,
    summary: buildSummary(gaps, healthScore),
    recommendations,
  };
}

export function writeDebtReport(
  shitennoDir: string,
  report: KnowledgeDebtReport
): string | null {
  const reportsDir = join(shitennoDir, "reports");
  if (!existsSync(reportsDir)) return null;

  const date = new Date().toISOString().slice(0, 10);
  const filename = `knowledge-debt-${date}.json`;
  const filepath = join(reportsDir, filename);

  try {
    writeFileSync(filepath, JSON.stringify(report, null, 2), "utf-8");
    return filename;
  } catch {
    return null;
  }
}
