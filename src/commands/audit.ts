/**
 * commands/audit.ts — Audit command (thin orchestrator)
 *
 * Implementation details extracted into:
 * - audit/display.ts: all display* functions, issue counts, semantic display
 * - audit/handlers.ts: handleAutoBacklog, handleChangedFiles, handleFullSweep, JSON output
 * - audit/reporter.ts: categorizeIssues, groupByType, formatTypeGroup (existing)
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { join } from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import { writeHealthReport, issueFingerprint, type HealthAuditReport } from "../application/health-auditor.js";
import { outputJson, banner } from "../shared/formatting.js";
import { output, outputBlank } from "../shared/output.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared/shared.js";
import { getEventBus } from "../infrastructure/event-bus.js";
import { discoverArtifacts, discoverRelations, analyzeGraph, saveArtifacts, saveRelations } from "../infrastructure/knowledge-graph.js";
import { muteLogs } from "../shared/logger.js";
import { loadSuppressions, addSuppression } from "../audit/suppression.js";

import { printDaemonBanner } from "../interface/cli/daemon-context-banner.js";
import { displayWhatWasMeasured } from "./audit/display.js";
import { runAuditExecution, handleJsonOutput, displayHumanPostAudit } from "./audit/handlers.js";


// ── Subcommand: audit suppress ───────────────────────────────────────────────

function findIssueInReports(
  reportsDir: string,
  fingerprint: string,
): { type: string; location: string; description: string } | null {
  try {
    const files = readdirSync(reportsDir)
      .filter((f: string) => f.startsWith("health-") && f.endsWith(".json"))
      .sort()
      .reverse();
    for (const f of files) {
      const reportPath = join(reportsDir, f);
      const reportData: HealthAuditReport = JSON.parse(readFileSync(reportPath, "utf-8"));
      const match = reportData.issues.find((i) => issueFingerprint(i) === fingerprint);
      if (match) return match;
      const suppressedMatch = reportData.suppressedIssues?.find((i) => issueFingerprint(i) === fingerprint);
      if (suppressedMatch) return suppressedMatch;
    }
  } catch { /* reports dir may not exist */ }
  return null;
}

export const auditSuppressCommand = new Command("suppress")
  .description("Suppress a specific audit issue by fingerprint")
  .argument("<fingerprint>", "Issue fingerprint (10-char hex from audit output)")
  .requiredOption("--reason <text>", "Reason for suppression (required)")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .action(async (fingerprint: string, options) => {
    const ctx = guardNotInitialized(options, false);
    if (!ctx) return;

    void printDaemonBanner(ctx.shitennoDir, false);

    const suppressions = loadSuppressions(ctx.shitennoDir);
    const existing = suppressions.find((s) => s.fingerprint === fingerprint);
    if (existing) {
      output(chalk.yellow(`  ⚠ Issue ${fingerprint} is already suppressed.`));
      output(chalk.gray(`    Reason: ${existing.reason}`));
      output(chalk.gray(`    Suppressed at: ${existing.suppressedAt}`));
      return;
    }

    const foundIssue = await findIssueInReports(join(ctx.shitennoDir, "reports"), fingerprint);
    if (!foundIssue) {
      output(chalk.red(`  ✘ Issue ${fingerprint} not found in any recent report.`));
      output(chalk.gray("    Run 'shugo audit --json' first to see available fingerprints."));
      return;
    }

    addSuppression(ctx.shitennoDir, foundIssue as import("../audit/types.js").HealthIssue, options.reason, "user");
    output(chalk.green(`  ✔ Issue ${fingerprint} suppressed successfully.`));
    output(chalk.gray(`    Type: ${foundIssue.type}`));
    output(chalk.gray(`    Location: ${foundIssue.location}`));
    output(chalk.gray(`    Reason: ${options.reason}`));
    output(chalk.gray("    The issue will not appear in future audits."));
    output(chalk.gray("    Use 'shugo audit --show-suppressed' to review suppressed issues."));
  });

// ── Helpers ─────────────────────────────────────────────────────────────────

function resolveLevelLabel(level: string): string {
  if (level === "enterprise") return "enterprise";
  if (level === "code-review") return "code-review";
  if (level === "quick") return "quick";
  return "standard";
}

function initializeAuditOutput(isJson: boolean, options: { level: string }): void {
  if (isJson) { muteLogs(); return; }
  outputBlank();
  banner("shugo audit", "Health Audit");
  output(chalk.gray(`    Level: ${resolveLevelLabel(options.level)}`));
  outputBlank();
}

function handleAuditError(error: unknown, isJson: boolean, spinner: ReturnType<typeof ora> | null): void {
  if (isJson) { outputJson({ error: "audit_failed", message: String(error) }); return; }
  if (spinner) spinner.fail("Health audit failed");
  output(chalk.red(`  Error: ${error}`));
  outputBlank();
}

// ── Main audit command ───────────────────────────────────────────────────────

export const auditCommand = new Command("audit")
  .description("Audit Shitenno health (Phase 3)")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("-l, --level <level>", "Audit level: quick, standard, code-review, enterprise (default: standard)", "standard")
  .option("--no-cache", "Skip cache and recalculate")
  .option("--json", "Output results as JSON")
  .option("--auto-backlog", "Auto-detect gaps and add to BACKLOG.md")
  .option("--min-confidence <0..1>", "Filter issues below this confidence threshold", parseFloat)
  .option("--show-suppressed", "Show suppressed issues with reasons")
  .option("--apply", "Apply high-confidence fixes automatically (with verification and rollback)")
  .option("--dry-run", "Simulate --apply without writing changes (use with --apply)")
  .option("--changed [base]", "Audit only files changed since base branch (default: main)")
  .option("--full-sweep", "Roda verify:all (build+test+lint) antes da varredura, não só lê o status salvo — pode levar minutos")
  .addCommand(auditSuppressCommand)
  .action(async (options) => {
    const isJson = options.json === true;
    initializeAuditOutput(isJson, options);
    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;
    void printDaemonBanner(ctx.shitennoDir, isJson);
    if (!checkLifecycleGate("audit", ctx.projectRoot, ctx.shitennoDir, isJson)) return;
    const spinner = isJson ? null : ora("Auditing governance health...").start();
    try {
      const executionResult = await runAuditExecution(options, ctx, isJson);
      if (!executionResult) return;
      const { report, cacheHit, growthProfile } = executionResult;
      const reportFile = writeHealthReport(ctx.shitennoDir, report);
      const artifacts = discoverArtifacts(ctx.shitennoDir);
      const relations = discoverRelations(artifacts);
      saveArtifacts(ctx.shitennoDir, artifacts);
      saveRelations(ctx.shitennoDir, relations);
      const graphAnalysis = analyzeGraph(artifacts, relations);
      getEventBus().publish("knowledge.analyzed", { totalArtifacts: graphAnalysis.totalArtifacts, totalRelations: graphAnalysis.totalRelations, healthScore: graphAnalysis.healthScore });
      if (spinner) spinner.succeed(`Audit complete — code health: ${report.healthScore}/100`);
      if (isJson) {
        await handleJsonOutput({ report, graphAnalysis, options, ctx, cacheHit, reportFile, growthProfile });
        return;
      }
      displayWhatWasMeasured(report);
      await displayHumanPostAudit({ report, graphAnalysis, ctx, cacheHit, reportFile, options, growthProfile });
    } catch (error) {
      handleAuditError(error, isJson, spinner);
    }
  });
