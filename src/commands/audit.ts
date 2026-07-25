import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { join } from "node:path";
import { auditHealth, writeHealthReport, type HealthAuditReport, type AuditLevel, issueFingerprint } from "../health-auditor.js";
import { getCached, computeKeyChecksums } from "../cache.js";
import { healthBar, outputJson, banner } from "../formatting.js";
import { output, outputBlank } from "../output.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { getHookBus } from "../plugin-system.js";
import { printDaemonBanner } from "../daemon-context-banner.js";
import { discoverArtifacts, discoverRelations, analyzeGraph, saveArtifacts, saveRelations } from "../knowledge-graph.js";
import { appendBacklogSection, issueToBacklogItem, type BacklogItem } from "../backlog-writer.js";
import { resolveBacklogPaths } from "../backlog-core.js";
import { loadGrowthProfile } from "../growth-profile.js";
import { formatGrowthProgress } from "../dual-path-presenter.js";
import { generateFixSuggestions, prioritizeSuggestions } from "../audit/suggestion-engine.js";
import { muteLogs, logger } from "../logger.js";
import { loadSuppressions, addSuppression } from "../audit/suppression.js";
import { applyAllFixes, type AutofixReport } from "../audit/autofix-engine.js";
import { getChangedFiles } from "../audit/changed-files.js";
import { runPolicyGate } from "../decision-core/invoke.js";
import { dimensionIcon, dimensionLabel, type AuditDimension } from "../audit/dimensions.js";
import { categorizeIssues, groupByType, formatTypeGroup, groupOptimizationsByAction, identifyQuickWins } from "./audit/reporter.js";
import { checkBuild, checkTests, checkLint } from "../plan-lifecycle.js";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
// Semantic layer imports
import { runSemanticAnalysis } from "../semantic/index.js";

// ── Subcommand: audit suppress ───────────────────────────────────────────────

async function findIssueInReports(
  reportsDir: string,
  fingerprint: string,
): Promise<{ type: string; location: string; description: string } | null> {
  try {
    const { readdirSync, readFileSync: fsReadFileSync } = await import("node:fs");
    const files = readdirSync(reportsDir)
      .filter((f: string) => f.startsWith("health-") && f.endsWith(".json"))
      .sort()
      .reverse();
    for (const f of files) {
      const reportPath = join(reportsDir, f);
      const reportData: HealthAuditReport = JSON.parse(fsReadFileSync(reportPath, "utf-8"));
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

interface IssueCategoryInput { title: string; issues: Array<{ description: string; location: string; recommendation: string }>;
  icon: string; color: typeof chalk; limit?: number; }

function displayIssueCategory(input: IssueCategoryInput): void {
  const { title, issues, icon, color, limit = 5 } = input;
  if (issues.length === 0) return;
  output(chalk.bold(`  ${icon} ${title}:`));
  outputBlank();
  for (const issue of issues.slice(0, limit)) {
    output(`    ${color(`[${title.toUpperCase()}]`)} ${issue.description}`);
    output(chalk.gray(`       Location: ${issue.location}`));
    output(chalk.gray(`       Fix: ${issue.recommendation}`));
    outputBlank();
  }
  if (issues.length > limit) {
    output(chalk.gray(`    ... and ${issues.length - limit} more ${title.toLowerCase()}`));
    outputBlank();
  }
}

function displayOptimizations(optimizations: Array<{ action: string }>): void {
  if (optimizations.length === 0) return;
  output(chalk.bold("  🔧 Proposed Optimizations:"));
  outputBlank();
  const optByAction = groupOptimizationsByAction(optimizations);
  for (const [action, opts] of Object.entries(optByAction)) {
    output(chalk.cyan(`    ${action}: ${opts.length} item(s)`));
  }
  output(chalk.yellow("  ⚠ These are PROPOSALS only. Manual approval required."));
  outputBlank();
}

async function displayDynamicRules(projectRoot: string, shitennoDir: string): Promise<void> {
  try {
    const { generateDynamicRules } = await import("../dynamic-rules.js");
    const dynamicRules = generateDynamicRules(projectRoot, shitennoDir);
    if (dynamicRules.length > 0) {
      output(chalk.bold("  🚨 Dynamic Rules (from History):"));
      outputBlank();
      for (const rule of dynamicRules.slice(0, 5)) {
        const severityIcon = rule.severity === "critical" ? "🔴" : rule.severity === "high" ? "🟡" : "ℹ️";
        output(`    ${severityIcon} ${rule.rule}`);
        output(chalk.gray(`      Evidence: ${rule.evidence}`));
        outputBlank();
      }
    }
  } catch { /* Skip dynamic rules on error */ }
}

function handleAutoBacklog(
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
      severity: "Alto",
      priority: "P1",
      source: "shugo audit",
      date: today,
      modules: ["shitenno/"],
      description: `${graphAnalysis.orphanArtifacts.length} artifacts no knowledge graph sem relacoes conectando-os.`,
      correction: "Adicionar relacoes entre artifacts orfaos e existentes.",
      state: "planeado",
      owner: "unassigned",
      line: 0,
      filePath: "",
      format: "modular",
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

interface AuditActionCtx { projectRoot: string; shitennoDir: string; }

function handleChangedFiles(options: { changed?: string | boolean }, ctx: AuditActionCtx, isJson: boolean): string[] | undefined {
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

function handleFullSweep(options: { fullSweep?: boolean }, ctx: AuditActionCtx, isJson: boolean): void {
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

function fetchAuditReport(options: { cache?: boolean; level: string }, ctx: AuditActionCtx, level: string, changedFiles: string[] | undefined): Promise<{ report: HealthAuditReport; cacheHit: boolean }> {
  if (options.cache !== false && level !== "code-review" && level !== "enterprise") {
    const cached = getCached<HealthAuditReport>({ projectRoot: ctx.projectRoot, key: "health", computeChecksumsFn: () => computeKeyChecksums(ctx.projectRoot, ctx.shitennoDir) });
    if (cached) return Promise.resolve({ report: cached, cacheHit: true });
  }
  return auditHealth(ctx.projectRoot, ctx.shitennoDir, level as AuditLevel, changedFiles).then((report) => ({ report, cacheHit: false }));
}

function buildIssueCounts(issues: HealthAuditReport["issues"]) {
  const count = (type: string) => issues.filter((i) => i.type === type).length;
  return {
    total: issues.length, critical: issues.filter((i) => i.severity === 3).length,
    warning: issues.filter((i) => i.severity === 2).length, info: issues.filter((i) => i.severity === 1).length,
    datePlaceholders: count("date_placeholder"), emptyDirs: count("empty_dir"), brokenRefs: count("broken_ref"),
    missingGitignore: count("missing_gitignore"), maturityInconsistency: count("maturity_inconsistency"),
    adrCoverageGap: count("adr_coverage_gap"), testFailures: count("test_failure"), orphanModules: count("orphan_module"),
    oversizedFiles: count("oversized_file"), lintErrors: count("lint_error"), missingTests: count("missing_test"),
    anyTypeUsage: count("any_type_usage"), typeErrors: count("type_error"), consoleLogs: count("console_log_outside_cmd"),
    emptyCatchBlocks: count("empty_catch"), circularDeps: count("circular_dep"), highComplexity: count("high_complexity"),
    unusedExports: count("unused_export"), deadCode: count("dead_code"), unpinnedVersions: count("unpinned_version"),
    missingLockFile: count("missing_lock_file"), lockFileDrift: count("lock_file_drift"),
    phantomDeps: count("phantom_dep"), deprecatedPackages: count("deprecated_package"),
  };
}

interface HumanReportInput { report: HealthAuditReport; graphAnalysis: { totalArtifacts: number; totalRelations: number; healthScore: number; orphanArtifacts: Array<{ name: string; type: string }>; hubArtifacts: Array<{ artifact: { name: string }; connectionCount: number }>; suggestions: string[] };
  ctx: AuditActionCtx; isJson: boolean; cacheHit: boolean; reportFile: string | null; }

function displayHumanAuditReport(input: HumanReportInput): void {
  const { report, graphAnalysis, ctx, isJson, cacheHit, reportFile } = input;
  if (cacheHit) output(chalk.gray("  📦 Used cached results"));
  outputBlank();
  output(chalk.bold("  🏥 Health Audit Results:"));
  outputBlank();
  output(chalk.gray(`    Rules:           ${report.totalRules}`));
  output(chalk.gray(`    History entries:  ${report.historyEntries}`));
  output(chalk.gray(`    Issues found:    ${report.issues.length}`));
  output(chalk.gray(`    Optimizations:   ${report.optimizations.length}`));
  displayIssueCounts(report.issues);
  outputBlank();
  output(chalk.bold("    Code Health:"));
  output(`      ${report.healthScore}/100  ${healthBar(report.healthScore, 100)}`);
  outputBlank();
  displayKnowledgeGraph(graphAnalysis);
  if (report.issues.length === 0) {
    output(chalk.green("  ✔ No issues found. Governance is healthy!"));
    outputBlank();
  } else {
    displayCategorizedIssues(report, ctx, isJson);
  }
  if (reportFile) { output(chalk.gray(`  📄 Report saved: shitenno/reports/${reportFile}`)); outputBlank(); }
}

function displayIssueCounts(issues: HealthAuditReport["issues"]): void {
  const count = (type: string) => issues.filter((i) => i.type === type).length;
  const show = (label: string, type: string, color: typeof chalk) => { const n = count(type); if (n > 0) output(color(`    ${label}: ${n}`)); };
  show("Date placeholders", "date_placeholder", chalk.gray);
  show("Empty directories", "empty_dir", chalk.gray);
  show("Broken references", "broken_ref", chalk.gray);
  show("Missing .gitignore", "missing_gitignore", chalk.gray);
  show("Maturity issues", "maturity_inconsistency", chalk.gray);
  show("ADR coverage gaps", "adr_coverage_gap", chalk.gray);
  show("Test failures", "test_failure", chalk.red);
  show("Orphan modules", "orphan_module", chalk.gray);
  show("Oversized files", "oversized_file", chalk.gray);
  show("Lint errors", "lint_error", chalk.yellow);
  show("Missing tests", "missing_test", chalk.gray);
  show("Any type usage", "any_type_usage", chalk.gray);
  show("Type errors", "type_error", chalk.yellow);
  show("Console.log", "console_log_outside_cmd", chalk.gray);
  show("Empty catch blocks", "empty_catch", chalk.yellow);
  show("Circular deps", "circular_dep", chalk.red);
  show("High complexity", "high_complexity", chalk.yellow);
  show("Unused exports", "unused_export", chalk.gray);
  show("Dead code", "dead_code", chalk.gray);
  show("Unpinned versions", "unpinned_version", chalk.yellow);
  show("Missing lock file", "missing_lock_file", chalk.red);
  show("Lock file drift", "lock_file_drift", chalk.yellow);
  show("Phantom deps", "phantom_dep", chalk.yellow);
  show("Deprecated pkgs", "deprecated_package", chalk.yellow);
}

function displayKnowledgeGraph(graphAnalysis: { totalArtifacts: number; totalRelations: number; healthScore: number; orphanArtifacts: Array<{ name: string; type: string }>; hubArtifacts: Array<{ artifact: { name: string }; connectionCount: number }>; suggestions: string[] }): void {
  output(chalk.bold("  📊 Knowledge Graph:"));
  outputBlank();
  const graphColor = graphAnalysis.healthScore >= 70 ? chalk.green : graphAnalysis.healthScore >= 40 ? chalk.yellow : chalk.red;
  output(`    Health:  ${graphColor(graphAnalysis.healthScore + "/100")}  ${healthBar(graphAnalysis.healthScore, 100)}`);
  output(`    Artifacts: ${graphAnalysis.totalArtifacts} | Relations: ${graphAnalysis.totalRelations}`);
  outputBlank();
  if (graphAnalysis.orphanArtifacts.length > 0) {
    output(chalk.yellow(`    ⚠ ${graphAnalysis.orphanArtifacts.length} orphaned artifact(s):`));
    for (const orphan of graphAnalysis.orphanArtifacts.slice(0, 5)) output(chalk.gray(`      - ${orphan.name} (${orphan.type})`));
    outputBlank();
  }
  if (graphAnalysis.hubArtifacts.length > 0) {
    output(chalk.cyan("    🔗 Top Hubs:"));
    for (const hub of graphAnalysis.hubArtifacts.slice(0, 5)) output(chalk.gray(`      - ${hub.artifact.name}: ${hub.connectionCount} connection(s)`));
    outputBlank();
  }
  if (graphAnalysis.suggestions.length > 0) {
    output(chalk.blue("    💡 Suggestions:"));
    for (const suggestion of graphAnalysis.suggestions) output(chalk.gray(`      - ${suggestion}`));
    outputBlank();
  }
}

function displayCategorizedIssues(report: HealthAuditReport, ctx: AuditActionCtx, isJson: boolean): void {
  const categorized = categorizeIssues(report.issues);
  displayIssueCategory({ title: "Critical Issues (require immediate attention)", issues: categorized.critical, icon: "🚨", color: chalk.red });
  displayIssueCategory({ title: "Warnings (should be addressed)", issues: categorized.warnings, icon: "⚠️", color: chalk.yellow });
  if (categorized.info.length > 0) {
    output(chalk.bold("  ℹ️  Info (informational, low priority):"));
    outputBlank();
    const groupedByType = groupByType(categorized.info);
    for (const [type, issues] of Object.entries(groupedByType)) {
      const first = issues[0];
      output(chalk.gray(`    • ${first && issues.length === 1 ? first.description : formatTypeGroup(type, issues)}`));
    }
    outputBlank();
  }
  const quickWins = identifyQuickWins(report.issues);
  if (quickWins.length > 0) {
    output(chalk.bold("  ⚡ Quick Wins (low effort, high impact):"));
    outputBlank();
    for (const win of quickWins.slice(0, 5)) {
      output(chalk.green(`    ✔ ${win.description}`));
      output(chalk.gray(`       Effort: ${win.effort} | Impact: ${win.impact}`));
    }
    outputBlank();
  }
  displayFixSuggestions(report, ctx, isJson);
  displayOptimizations(report.optimizations);
}

function displayFixSuggestions(report: HealthAuditReport, ctx: AuditActionCtx, isJson: boolean): void {
  if (report.issues.length === 0) return;
  const suggestions = generateFixSuggestions(report.issues as Parameters<typeof generateFixSuggestions>[0], []);
  const prioritized = prioritizeSuggestions(suggestions);
  if (prioritized.length > 0) {
    output(chalk.bold("  🔧 Top Fix Suggestions (auto-generated):"));
    outputBlank();
    for (const s of prioritized.slice(0, 3)) {
      output(chalk.cyan(`    ${s.description}`));
      output(chalk.gray(`       File: ${s.file} | Confidence: ${Math.round(s.confidence * 100)}%`));
    }
    outputBlank();
  }
  displayAutofixApplication(prioritized, ctx, isJson);
}

function displayAutofixApplication(prioritized: ReturnType<typeof prioritizeSuggestions>, ctx: AuditActionCtx, isJson: boolean): void {
  if (!isJson || prioritized.length === 0) return;
  output(chalk.bold("  🔧 Applying high-confidence fixes..."));
  outputBlank();
  const policyBlock = runPolicyGate(
    { type: "apply_autofix", params: { suggestionCount: prioritized.length } },
    { trigger: "manual", eventData: {}, projectRoot: ctx.projectRoot, shitennoDir: ctx.shitennoDir, timestamp: new Date().toISOString() }
  );
  if (policyBlock) {
    output(chalk.red(`  ✘ ${policyBlock.message}`));
    outputBlank();
    return;
  }
  const autofixReport: AutofixReport = applyAllFixes(prioritized, ctx.projectRoot, { dryRun: false });
  output(chalk.gray(`    Total: ${autofixReport.total} | Applied: ${autofixReport.applied} | Reverted: ${autofixReport.reverted} | Skipped: ${autofixReport.skipped}`));
  outputBlank();
  for (const result of autofixReport.results) {
    const icon = result.status === "applied" ? "✔" : result.status === "reverted" ? "✘" : "⊘";
    const color = result.status === "applied" ? chalk.green : result.status === "reverted" ? chalk.red : chalk.gray;
    output(color(`    ${icon} ${result.suggestion.description} (${result.status})`));
    if (result.reason) output(chalk.gray(`       Reason: ${result.reason}`));
  }
  outputBlank();
  if (autofixReport.reverted > 0) {
    output(chalk.yellow("  ⚠ Some fixes were reverted due to verification failure."));
    output(chalk.gray("    Files were restored to their original state."));
    outputBlank();
  }
}

function displaySemanticAuditPatterns(patterns: ReturnType<typeof runSemanticAnalysis>["patterns"]): void {
  output(chalk.bold.cyan(`    📊 Detected Patterns (${patterns.length})`));
  outputBlank();
  for (const pattern of patterns.slice(0, 5)) {
    const icon = pattern.type === "architectural_shift" ? "🏗️" :
                 pattern.type === "scope_drift" ? "🔄" :
                 pattern.type === "security_degradation" ? "🔒" :
                 pattern.type === "tech_debt_accumulation" ? "📦" :
                 pattern.type === "capability_gap" ? "🧩" : "📉";
    output(`    ${icon} ${chalk.bold(pattern.description)}`);
    output(chalk.gray(`      Domain: ${pattern.domain} | Confidence: ${Math.round(pattern.confidence * 100)}% | Type: ${pattern.type}`));
    for (const action of pattern.suggestedActions.slice(0, 2)) output(chalk.gray(`        → ${action}`));
    outputBlank();
  }
}

function displaySemanticAuditInsights(insights: ReturnType<typeof runSemanticAnalysis>["insights"]): void {
  output(chalk.bold.magenta(`    🧠 Semantic Insights (${insights.length})`));
  outputBlank();
  for (const insight of insights.slice(0, 5)) {
    const icon = insight.priority === "urgent" ? "🚨" : insight.priority === "high" ? "⚠️" : "💡";
    const color = insight.priority === "urgent" ? chalk.red : insight.priority === "high" ? chalk.yellow : chalk.gray;
    output(`    ${icon} ${chalk.bold(insight.description)}`);
    output(chalk.gray(`      Priority: ${color(insight.priority)} | Domains: ${insight.domains.join(", ")}`));
    for (const action of insight.suggestedActions.slice(0, 2)) output(chalk.gray(`        → ${action}`));
    outputBlank();
  }
}

function displaySemanticAuditCorrelations(correlations: ReturnType<typeof runSemanticAnalysis>["correlations"]): void {
  output(chalk.bold.yellow(`    🔗 Cross-System Correlations (${correlations.length})`));
  outputBlank();
  for (const corr of correlations.slice(0, 5)) {
    const icon = corr.strength === "strong" ? "🔴" : corr.strength === "moderate" ? "🟡" : "🟢";
    output(`    ${icon} ${chalk.bold(corr.description)}`);
    output(chalk.gray(`      Type: ${corr.type} | Confidence: ${Math.round(corr.confidence * 100)}% | Strength: ${corr.strength}`));
    outputBlank();
  }
}

function displaySemanticAudit(projectRoot: string, shitennoDir: string): void {
  try {
    const { profile, patterns, insights, correlations } = runSemanticAnalysis(shitennoDir, projectRoot);
    if (patterns.length === 0 && insights.length === 0 && correlations.length === 0) return;
    output(chalk.bold.magenta("  ╔══════════════════════════════════════════════════╗"));
    output(chalk.bold.magenta("  ║        SEMANTIC AUDIT — Cross-System Analysis     ║"));
    output(chalk.bold.magenta("  ╚══════════════════════════════════════════════════╝"));
    outputBlank();
    if (patterns.length > 0) displaySemanticAuditPatterns(patterns);
    if (insights.length > 0) displaySemanticAuditInsights(insights);
    if (correlations.length > 0) displaySemanticAuditCorrelations(correlations);
    output(chalk.gray(`    Growth: capacity=${Math.round(profile.growthCapacity * 100)}% | challenge=${Math.round(profile.challengeLevel * 100)}% | choices=${profile.semanticChoices.length}`));
    outputBlank();
  } catch (err) {
    logger.warn("audit", `Semantic analysis failed: ${err}`);
  }
}

function displayWhatWasMeasured(report: HealthAuditReport): void {
  outputBlank();
  output(chalk.bold("  📏 What Was Measured:"));
  outputBlank();
  output(chalk.gray(`    Duration:         ${report.durationMs}ms`));
  output(chalk.gray(`    Files scanned:    ${report.filesScanned}`));
  output(chalk.gray(`    Detectors run:    ${report.detectorsRun.length}`));
  output(chalk.gray(`    Rules evaluated:  ${report.totalRules}`));
  output(chalk.gray(`    History sessions: ${report.historyEntries}`));
  outputBlank();
  output(chalk.bold("  📊 Health Card:"));
  outputBlank();
  const dimensions: AuditDimension[] = ["security", "reliability", "complexity", "hygiene", "coverage", "governance"];
  for (const dim of dimensions) {
    const score = report.dimensionScores[dim] ?? 100;
    const color = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;
    output(`    ${dimensionIcon(dim)} ${dimensionLabel(dim).padEnd(15)} ${color(`${score}/100`)}`);
  }
  outputBlank();
  outputBlank();
}

interface JsonOutputInput { report: HealthAuditReport; graphAnalysis: { totalArtifacts: number; totalRelations: number; healthScore: number; orphanArtifacts: { length: number }; hubArtifacts: { length: number }; suggestions: string[] };
  options: { apply?: boolean; dryRun?: boolean }; ctx: AuditActionCtx; cacheHit: boolean; reportFile: string | null;
  growthProfile: { growthCapacity?: number; challengeLevel?: number; patterns: Array<{ type: string }>; pathHistory: unknown[] }; }

function collectSemanticData(projectRoot: string, shitennoDir: string): Record<string, unknown> {
  try {
    const { profile: semanticProfile, patterns: semanticPatterns, insights, correlations } = runSemanticAnalysis(shitennoDir, projectRoot);

    return {
      patterns: semanticPatterns.map((p) => ({
        id: p.id, type: p.type, domain: p.domain,
        confidence: p.confidence, description: p.description,
      })),
      insights: insights.map((i) => ({
        id: i.id, type: i.type, priority: i.priority,
        description: i.description, domains: i.domains,
      })),
      correlations: correlations.map((c) => ({
        id: c.id, type: c.type, strength: c.strength,
        description: c.description, confidence: c.confidence,
      })),
      growthProfile: {
        growthCapacity: semanticProfile.growthCapacity,
        challengeLevel: semanticProfile.challengeLevel,
        domainChallengeLevels: semanticProfile.domainChallengeLevels,
      },
    };
  } catch (err) {
    logger.warn("audit", `Semantic analysis failed for JSON: ${err}`);
    return {};
  }
}

function handleJsonOutput(input: JsonOutputInput): void {
  const { report, graphAnalysis, options, ctx, cacheHit, reportFile, growthProfile } = input;
  let autofixReportJson: AutofixReport | undefined;
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

function displaySuppressedIssues(suppressedIssues: HealthAuditReport["suppressedIssues"]): void {
  output(chalk.bold("  🚫 Suppressed Issues:"));
  outputBlank();
  for (const issue of suppressedIssues) {
    const fp = issueFingerprint(issue);
    output(chalk.gray(`    [${fp}] ${issue.description}`));
    output(chalk.gray(`      Reason: ${issue.suppressionReason}`));
  }
  outputBlank();
}

function resolveLevelLabel(level: string): string {
  if (level === "enterprise") return "enterprise";
  if (level === "code-review") return "code-review";
  if (level === "quick") return "quick";
  return "standard";
}

function resolveAuditLevel(level: string): string {
  if (["quick", "standard", "code-review", "enterprise"].includes(level)) return level;
  return "standard";
}

function applyMinConfidenceFilter(report: HealthAuditReport, minConfidence: number | undefined): HealthAuditReport {
  if (minConfidence === undefined || minConfidence < 0 || minConfidence > 1) return report;
  return { ...report, issues: report.issues.filter((i) => (i.confidence ?? 1.0) >= minConfidence) };
}

function initializeAuditOutput(isJson: boolean, options: { level: string }): void {
  if (isJson) {
    muteLogs();
    return;
  }
  const levelLabel = resolveLevelLabel(options.level);
  outputBlank();
  banner("shugo audit", "Health Audit");
  output(chalk.gray(`    Level: ${levelLabel}`));
  outputBlank();
}

function runAuditExecution(
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

interface HumanPostAuditInput {
  report: HealthAuditReport;
  graphAnalysis: ReturnType<typeof analyzeGraph>;
  ctx: AuditActionCtx;
  cacheHit: boolean;
  reportFile: string | null;
  options: { showSuppressed?: boolean; autoBacklog?: boolean };
  growthProfile: ReturnType<typeof loadGrowthProfile>;
}

function displayHumanPostAudit(input: HumanPostAuditInput): Promise<void> {
  return (async () => {
    const { report, graphAnalysis, ctx, cacheHit, reportFile, options, growthProfile } = input;
    displayHumanAuditReport({ report, graphAnalysis, ctx, isJson: false, cacheHit, reportFile });
    await displayDynamicRules(ctx.projectRoot, ctx.shitennoDir);
    output(chalk.bold("  📝 Summary:"));
    output(chalk.gray(`    ${report.summary}`));
    outputBlank();
    if (options.showSuppressed && report.suppressedIssues.length > 0) {
      displaySuppressedIssues(report.suppressedIssues);
    }
    output(formatGrowthProgress(growthProfile));
    outputBlank();
    displaySemanticAudit(ctx.projectRoot, ctx.shitennoDir);
    getEventBus().publish("health.checked", {
      status: resolveHealthStatus(report.healthScore),
      healthScore: report.healthScore,
      dimensionScores: report.dimensionScores,
      issues: report.issues.map((i) => i.description),
      checksRun: report.totalRules,
    });
    if (options.autoBacklog) handleAutoBacklog(report, graphAnalysis, ctx, false);
    await displayCustomCheckResults(ctx, report);
  })();
}

function resolveHealthStatus(healthScore: number): string {
  if (healthScore >= 70) return "healthy";
  if (healthScore >= 40) return "degraded";
  return "critical";
}

async function displayCustomCheckResults(ctx: AuditActionCtx, report: HealthAuditReport): Promise<void> {
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

function handleAuditError(error: unknown, isJson: boolean, spinner: ReturnType<typeof ora> | null): void {
  if (isJson) {
    outputJson({ error: "audit_failed", message: String(error) });
    return;
  }
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
        handleJsonOutput({ report, graphAnalysis, options, ctx, cacheHit, reportFile, growthProfile });
        return;
      }
      displayWhatWasMeasured(report);
      await displayHumanPostAudit({ report, graphAnalysis, ctx, cacheHit, reportFile, options, growthProfile });
    } catch (error) {
      handleAuditError(error, isJson, spinner);
    }
  });
