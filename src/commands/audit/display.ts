/**
 * commands/audit/display.ts — Audit report display functions
 *
 * Extracted from commands/audit.ts to keep modules focused.
 */

import chalk from "chalk";
import { healthBar } from "../../formatting.js";
import { output, outputBlank } from "../../output.js";
import { groupOptimizationsByAction, categorizeIssues, groupByType, formatTypeGroup, identifyQuickWins } from "./reporter.js";
import { generateFixSuggestions, prioritizeSuggestions } from "../../audit/suggestion-engine.js";
import { runPolicyGate } from "../../decision-core/invoke.js";
import { applyAllFixes, type AutofixReport } from "../../audit/autofix-engine.js";
import { dimensionIcon, dimensionLabel, type AuditDimension } from "../../audit/dimensions.js";
export { displaySemanticAudit, collectSemanticData } from "./semantic-display.js";
import { issueFingerprint, type HealthAuditReport } from "../../health-auditor.js";
import type { AuditActionCtx } from "./types.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface IssueCategoryInput {
  title: string;
  issues: Array<{ description: string; location: string; recommendation: string }>;
  icon: string;
  color: typeof chalk;
  limit?: number;
}

export interface HumanReportInput {
  report: HealthAuditReport;
  graphAnalysis: {
    totalArtifacts: number; totalRelations: number; healthScore: number;
    orphanArtifacts: Array<{ name: string; type: string }>;
    hubArtifacts: Array<{ artifact: { name: string }; connectionCount: number }>;
    suggestions: string[];
  };
  ctx: AuditActionCtx; isJson: boolean; cacheHit: boolean; reportFile: string | null;
}

// ── Issue Display ───────────────────────────────────────────────────────────

export function displayIssueCategory(input: IssueCategoryInput): void {
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

export function displayOptimizations(optimizations: Array<{ action: string }>): void {
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

export async function displayDynamicRules(projectRoot: string, shitennoDir: string): Promise<void> {
  try {
    const { generateDynamicRules } = await import("../../dynamic-rules.js");
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

// ── Issue Counts ────────────────────────────────────────────────────────────

export function buildIssueCounts(issues: HealthAuditReport["issues"]) {
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

export function displayIssueCounts(issues: HealthAuditReport["issues"]): void {
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

// ── Knowledge Graph Display ─────────────────────────────────────────────────

export function displayKnowledgeGraph(graphAnalysis: {
  totalArtifacts: number; totalRelations: number; healthScore: number;
  orphanArtifacts: Array<{ name: string; type: string }>;
  hubArtifacts: Array<{ artifact: { name: string }; connectionCount: number }>;
  suggestions: string[];
}): void {
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

// ── Categorized Issues Display ──────────────────────────────────────────────

export function displayCategorizedIssues(report: HealthAuditReport, ctx: AuditActionCtx, isJson: boolean): void {
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

// ── Fix Suggestions Display ─────────────────────────────────────────────────

export function displayFixSuggestions(report: HealthAuditReport, ctx: AuditActionCtx, isJson: boolean): void {
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

export function displayAutofixApplication(prioritized: ReturnType<typeof prioritizeSuggestions>, ctx: AuditActionCtx, isJson: boolean): void {
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

// ── Semantic Audit Display ──────────────────────────────────────────────────



// ── What Was Measured ───────────────────────────────────────────────────────

export function displayWhatWasMeasured(report: HealthAuditReport): void {
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

// ── Human Audit Report ──────────────────────────────────────────────────────

export function displayHumanAuditReport(input: HumanReportInput): void {
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

// ── Suppressed Issues Display ───────────────────────────────────────────────

export function displaySuppressedIssues(suppressedIssues: HealthAuditReport["suppressedIssues"]): void {
  output(chalk.bold("  🚫 Suppressed Issues:"));
  outputBlank();
  for (const issue of suppressedIssues) {
    const fp = issueFingerprint(issue);
    output(chalk.gray(`    [${fp}] ${issue.description}`));
    output(chalk.gray(`      Reason: ${issue.suppressionReason}`));
  }
  outputBlank();
}

// ── Semantic Data Collection ────────────────────────────────────────────────


