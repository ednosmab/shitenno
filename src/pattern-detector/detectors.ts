/**
 * pattern-detector/detectors.ts — Pattern detection algorithms
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DetectedPattern } from "../domain/entities/engineering-state.js";

interface ReportSummary {
  projectName: string;
  score: number;
  level: string;
  areaScores: Array<{ area: string; score: number; violations: number; churn: number }>;
}

interface HistoryEntry {
  filename: string;
  date: string;
  content: string;
  violations: string[];
  areas: string[];
}

export function readRecentReports(shitennoDir: string): ReportSummary[] {
  const reportsDir = join(shitennoDir, "reports");
  if (!existsSync(reportsDir)) return [];

  const files = readdirSync(reportsDir)
    .filter((f) => f.startsWith("complexity-") && f.endsWith(".json"))
    .sort()
    .slice(-10);

  return files.map((file) => {
    try {
      const content = readFileSync(join(reportsDir, file), "utf-8");
      return JSON.parse(content) as ReportSummary;
    } catch {
      return null;
    }
  }).filter((r): r is ReportSummary => r !== null);
}

export function detectRecurringErrors(entries: HistoryEntry[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const violationsByArea = new Map<string, string[]>();

  for (const entry of entries) {
    if (entry.violations.length === 0) continue;
    const key = entry.areas.length > 0 ? (entry.areas[0] ?? "global") : "global";
    if (!violationsByArea.has(key)) violationsByArea.set(key, []);
    const existing = violationsByArea.get(key);
    if (existing) existing.push(`${entry.date} (${entry.filename}): ${entry.violations.join(", ")}`);
  }

  for (const [area, evidence] of violationsByArea) {
    if (evidence.length >= 3) {
      patterns.push({
        type: "recurring_error",
        description: `Erros recorrentes na area "${area}" — ${evidence.length} ocorrencias no historico`,
        occurrences: evidence.length,
        evidence,
        affectedArea: area,
        severity: Math.min(5, evidence.length),
      });
    }
  }
  return patterns;
}

export function detectRevertedDecisions(entries: HistoryEntry[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const revertKeywords = ["revert", "rollback", "desfazer", "voltar", "removido", "removida"];
  const revertEntries = entries.filter((entry) => {
    const lower = entry.content.toLowerCase();
    return revertKeywords.some((kw) => lower.includes(kw));
  });

  if (revertEntries.length >= 2) {
    patterns.push({
      type: "reverted_decision",
      description: `${revertEntries.length} decisoes revertidas/rollback no historico`,
      occurrences: revertEntries.length,
      evidence: revertEntries.map(
        (e) => `${e.date} (${e.filename}): ${e.violations.join(", ") || "rollback detected"}`
      ),
      affectedArea: "cross-cutting",
      severity: Math.min(5, revertEntries.length),
    });
  }
  return patterns;
}

export function detectHotAreas(reports: ReportSummary[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const areaScores = new Map<string, number[]>();

  for (const report of reports) {
    for (const area of report.areaScores || []) {
      if (!areaScores.has(area.area)) areaScores.set(area.area, []);
      areaScores.get(area.area)!.push(area.score);
    }
  }

  for (const [area, scores] of areaScores) {
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avgScore >= 6 && scores.length >= 2) {
      patterns.push({
        type: "hot_area",
        description: `Area "${area}" com score elevado consistente (media ${avgScore.toFixed(1)} em ${scores.length} relatorios)`,
        occurrences: scores.length,
        evidence: scores.map((s, i) => `Relatorio ${i + 1}: score ${s}`),
        affectedArea: area,
        severity: Math.min(5, Math.floor(avgScore / 2)),
      });
    }
  }
  return patterns;
}
