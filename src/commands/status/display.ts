/**
 * commands/status/display.ts — Status command display functions
 *
 * Extracted from commands/status.ts to keep modules focused.
 */

import chalk from "chalk";
import { healthBar, statusIcon, banner } from "../../formatting.js";
import { CAPABILITIES, type MaturityProfile } from "../../maturity-profile.js";
import { output, outputBlank } from "../../output.js";
import { muteLogs } from "../../logger.js";
import { getEventBus } from "../../event-bus.js";
import type { StatusCheck } from "./health-checks.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface FooterData {
  cacheHit: boolean;
  reportFile: string | undefined;
  projectRoot: string;
  maturityProfile: MaturityProfile | null;
  complexity: { score: number; level: string; suggestions: string[] };
}

// ── Header / Footer ─────────────────────────────────────────────────────────

export function displayHeader(isJson: boolean): void {
  if (isJson) muteLogs();
  if (!isJson) { outputBlank(); banner("shugo status", "Health Check"); outputBlank(); }
}

export function displayProjectRootText(projectRoot: string): void {
  output(chalk.bold("  Project root:"));
  output(chalk.gray(`    ${projectRoot}`));
  outputBlank();
}

export function displayFooter(data: FooterData): void {
  if (data.cacheHit) { output(chalk.gray("  📦 Used cached results")); outputBlank(); }
  if (data.reportFile) { output(chalk.gray(`  📄 Report saved: shitenno/reports/${data.reportFile}`)); outputBlank(); }
  getEventBus().publish("analysis.complete", {
    projectId: data.projectRoot,
    maturityScore: data.maturityProfile?.overallScore ?? data.complexity.score,
    dimensions: data.maturityProfile?.dimensions ?? {},
    recommendations: data.complexity.suggestions,
  });
}

// ── Results Display ─────────────────────────────────────────────────────────

export function displayResults(checks: StatusCheck[]): void {
  output(chalk.bold("  Governance Health:"));
  outputBlank();
  let passCount = 0; let warnCount = 0; let failCount = 0;
  for (const check of checks) {
    const { icon, color } = statusIcon(check.status);
    if (check.status === "pass") passCount++;
    else if (check.status === "warn") warnCount++;
    else failCount++;
    output(`    ${color(icon)} ${chalk.bold(check.name)}: ${color(check.message)}`);
  }
  outputBlank();
  output(chalk.bold("  Summary:"));
  output(`    ${chalk.green(`✔ ${passCount} passed`)}  ${chalk.yellow(`⚠ ${warnCount} warnings`)}  ${chalk.red(`✘ ${failCount} failed`)}`);
  outputBlank();
  if (failCount > 0) output(chalk.red("  Run 'shugo init' to fix failed checks."));
  else if (warnCount > 0) output(chalk.yellow("  Some optional components are missing. Run 'shugo upgrade' to add them."));
  else output(chalk.green("  Governance is healthy!"));
  outputBlank();
}

// ── Fix Mode ────────────────────────────────────────────────────────────────

export function displayFixMode(checks: StatusCheck[], isJson: boolean): void {
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  if (!isJson) {
    output(chalk.bold("  🔧 Auto-fix Mode:"));
    outputBlank();
    if (failCount > 0) {
      output(chalk.gray("  Attempting fixes for failed checks..."));
      output(chalk.gray("  → Run 'shugo init' to fix failed governance checks"));
      output(chalk.gray("  → Run 'shugo upgrade --accept-recommended' to add missing capabilities"));
    }
    if (warnCount > 0) {
      output(chalk.gray("  Attempting fixes for warnings..."));
      output(chalk.gray("  → Run 'shugo upgrade' to add optional components"));
      output(chalk.gray("  → Run 'shugo sync' to synchronize documentation"));
    }
    if (failCount === 0 && warnCount === 0) output(chalk.green("  ✔ No fixes needed — governance is healthy!"));
    outputBlank();
  }
}

// ── Maturity Profile Display ────────────────────────────────────────────────

export function displayMaturityProfile(profile: MaturityProfile | null, installedCapabilities: string[]): void {
  output(chalk.bold("  🎯 Maturity Profile:"));
  outputBlank();
  if (!profile) {
    output(chalk.gray("    No maturity profile found. Run 'shugo init' to create one."));
    outputBlank();
    return;
  }
  displayMaturityScore(profile);
  displayMaturityDimensions(profile);
  displayInstalledCapabilities(installedCapabilities);
  displayRecommendedCapabilities(profile);
}

function displayMaturityScore(profile: MaturityProfile): void {
  const color = profile.overallScore >= 65 ? chalk.green : profile.overallScore >= 35 ? chalk.yellow : chalk.red;
  output(`    Overall Score: ${color(String(profile.overallScore))}/100 ${healthBar(profile.overallScore, 100)}`);
  outputBlank();
}

function displayMaturityDimensions(profile: MaturityProfile): void {
  const dimLabels: Record<string, string> = {
    architecture: "Arquitetura", governance: "Governança", quality: "Qualidade",
    automation: "Automação", ai: "IA", documentation: "Documentação", observability: "Observabilidade",
  };
  const barWidth = 16;
  for (const [key, label] of Object.entries(dimLabels)) {
    const value = profile.dimensions[key as keyof typeof profile.dimensions];
    const filled = Math.round((value / 100) * barWidth);
    const empty = barWidth - filled;
    const dimColor = value >= 65 ? chalk.green : value >= 35 ? chalk.yellow : chalk.red;
    const bar = dimColor("█".repeat(filled)) + chalk.gray("░".repeat(empty));
    output(`    ${label.padEnd(16)} ${bar} ${String(value).padStart(3)}%`);
  }
  outputBlank();
}

function displayInstalledCapabilities(installedCapabilities: string[]): void {
  output(chalk.bold("    Installed Capabilities:"));
  for (const cap of installedCapabilities) {
    const info = CAPABILITIES.find((c) => c.id === cap);
    output(chalk.green(`      ✓ ${info?.name || cap}`));
  }
  outputBlank();
}

function displayRecommendedCapabilities(profile: MaturityProfile): void {
  if (profile.recommendedCapabilities.length > 0) {
    output(chalk.bold("    🎯 Recommended:"));
    for (const cap of profile.recommendedCapabilities) {
      const info = CAPABILITIES.find((c) => c.id === cap);
      output(chalk.cyan(`      → ${info?.name || cap}`));
    }
    outputBlank();
  }
}
