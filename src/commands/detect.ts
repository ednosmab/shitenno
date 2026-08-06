import { Command } from "commander";
import ora from "ora";
import { detectPatterns, writePatternReport, type PatternDetectionReport } from "../infrastructure/pattern-detector.js";
import { getCached, setCache, computeKeyChecksums } from "../infrastructure/cache.js";
import { outputJson, banner } from "../shared/formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared/shared.js";
import { getEventBus } from "../infrastructure/event-bus.js";
import { checkAndArchiveDonePlans } from "../application/plan-lifecycle.js";
import { output, outputBlank, outputError } from "../shared/output.js";
import { logger, muteLogs } from "../shared/logger.js";
import { handleApproveReject, recordCandidateRuleFeedback } from "./detect/rules.js";
import { outputHumanReadable, outputJsonReport, outputMarkdownReport } from "./detect/display.js";

function runDetection(projectRoot: string, shitennoDir: string, cacheEnabled: boolean): { report: PatternDetectionReport; reportFile: string | null; cacheHit: boolean } {
  let report: PatternDetectionReport;
  let cacheHit = false;
  if (cacheEnabled) {
    const cached = getCached<PatternDetectionReport>({ projectRoot, key: "patterns",
      computeChecksumsFn: () => computeKeyChecksums(projectRoot, shitennoDir) });
    if (cached) {
      report = cached;
      cacheHit = true;
    } else {
      report = detectPatterns(projectRoot, shitennoDir);
      setCache({ projectRoot, shitennoDir, key: "patterns", data: report,
        checksums: computeKeyChecksums(projectRoot, shitennoDir) });
    }
  } else {
    report = detectPatterns(projectRoot, shitennoDir);
  }
  const reportFile = writePatternReport(shitennoDir, report);
  return { report, reportFile, cacheHit };
}

function publishDetectionEvent(report: PatternDetectionReport): void {
  const avgConfidence = report.patterns.length > 0
    ? report.patterns.reduce((sum, p) => sum + (p.severity / 5), 0) / report.patterns.length
    : 0;
  getEventBus().publish("pattern.detected", {
    patternType: report.patterns[0]?.type ?? "unknown",
    confidence: avgConfidence,
    patterns: report.patterns.map((p) => ({
      type: p.type,
      description: p.description,
      severity: p.severity,
    })),
  });
}

function handleAutoPlanArchiving(shitennoDir: string): void {
  try {
    const result = checkAndArchiveDonePlans(shitennoDir);
    if (result.archived > 0) logger.error("detect", `[shugo detect --auto] Archived ${result.archived} plan(s): ${result.archivedIds.join(", ")}`);
  } catch (err) {
    logger.error("detect", `[shugo detect --auto] Plan archiving failed: ${err}`);
  }
}

function handleDetectionError(error: unknown, isJson: boolean, isAuto: boolean, spinner: ReturnType<typeof ora> | null): void {
  if (isJson) outputJson({ error: "detection_failed", message: String(error) });
  else if (!isAuto) { spinner?.fail("Pattern detection failed"); outputError(`Error: ${error}`); outputBlank(); }
}

function initializeDetection(
  options: { json?: boolean; auto?: boolean; format?: string; dir?: string; approve?: string; reject?: string },
) {
  const isJson = options.json === true;
  if (isJson) muteLogs();
  const isAuto = options.auto === true;
  const format = isJson ? "json" : String(options.format || "text");
  if (!isJson && !isAuto) { output(""); banner("shugo detect", "Pattern Detection"); outputBlank(); }
  const ctx = guardNotInitialized(options, isJson);
  if (!ctx) return null;
  if (!checkLifecycleGate("detect", ctx.projectRoot, ctx.shitennoDir, isJson)) return null;
  if (handleApproveReject(options, isJson, ctx.projectRoot, ctx.shitennoDir)) return null;
  if (isAuto) handleAutoPlanArchiving(ctx.shitennoDir);
  const spinner = isAuto ? null : ora("Analyzing history and reports...").start();
  return { ctx, isJson, isAuto, format, spinner };
}

export const detectCommand = new Command("detect")
  .description("Detect patterns in history and propose candidate rules (Phase 2)")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--no-cache", "Skip cache and recalculate")
  .option("--json", "Output results as JSON")
  .option("--format <type>", "Output format: text, json, or markdown (default: text)")
  .option("--approve <ruleId>", "Approve a candidate rule by ID")
  .option("--reject <ruleId>", "Reject a candidate rule by ID")
  .option("--auto", "Non-interactive mode for git hooks (suppresses banner and spinner)")
  .action(async (options) => {
    const init = initializeDetection(options);
    if (!init) return;
    const { ctx, isJson, isAuto, format, spinner } = init;
    try {
      const { report, reportFile, cacheHit } = runDetection(ctx.projectRoot, ctx.shitennoDir, options.cache !== false);
      if (!isJson && !isAuto) spinner?.succeed(`Analyzed ${report.historyEntriesAnalyzed} history entries, ${report.reportsAnalyzed} reports`);
      if (format === "json") { outputJsonReport(ctx.projectRoot, report, { cacheHit, reportFile }, ctx.shitennoDir); return; }
      if (format === "markdown") { outputMarkdownReport(report); return; }
      outputHumanReadable({ report, cacheHit, reportFile, shitennoDir: ctx.shitennoDir, projectRoot: ctx.projectRoot });
      publishDetectionEvent(report);
      recordCandidateRuleFeedback(report, ctx.shitennoDir);
    } catch (error) {
      handleDetectionError(error, isJson, isAuto, spinner);
    }
  });
