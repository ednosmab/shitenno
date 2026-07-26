/**
 * Audit types — Audit report definition
 */

import type { AuditLevel } from "./common.js";
import type { HealthIssue } from "./health-issue.js";
import type { GovernanceOptimization } from "./governance.js";

/** Relatório completo de auditoria de saúde. */
export interface HealthAuditReport {
  auditedAt: string;
  totalRules: number;
  historyEntries: number;
  sessionsAnalyzed: number;
  issues: HealthIssue[];
  suppressedIssues: Array<HealthIssue & { suppressionReason: string }>;
  optimizations: GovernanceOptimization[];
  healthScore: number;
  /** Health score per dimension (security, reliability, complexity, hygiene, coverage, governance). */
  dimensionScores: Record<string, number>;
  summary: string;
  level: AuditLevel;
  /** How long the audit took in milliseconds. */
  durationMs: number;
  /** Number of source files scanned. */
  filesScanned: number;
  /** List of detectors that were executed. */
  detectorsRun: string[];
  /** Whether only changed files were scanned (--changed mode). */
  changedFilesOnly?: boolean;
  /** Total files in project (when changedFilesOnly is true). */
  totalFiles?: number;
  /** Detectors that threw exceptions during execution. */
  detectorErrors?: Array<{ name: string; error: string }>;
}
