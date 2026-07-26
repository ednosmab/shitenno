/**
 * cost.ts — Tech Debt Cost Quantification Detectors
 *
 * Calculates tech debt cost, TDR, remediation effort, and ROI of refactoring.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { HealthIssue, SourceFileInfo } from "../types.js";

// ── Constants for calculation ────────────────────────────────────────────────

const HOURS_PER_SEVERITY: Record<number, number> = {
  1: 1,   // Low: ~1 hour
  2: 4,   // Medium: ~4 hours
  3: 8,   // High: ~8 hours
};

const DEFAULT_DEVELOPER_COST_PER_HOUR = 50; // USD

// ── 31.1 Tech Debt Cost ─────────────────────────────────────────────────────

export function detectTechDebtCost(
  _projectRoot: string,
  _files: SourceFileInfo[],
  existingIssues: HealthIssue[] = [],
): HealthIssue[] {
  const issues: HealthIssue[] = [];

  if (existingIssues.length === 0) return issues;

  const totalHours = existingIssues.reduce(
    (sum, issue) => sum + (HOURS_PER_SEVERITY[issue.severity] || 1),
    0,
  );

  const totalCost = totalHours * DEFAULT_DEVELOPER_COST_PER_HOUR;

  if (totalCost > 1000) {
    issues.push({
      type: "tech_debt_cost",
      severity: totalCost > 10000 ? 3 : 2,
      description: `Custo estimado de dívida técnica: $${totalCost.toLocaleString()} (${totalHours}h × $${DEFAULT_DEVELOPER_COST_PER_HOUR}/h)`,
      location: "project-wide",
      recommendation: "Priorizar correção dos issues de maior severidade para reduzir custo.",
      confidence: 0.85,
    });
  }

  return issues;
}

// ── 31.2 Technical Debt Ratio ───────────────────────────────────────────────

export function detectTDR(
  projectRoot: string,
  _files: SourceFileInfo[],
  existingIssues: HealthIssue[] = [],
): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const packageJsonPath = join(projectRoot, "package.json");
  if (!existsSync(packageJsonPath)) return issues;

  const projectValue = 50000; // Estimate: $50k project value

  const totalHours = existingIssues.reduce(
    (sum, issue) => sum + (HOURS_PER_SEVERITY[issue.severity] || 1),
    0,
  );

  const fixCost = totalHours * DEFAULT_DEVELOPER_COST_PER_HOUR;
  const tdr = (fixCost / projectValue) * 100;

  if (tdr > 10) {
    issues.push({
      type: "high_tdr",
      severity: tdr > 30 ? 3 : 2,
      description: `Technical Debt Ratio elevado: ${tdr.toFixed(1)}% (custo correção / valor projeto)`,
      location: "project-wide",
      recommendation: "TDR > 10% indica dívida técnica significativa. Priorizar redução.",
      confidence: 0.85,
    });
  }

  return issues;
}

// ── 31.3 Remediation Effort ─────────────────────────────────────────────────

export function detectRemediationEffort(
  _projectRoot: string,
  _files: SourceFileInfo[],
  existingIssues: HealthIssue[] = [],
): HealthIssue[] {
  const issues: HealthIssue[] = [];

  if (existingIssues.length === 0) return issues;

  const effortBySeverity = {
    low: existingIssues.filter((i) => i.severity === 1).length * (HOURS_PER_SEVERITY[1] || 1),
    medium: existingIssues.filter((i) => i.severity === 2).length * (HOURS_PER_SEVERITY[2] || 4),
    high: existingIssues.filter((i) => i.severity === 3).length * (HOURS_PER_SEVERITY[3] || 8),
  };

  const totalHours = effortBySeverity.low + effortBySeverity.medium + effortBySeverity.high;

  if (totalHours > 40) {
    issues.push({
      type: "high_remediation_effort",
      severity: totalHours > 100 ? 3 : 2,
      description: `Esforço de remediação estimado: ${totalHours}h (low: ${effortBySeverity.low}h, med: ${effortBySeverity.medium}h, high: ${effortBySeverity.high}h)`,
      location: "project-wide",
      recommendation: "Considerar sprint dedicado para redução de dívida técnica.",
      confidence: 0.85,
    });
  }

  return issues;
}

// ── 31.7 ROI Refactoring ────────────────────────────────────────────────────

export function detectROIRefactoring(
  _projectRoot: string,
  _files: SourceFileInfo[],
  existingIssues: HealthIssue[] = [],
): HealthIssue[] {
  const issues: HealthIssue[] = [];

  if (existingIssues.length === 0) return issues;

  const highSeverityIssues = existingIssues.filter((i) => i.severity === 3);
  const refactoringCost = highSeverityIssues.length * 8 * DEFAULT_DEVELOPER_COST_PER_HOUR;
  const maintenanceReduction = existingIssues.length * 2 * DEFAULT_DEVELOPER_COST_PER_HOUR;

  const roi = refactoringCost > 0 ? ((maintenanceReduction - refactoringCost) / refactoringCost) * 100 : 0;

  if (roi < 50 && highSeverityIssues.length > 3) {
    issues.push({
      type: "low_roi_refactoring",
      severity: 1,
      description: `ROI de refatoração baixo: ${roi.toFixed(0)}% (custo: $${refactoringCost}, economia: $${maintenanceReduction})`,
      location: "project-wide",
      recommendation: "Considerar refatoração incremental em vez de grande refactor.",
      confidence: 0.85,
    });
  }

  return issues;
}
