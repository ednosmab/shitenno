/**
 * doctor.ts — Pilar 9: Mentor de Engenharia
 *
 * Transforma o CLI num assistente técnico.
 * Identifica riscos, sugere melhorias, explica impactos,
 * orienta próximos passos e ensina boas práticas.
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { healthBar, outputJson } from "../formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { output, outputBlank, outputError } from "../output.js";
import { runDoctorAnalysis, type DoctorReport } from "./doctor/analysis.js";
export { analyzeRisks, analyzeImprovements, analyzeTeaching, runDoctorAnalysis } from "./doctor/analysis.js";
export type { DoctorFinding, DoctorReport } from "./doctor/analysis.js";

function displayDoctorHeader(): void {
  outputBlank();
  output(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
  output(chalk.bold.cyan("  ║    shugo doctor — Engineering Mentor ║"));
  output(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
  outputBlank();
}

function displayHealthStatus(report: DoctorReport): void {
  const healthColor =
    report.overallHealth === "healthy" ? chalk.green :
    report.overallHealth === "attention" ? chalk.yellow :
    report.overallHealth === "warning" ? chalk.yellow :
    chalk.red;
  output(chalk.bold("  Health:"));
  output(`    ${healthColor(report.overallHealth.toUpperCase())} — ${report.healthScore}/100 ${healthBar(report.healthScore, 100)}`);
  outputBlank();
}

function displayFindings(findings: DoctorReport["findings"], label: string, color: typeof chalk.bold.red): void {
  if (findings.length === 0) return;
  output(color(`  ${label}:`));
  outputBlank();
  for (const finding of findings) {
    const sevIcon = finding.severity === "critical" ? "🔴" : finding.severity === "high" ? "🟠" : "🟡";
    output(`    ${sevIcon} ${chalk.bold(finding.title)}`);
    output(chalk.gray(`       ${finding.description}`));
    output(chalk.gray(`       Impact: ${finding.impact}`));
    output(chalk.cyan("       Next steps:"));
    for (const step of finding.nextSteps) {
      output(chalk.cyan(`         → ${step}`));
    }
    outputBlank();
  }
}

function displayTeachingMoments(moments: string[]): void {
  if (moments.length === 0) return;
  output(chalk.bold.cyan("  📚 Learn:"));
  outputBlank();
  for (const moment of moments) {
    output(chalk.gray(`    ${moment}`));
    outputBlank();
  }
}

function publishDoctorEvent(
  projectRoot: string,
  report: DoctorReport
): void {
  getEventBus().publish("health.checked", {
    projectRoot,
    healthScore: report.healthScore,
    overallHealth: report.overallHealth,
    findings: report.findings.length,
  });
}

export const doctorCommand = new Command("doctor")
  .description("Engineering mentor — identify risks, suggest improvements, teach best practices")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--json", "Output results as JSON")
  .action((options) => {
    const isJson = options.json === true;

    if (!isJson) displayDoctorHeader();

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    if (!checkLifecycleGate("doctor", ctx.projectRoot, ctx.shitennoDir, isJson)) return;

    const spinner = ora("Analyzing project health...").start();

    try {
      const report = runDoctorAnalysis(ctx.projectRoot, ctx.shitennoDir);
      spinner.stop();

      if (isJson) {
        outputJson({
          projectRoot: ctx.projectRoot,
          overallHealth: report.overallHealth,
          healthScore: report.healthScore,
          findings: report.findings,
          teachingMoments: report.teachingMoments,
          summary: report.summary,
        });
        return;
      }

      displayHealthStatus(report);
      displayFindings(report.findings.filter((f) => f.category === "risk"), "🔍 Risks", chalk.bold.red);
      displayFindings(report.findings.filter((f) => f.category === "improvement"), "💡 Improvements", chalk.bold.yellow);
      displayTeachingMoments(report.teachingMoments);
      output(chalk.bold("  📝 Summary:"));
      output(chalk.gray(`    ${report.summary}`));
      outputBlank();
      publishDoctorEvent(ctx.projectRoot, report);
    } catch (error) {
      spinner.fail("Doctor analysis failed");
      outputError(chalk.red(`  Error: ${error}`));
      outputBlank();
    }
  });
