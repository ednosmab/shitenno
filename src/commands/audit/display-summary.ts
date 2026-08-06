/**
 * commands/audit/display-summary.ts — Summary and graph display for audit reports
 */

import chalk from "chalk";
import { healthBar } from "../../shared/formatting.js";
import { output, outputBlank } from "../../shared/output.js";
import { dimensionIcon, dimensionLabel, type AuditDimension } from "../../audit/dimensions.js";
import { issueFingerprint, type HealthAuditReport } from "../../application/health-auditor.js";
import type { AuditActionCtx } from "./types.js";
import { categorizeIssues, groupByType, formatTypeGroup, identifyQuickWins } from "./reporter.js";
import { displayIssueCategory } from "./display.js";

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

export function displayHumanAuditReport(input: HumanReportInput): void {
  const { report, graphAnalysis, cacheHit, reportFile } = input;
  if (cacheHit) output(chalk.gray("  📦 Used cached results"));
  outputBlank();
  output(chalk.bold("  🏥 Health Audit Results:"));
  outputBlank();
  output(chalk.gray(`    Rules:           ${report.totalRules}`));
  output(chalk.gray(`    History entries:  ${report.historyEntries}`));
  output(chalk.gray(`    Issues found:    ${report.issues.length}`));
  output(chalk.gray(`    Optimizations:   ${report.optimizations.length}`));
  outputBlank();
  output(chalk.bold("    Code Health:"));
  output(`      ${report.healthScore}/100  ${healthBar(report.healthScore, 100)}`);
  outputBlank();
  displayKnowledgeGraph(graphAnalysis);
  if (report.issues.length === 0) {
    output(chalk.green("  ✔ No issues found. Governance is healthy!"));
    outputBlank();
  } else {
    displayCategorizedIssuesFromSummary(report);
  }
  if (reportFile) { output(chalk.gray(`  📄 Report saved: shitenno/reports/${reportFile}`)); outputBlank(); }
}

function displayCategorizedIssuesFromSummary(report: HealthAuditReport): void {
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
}
