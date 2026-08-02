/**
 * health-auditor.ts — Thin orchestrator for health audit
 *
 * Detector registry split into audit/detector-map.ts.
 * All types, constants, shared utilities, detectors in audit/*.
 */

import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.js";

export type { AuditLevel, HealthIssue, GovernanceOptimization, HealthAuditReport, SourceFileInfo } from "./audit/types.js";
export { collectSourceFiles, issueFingerprint } from "./audit/shared.js";

export {
  detectHardcodedSecrets,
  detectSQLInjection,
  detectXSS,
  detectUnsafeEval,
  detectConsoleSecrets,
  detectWeakCrypto,
  detectInsecureHTTP,
  detectPrototypePollution,
  detectPathTraversal,
  detectRegexDos,
  detectUnsafeDeserialization,
  detectDependencyConfusion,
  detectCircularDeps,
} from "./audit/engineering-detectors.js";

import type { AuditLevel, HealthIssue, HealthAuditReport } from "./audit/types.js";
import { DETECTORS_BY_LEVEL, CROSS_FILE_ONLY_DETECTORS } from "./audit/constants.js";
import { collectSourceFiles, readHistory, readRules, deduplicateIssues } from "./audit/shared.js";
import { calculateHealthScore, calculateDimensionScores } from "./audit/health-score.js";
import { proposeOptimizations } from "./audit/optimization-proposer.js";
import { buildDetectorMap } from "./audit/detector-map.js";
import { loadSuppressions, applySuppressions } from "./audit/suppression.js";
import { FRONTEND_DETECTOR_SCOPE } from "./audit/frontend-detector-scope.js";

export async function auditHealth(
  projectRoot: string,
  shitennoDir: string,
  level: AuditLevel = "standard",
  changedFiles?: string[]
): Promise<HealthAuditReport> {
  const startTime = Date.now();
  const history = readHistory(shitennoDir);
  const rules = readRules(shitennoDir);
  const activeDetectors = new Set(DETECTORS_BY_LEVEL[level]);
  const allSourceFiles = collectSourceFiles(projectRoot);

  // Filter source files if changedFiles is provided (--changed mode)
  const sourceFiles = changedFiles && changedFiles.length > 0
    ? allSourceFiles.filter((f) => changedFiles.includes(f.relPath))
    : allSourceFiles;

  const detectorMap = buildDetectorMap({ projectRoot, shitennoDir, sourceFiles, rules, history });

  const isAuditingShitennoItself = existsSync(join(projectRoot, ".shitenno-self"));
  const { issues, detectorErrors } = await executeDetectors(detectorMap, activeDetectors, changedFiles, isAuditingShitennoItself);

  const deduped = deduplicateIssues(issues);
  const suppressions = loadSuppressions(shitennoDir);
  const { visible, suppressed } = applySuppressions(deduped, suppressions);
  const healthScore = calculateHealthScore(visible, sourceFiles.length);
  const dimensionScores = calculateDimensionScores(visible, sourceFiles.length);
  const optimizations = proposeOptimizations(visible);

  const summary = buildAuditSummary({ healthScore, level, activeDetectorCount: activeDetectors.size, rules, history, visible, suppressed, optimizations });
  const durationMs = Date.now() - startTime;

  return {
    auditedAt: new Date().toISOString(),
    totalRules: rules.length,
    historyEntries: history.length,
    sessionsAnalyzed: history.length,
    issues: visible,
    suppressedIssues: suppressed,
    optimizations,
    healthScore,
    dimensionScores,
    summary,
    level,
    durationMs,
    filesScanned: sourceFiles.length,
    detectorsRun: Array.from(activeDetectors),
    ...(detectorErrors.length > 0 ? { detectorErrors } : {}),
    ...(changedFiles && changedFiles.length > 0 ? { changedFilesOnly: true, totalFiles: allSourceFiles.length } : {}),
  };
}

export function writeHealthReport(shitennoDir: string, report: HealthAuditReport): string | null {
  const reportsDir = join(shitennoDir, "reports");
  if (!existsSync(reportsDir)) return null;

  const date = new Date().toISOString().slice(0, 10);
  const filename = `health-${date}.json`;
  const filepath = join(reportsDir, filename);

  try {
    writeFileSync(filepath, JSON.stringify(report, null, 2), "utf-8");
    return filename;
  } catch {
    return null;
  }
}

async function executeDetectors(
  detectorMap: Record<string, () => HealthIssue[] | Promise<HealthIssue[]>>,
  activeDetectors: Set<string>,
  changedFiles: string[] | undefined,
  isAuditingShitennoItself: boolean,
): Promise<{ issues: HealthIssue[]; detectorErrors: Array<{ name: string; error: string }> }> {
  const issues: HealthIssue[] = [];
  const detectorErrors: Array<{ name: string; error: string }> = [];
  const detectorResults: Array<HealthIssue[] | Promise<HealthIssue[]>> = [];

  for (const [name, fn] of Object.entries(detectorMap)) {
    if (!activeDetectors.has(name)) continue;
    if (changedFiles && changedFiles.length > 0 && CROSS_FILE_ONLY_DETECTORS.has(name)) continue;
    const scope = FRONTEND_DETECTOR_SCOPE[name];
    if (scope === "shitenno-self-only" && !isAuditingShitennoItself) continue;

    try {
      detectorResults.push(fn());
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      detectorErrors.push({ name, error: errorMsg });
      logger.warn("health-auditor", `Detector "${name}" failed: ${errorMsg}`);
    }
  }

  const resolvedResults = await Promise.all(detectorResults);
  for (const result of resolvedResults) {
    issues.push(...result);
  }

  for (const { name, error } of detectorErrors) {
    issues.push({
      type: "detector_failure",
      severity: 2,
      description: `Detector "${name}" failed to run: ${error}`,
      location: `src/audit/ (detector: ${name})`,
      recommendation: `Investigate and fix detector "${name}" — results for this category may be incomplete in this run`,
      confidence: 1.0,
    });
  }

  return { issues, detectorErrors };
}

interface AuditSummaryInput {
  healthScore: number;
  level: AuditLevel;
  activeDetectorCount: number;
  rules: ReturnType<typeof readRules>;
  history: ReturnType<typeof readHistory>;
  visible: HealthIssue[];
  suppressed: HealthIssue[];
  optimizations: ReturnType<typeof proposeOptimizations>;
}

function buildAuditSummary(input: AuditSummaryInput): string {
  const critical = input.visible.filter((i) => i.severity === 3).length;
  const warnings = input.visible.filter((i) => i.severity === 2).length;
  const info = input.visible.filter((i) => i.severity === 1).length;

  const parts: string[] = [];
  parts.push(`Score de saúde: ${input.healthScore}/100`);
  parts.push(`Nível: ${input.level} (${input.activeDetectorCount} detectors).`);
  parts.push(`${input.rules.length} regras, ${input.history.length} sessões analisadas.`);
  if (critical > 0) parts.push(`${critical} crítico(s).`);
  if (warnings > 0) parts.push(`${warnings} aviso(s).`);
  if (info > 0) parts.push(`${info} info.`);
  if (input.suppressed.length > 0) parts.push(`${input.suppressed.length} suprimido(s).`);
  if (input.optimizations.length > 0) parts.push(`${input.optimizations.length} optimização(ões) proposta(s).`);

  return parts.join(" ");
}
