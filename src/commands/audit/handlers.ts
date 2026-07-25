/**
 * commands/audit/handlers.ts — Audit command handlers
 *
 * Extracted from commands/audit.ts to keep modules focused.
 */

import chalk from "chalk";
import ora from "ora";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { auditHealth, type HealthAuditReport, type AuditLevel } from "../../health-auditor.js";
import { getCached, computeKeyChecksums } from "../../cache.js";
import { output, outputBlank } from "../../output.js";
import { appendBacklogSection, issueToBacklogItem, type BacklogItem } from "../../backlog-writer.js";
import { resolveBacklogPaths } from "../../backlog-core.js";
import { getChangedFiles } from "../../audit/changed-files.js";
import { loadGrowthProfile } from "../../growth-profile.js";
import { checkBuild, checkTests, checkLint } from "../../plan-lifecycle.js";
import { loadSuppressions } from "../../audit/suppression.js";
import { issueFingerprint } from "../../health-auditor.js";
import { displayIssueCounts, displayKnowledgeGraph } from "./display.js";
import { buildIssueCounts } from "./display.js";
import { collectSemanticData } from "./semantic-display.js";
import { outputJson } from "../../formatting.js";
import type { AutofixReport as AutofixReportType } from "../../audit/autofix-engine.js";
import type { AuditActionCtx } from "./types.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface HumanPostAuditInput {
  report: HealthAuditReport;
  graphAnalysis: { totalArtifacts: number; totalRelations: number; healthScore: number;
    orphanArtifacts: Array<{ name: string; type: string }>;
    hubArtifacts: Array<{ artifact: { name: string }; connectionCount: number }>;
    suggestions: string[];
  };
  ctx: AuditActionCtx;
  cacheHit: boolean;
  reportFile: string | null;
  options: { showSuppressed?: boolean; autoBacklog?: boolean };
  growthProfile: ReturnType<typeof loadGrowthProfile>;
}

export interface JsonOutputInput {
  report: HealthAuditReport;
  graphAnalysis: { totalArtifacts: number; totalRelations: number; healthScore: number;
    orphanArtifacts: { length: number }; hubArtifacts: { length: number }; suggestions: string[];
  };
  options: { apply?: boolean; dryRun?: boolean }; ctx: AuditActionCtx; cacheHit: boolean; reportFile: string | null;
  growthProfile: { growthCapacity?: number; challengeLevel?: number; patterns: Array<{ type: string }>; pathHistory: unknown[] };
}

// ── Auto-Backlog ────────────────────────────────────────────────────────────

export function handleAutoBacklog(
  report: HealthAuditReport,
  graphAnalysis: { orphanArtifacts: Array<{ name: string; type: string }> },
  ctx: { shitennoDir: string; projectRoot: string },
  isJson: boolean,
): void {
  const today = new Date().toISOString().slice(0, 10);
  const backlogItems: BacklogItem[] = [];

  report.issues.forEach((issue, idx) => {
    backlogItems.push(issueToBacklogItem(issue, today, "SA", idx + 1));
  });

  if (graphAnalysis.orphanArtifacts.length > 0) {
    backlogItems.push({
      id: `SA${backlogItems.length + 1}`,
      title: `${graphAnalysis.orphanArtifacts.length} artifacts orfaos no knowledge graph`,
      severity: "Alto", priority: "P1", source: "shugo audit", date: today,
      modules: ["shitenno/"],
      description: `${graphAnalysis.orphanArtifacts.length} artifacts no knowledge graph sem relacoes conectando-os.`,
      correction: "Adicionar relacoes entre artifacts orfaos e existentes.",
      state: "planeado", owner: "unassigned", line: 0, filePath: "", format: "modular",
    });
  }

  if (backlogItems.length === 0) return;
  const { active: backlogPath } = resolveBacklogPaths(ctx.shitennoDir);
  const result = appendBacklogSection(backlogPath, backlogItems, today);
  if (!isJson) {
    output(chalk.bold("  📋 Auto-backlog:"));
    output(chalk.green(`    ✔ ${result.itemsAdded} item(s) adicionado(s) ao backlog`));
    if (result.itemsSkipped > 0) {
      output(chalk.gray(`    ⊘ ${result.itemsSkipped} item(s) duplicado(s) ignorado(s)`));
    }
    outputBlank();
  }
}

// ── Changed Files ───────────────────────────────────────────────────────────

export function handleChangedFiles(options: { changed?: string | boolean }, ctx: AuditActionCtx, isJson: boolean): string[] | undefined {
  if (!options.changed) return undefined;
  const baseBranch = typeof options.changed === "string" ? options.changed : "main";
  const changedResult = getChangedFiles(ctx.projectRoot, baseBranch);
  if (!changedResult.isGitRepo) {
    if (!isJson) { output(chalk.yellow("  ⚠ Not a git repository — falling back to full scan.")); outputBlank(); }
    return undefined;
  }
  if (changedResult.fallbackToFull) {
    if (!isJson) { output(chalk.yellow(`  ⚠ Base branch '${baseBranch}' not found — falling back to full scan.`)); outputBlank(); }
    return undefined;
  }
  if (changedResult.files.length === 0) {
    if (!isJson) { output(chalk.green("  ✔ No changed files detected since " + baseBranch + ". Nothing to audit.")); outputBlank(); }
    throw new Error("no-changes");
  }
  if (!isJson) { output(chalk.gray(`  📁 Scanning ${changedResult.files.length} changed file(s) since ${baseBranch}...`)); outputBlank(); }
  return changedResult.files;
}

// ── Full Sweep ──────────────────────────────────────────────────────────────

export function handleFullSweep(options: { fullSweep?: boolean }, ctx: AuditActionCtx, isJson: boolean): void {
  if (!options.fullSweep) return;
  if (process.env.SHITENNO_CHILD === "1") {
    console.error("Erro: --full-sweep não pode ser usado por processo automatizado (daemon/CI). Rode manualmente.");
    process.exitCode = 1;
    throw new Error("exit");
  }
  const sweepSpinner = isJson ? null : ora("Rodando verify:all (build + test + lint) antes da varredura...").start();
  const checks = [checkBuild(ctx.projectRoot), checkTests(ctx.projectRoot), checkLint(ctx.projectRoot)];
  const passed = checks.every((c) => c.passed);
  let commitHash = "unknown";
  try { commitHash = execSync("git rev-parse HEAD", { cwd: ctx.projectRoot, encoding: "utf-8", timeout: 5000 }).trim(); } catch { /* not in a git repo or git unavailable */ }
  const record = { commitHash, checks, passed, timestamp: new Date().toISOString() };
  writeFileSync(join(ctx.shitennoDir, "governance", "last-verify.json"), JSON.stringify(record, null, 2), "utf-8");
  if (sweepSpinner) {
    if (record.passed) sweepSpinner.succeed("verify:all passou");
    else sweepSpinner.fail(`verify:all falhou: ${record.checks.filter((c) => !c.passed).map((c) => c.name).join(", ")}`);
  }
}

// ── Audit Report Fetch ──────────────────────────────────────────────────────

export function fetchAuditReport(
  options: { cache?: boolean; level: string },
  ctx: AuditActionCtx,
  level: string,
  changedFiles: string[] | undefined,
): Promise<{ report: HealthAuditReport; cacheHit: boolean }> {
  if (options.cache !== false && level !== "code-review" && level !== "enterprise") {
    const cached = getCached<HealthAuditReport>({ projectRoot: ctx.projectRoot, key: "health", computeChecksumsFn: () => computeKeyChecksums(ctx.projectRoot, ctx.shitennoDir) });
    if (cached) return Promise.resolve({ report: cached, cacheHit: true });
  }
  return auditHealth(ctx.projectRoot, ctx.shitennoDir, level as AuditLevel, changedFiles).then((report) => ({ report, cacheHit: false }));
}

// ── Audit Execution ─────────────────────────────────────────────────────────

export function runAuditExecution(
  options: { level: string; minConfidence?: number; changed?: string | boolean; fullSweep?: boolean },
  ctx: AuditActionCtx,
  isJson: boolean,
): Promise<{ report: HealthAuditReport; cacheHit: boolean; growthProfile: ReturnType<typeof loadGrowthProfile> } | null> {
  return (async () => {
    const level = resolveAuditLevel(options.level);
    let changedFiles: string[] | undefined;
    try {
      changedFiles = handleChangedFiles(options, ctx, isJson);
    } catch {
      return null;
    }
    handleFullSweep(options, ctx, isJson);
    const growthProfile = loadGrowthProfile(ctx.shitennoDir);
    const { report: initialReport, cacheHit } = await fetchAuditReport(options, ctx, level, changedFiles);
    const report = applyMinConfidenceFilter(initialReport, options.minConfidence);
    return { report, cacheHit, growthProfile };
  })();
}

// ── Human Post-Audit Display ────────────────────────────────────────────────

export async function displayHumanPostAudit(input: HumanPostAuditInput): Promise<void> {
  const { report, graphAnalysis, ctx, cacheHit, reportFile, options, growthProfile } = input;
  const { displayHumanAuditReport, displayDynamicRules, displaySemanticAudit, displaySuppressedIssues } = await import("./display.js");
  displayHumanAuditReport({ report, graphAnalysis, ctx, isJson: false, cacheHit, reportFile });
  await displayDynamicRules(ctx.projectRoot, ctx.shitennoDir);
  output(chalk.bold("  📝 Summary:"));
  output(chalk.gray(`    ${report.summary}`));
  outputBlank();
  if (options.showSuppressed && report.suppressedIssues.length > 0) {
    displaySuppressedIssues(report.suppressedIssues);
  }
  const { formatGrowthProgress } = await import("../../dual-path-presenter.js");
  output(formatGrowthProgress(growthProfile));
  outputBlank();
  displaySemanticAudit(ctx.projectRoot, ctx.shitennoDir);
  const { getEventBus } = await import("../../event-bus.js");
  getEventBus().publish("health.checked", {
    status: resolveHealthStatus(report.healthScore),
    healthScore: report.healthScore,
    dimensionScores: report.dimensionScores,
    issues: report.issues.map((i) => i.description),
    checksRun: report.totalRules,
  });
  if (options.autoBacklog) handleAutoBacklog(report, graphAnalysis, ctx, false);
  await displayCustomCheckResults(ctx, report);
}

// ── JSON Output ─────────────────────────────────────────────────────────────

export async function handleJsonOutput(input: JsonOutputInput): Promise<void> {
  const { report, graphAnalysis, options, ctx, cacheHit, reportFile, growthProfile } = input;
  const { generateFixSuggestions, prioritizeSuggestions } = await import("../../audit/suggestion-engine.js");
  const { applyAllFixes } = await import("../../audit/autofix-engine.js");
  const { runPolicyGate } = await import("../../decision-core/invoke.js");
  let autofixReportJson: AutofixReportType | undefined;
  if (options.apply && report.issues.length > 0) {
    const suggestions = generateFixSuggestions(report.issues as Parameters<typeof generateFixSuggestions>[0], []);
    const prioritized = prioritizeSuggestions(suggestions);
    if (prioritized.length > 0) {
      const policyBlockJson = runPolicyGate(
        { type: "apply_autofix", params: { suggestionCount: prioritized.length } },
        { trigger: "manual", eventData: {}, projectRoot: ctx.projectRoot, shitennoDir: ctx.shitennoDir, timestamp: new Date().toISOString() }
      );
      if (!policyBlockJson) autofixReportJson = applyAllFixes(prioritized, ctx.projectRoot, { dryRun: options.dryRun === true });
    }
  }
  const issueCounts = buildIssueCounts(report.issues);
  outputJson({ projectRoot: ctx.projectRoot, level: report.level, healthScore: report.healthScore, dimensionScores: report.dimensionScores,
    totalRules: report.totalRules, historyEntries: report.historyEntries, sessionsAnalyzed: report.sessionsAnalyzed,
    filesScanned: report.filesScanned, detectorsRun: report.detectorsRun, durationMs: report.durationMs,
    issues: report.issues, suppressedIssues: report.suppressedIssues, autofixReport: autofixReportJson ?? null,
    issueCounts, optimizations: report.optimizations, summary: report.summary,
    knowledgeGraph: { totalArtifacts: graphAnalysis.totalArtifacts, totalRelations: graphAnalysis.totalRelations,
      healthScore: graphAnalysis.healthScore, orphanCount: graphAnalysis.orphanArtifacts.length,
      hubCount: graphAnalysis.hubArtifacts.length, suggestions: graphAnalysis.suggestions },
    cacheHit, reportFile: reportFile || null, auditedAt: report.auditedAt,
    growthProfile: { growthCapacity: growthProfile.growthCapacity, challengeLevel: growthProfile.challengeLevel,
      pattern: growthProfile.patterns[0]?.type || "balanced", totalChoices: growthProfile.pathHistory.length },
    semantic: collectSemanticData(ctx.projectRoot, ctx.shitennoDir) });
}

// ── Custom Check Results ────────────────────────────────────────────────────

async function displayCustomCheckResults(ctx: AuditActionCtx, report: HealthAuditReport): Promise<void> {
  const { getHookBus } = await import("../../plugin-system.js");
  const hookBus = getHookBus();
  const customResults = await hookBus.collectHook("custom-check", async (plugin) => {
    if (plugin.hooks?.["custom-check"]) return await plugin.hooks["custom-check"]({ projectRoot: ctx.projectRoot, shitennoDir: ctx.shitennoDir, healthReport: report });
    return null;
  });
  if (customResults.length === 0) return;
  output(chalk.bold("  🔌 Custom Checks:"));
  for (const result of customResults) {
    if (result) output(chalk.gray(`    ${result}`));
  }
  outputBlank();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function resolveHealthStatus(healthScore: number): string {
  if (healthScore >= 70) return "healthy";
  if (healthScore >= 40) return "degraded";
  return "critical";
}

function resolveAuditLevel(level: string): string {
  if (["quick", "standard", "code-review", "enterprise"].includes(level)) return level;
  return "standard";
}

function applyMinConfidenceFilter(report: HealthAuditReport, minConfidence: number | undefined): HealthAuditReport {
  if (minConfidence === undefined || minConfidence < 0 || minConfidence > 1) return report;
  return { ...report, issues: report.issues.filter((i) => (i.confidence ?? 1.0) >= minConfidence) };
}
