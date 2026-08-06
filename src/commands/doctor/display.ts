import chalk from "chalk";
import { healthBar } from "../../shared/formatting.js";
import { output, outputBlank } from "../../shared/output.js";
import { getEventBus } from "../../infrastructure/event-bus.js";
import type { DoctorFinding, DoctorReport } from "./analysis.js";

export function displayDoctorHeader(): void {
  outputBlank();
  output(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
  output(chalk.bold.cyan("  ║    shugo doctor — Engineering Mentor ║"));
  output(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
  outputBlank();
}

export function displayHealthStatus(report: DoctorReport): void {
  const healthColor =
    report.overallHealth === "healthy" ? chalk.green :
    report.overallHealth === "attention" ? chalk.yellow :
    report.overallHealth === "warning" ? chalk.yellow :
    chalk.red;
  output(chalk.bold("  Health:"));
  output(`    ${healthColor(report.overallHealth.toUpperCase())} — ${report.healthScore}/100 ${healthBar(report.healthScore, 100)}`);
  outputBlank();
}

export function displayFindings(findings: DoctorFinding[], label: string, color: typeof chalk.bold.red): void {
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

export function displayTeachingMoments(moments: string[]): void {
  if (moments.length === 0) return;
  output(chalk.bold.cyan("  📚 Learn:"));
  outputBlank();
  for (const moment of moments) {
    output(chalk.gray(`    ${moment}`));
    outputBlank();
  }
}

export function publishDoctorEvent(
  projectRoot: string,
  report: DoctorReport
): void {
  getEventBus().publish("health.checked", {
    projectRoot,
    healthScore: report.healthScore,
    overallHealth: report.overallHealth,
    findings: report.findings.length,
  });
  // Findings should only be recorded when the user explicitly accepts/rejects them
}
