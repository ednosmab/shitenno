/**
 * commands/init/display.ts — Init display functions
 *
 * Extracted from commands/init.ts to keep modules focused.
 */

import chalk from "chalk";
import { output, outputBlank } from "../../shared/output.js";
import { CAPABILITIES, type MaturityProfile } from "../../application/maturity-profile.js";
import type { ProjectAnalysis } from "../../infrastructure/analyser.js";
import { SHITENNO_DIR_NAME } from "../../domain/types/constants.js";

// ── Display Functions ───────────────────────────────────────────────────────

export function displayMaturityDimensions(profile: MaturityProfile): void {
  const dims = profile.dimensions;
  const dimLabels: Record<string, string> = {
    architecture: "Arquitetura",
    governance: "Governança",
    quality: "Qualidade",
    automation: "Automação",
    ai: "IA",
    documentation: "Documentação",
    observability: "Observabilidade",
  };

  const barWidth = 20;
  for (const [key, label] of Object.entries(dimLabels)) {
    const value = dims[key as keyof typeof dims];
    const filled = Math.round((value / 100) * barWidth);
    const empty = barWidth - filled;
    const color = value >= 65 ? chalk.green : value >= 35 ? chalk.yellow : chalk.red;
    const bar = color("█".repeat(filled)) + chalk.gray("░".repeat(empty));
    output(`    ${label.padEnd(16)} ${bar} ${chalk.bold(String(value).padStart(3))}%`);
  }
  outputBlank();
  output(`    ${chalk.bold("Score Geral:")}      ${chalk.bold(String(profile.overallScore))}/100`);
}

export function displayCapabilities(profile: MaturityProfile): void {
  const installed = profile.installedCapabilities;
  const recommended = profile.recommendedCapabilities;
  const future = profile.futureCapabilities;

  output(chalk.bold("  Capacidades instaladas:"));
  for (const cap of installed) {
    const info = CAPABILITIES.find((c) => c.id === cap);
    output(chalk.green(`    ✓ ${info?.name || cap}`));
  }
  outputBlank();

  if (recommended.length > 0) {
    output(chalk.bold("  Capacidades recomendadas:"));
    for (const cap of recommended) {
      const info = CAPABILITIES.find((c) => c.id === cap);
      output(chalk.cyan(`    → ${info?.name || cap} — ${info?.description || ""}`));
    }
    outputBlank();
  }

  if (future.length > 0) {
    output(chalk.bold("  Capacidades futuras:"));
    for (const cap of future) {
      const info = CAPABILITIES.find((c) => c.id === cap);
      output(chalk.gray(`    □ ${info?.name || cap}`));
    }
    outputBlank();
  }
}

export function displayProjectAnalysis(analysis: ProjectAnalysis, title: string): void {
  output(chalk.bold(`  ${title}:`));
  output(`    Stack:     ${analysis.stack.length > 0 ? analysis.stack.join(", ") : chalk.gray("none detected")}`);
  output(`    Packages:  ${analysis.packageCount}`);
  output(`    Apps:      ${analysis.appCount}`);
  output(`    Source:    ${analysis.sourceFileCount} files`);
  output(`    Manager:  ${analysis.packageManager}`);
  output(`    TypeScript:${analysis.hasTypeScript ? " yes" : chalk.gray(" no")}`);
  output(`    Tests:     ${analysis.hasTests ? "yes" : chalk.gray("no")}`);
  output(`    CI/CD:     ${analysis.hasCI ? "yes" : chalk.gray("no")}`);
  outputBlank();
}

export function handleDryRun(profile: MaturityProfile): void {
  const capsToInstall = ["core", ...profile.recommendedCapabilities];
  output(chalk.bold.green("  ═══ Dry Run — Would install ═══"));
  outputBlank();
  output(chalk.bold("  Capabilities:"));
  for (const cap of capsToInstall) {
    const info = CAPABILITIES.find((c) => c.id === cap);
    output(chalk.green(`    ✓ ${info?.name || cap}`));
  }
  outputBlank();
  output(chalk.bold("  Files that would be created:"));
  output(chalk.gray("    opencode.json"));
  output(chalk.gray("    shitenno/ (governance ecosystem)"));
  for (const dir of ["governance", "docs", "skills", "scripts", "telemetry"] as string[]) {
    output(chalk.gray(`      ${dir}/`));
  }
  outputBlank();
  output(chalk.gray("  Run without --dry-run to apply changes."));
  outputBlank();
}

export function displaySuccessResults(
  result: { directoriesCreated: string[]; filesCreated: string[] },
): void {
  outputBlank();
  output(chalk.bold.green("  ✓ Shitenno Framework installed!"));
  outputBlank();
  output(chalk.bold("  Structure created:"));
  output(chalk.gray("    opencode.json          ← configuration (project root)"));
  output(chalk.gray("    shitenno/          ← governance ecosystem"));
  for (const dir of result.directoriesCreated) {
    if (dir === SHITENNO_DIR_NAME) continue;
    output(chalk.gray(`      ${dir.replace("shitenno/", "")}/`));
  }
  outputBlank();
  output(chalk.bold("  Files created:"));
  for (const file of result.filesCreated) {
    output(chalk.gray(`    ${file}`));
  }
  outputBlank();
  output(chalk.bold("  Next steps:"));
  output(chalk.gray("    1. Edit shitenno/docs/AGENTS.md to customise rules"));
  output(chalk.gray("    2. Edit opencode.json to set your AI models"));
  output(chalk.gray("    3. Run 'shugo status' to check governance health"));
  output(chalk.gray("    4. Run 'shugo assess' to re-evaluate maturity later"));
  outputBlank();
}
