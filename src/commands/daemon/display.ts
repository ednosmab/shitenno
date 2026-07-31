import chalk from "chalk";
import { readFileSync, statSync, createReadStream } from "node:fs";
import { output, outputBlank } from "../../output.js";
import type { DaemonStatusResponse } from "../../daemon-client.js";

export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function colorizeLogLine(line: string): string {
  if (line.includes("[ERROR]")) return chalk.red(line);
  if (line.includes("[WARN]")) return chalk.yellow(line);
  if (line.includes("[DEBUG]")) return chalk.gray(line);
  return line;
}

export function displaySessionSection(status: DaemonStatusResponse): void {
  output(chalk.bold("  Sessions:"));
  output(`    Active:   ${status.activeSessions}`);
  if (status.lastSession) {
    const dur = status.lastSession.duration ? `${status.lastSession.duration}min` : "em curso";
    output(`    Latest:   ${chalk.gray(`${status.lastSession.id} (${dur})`)}`);
  }
}

export function displayHealthSection(status: DaemonStatusResponse): void {
  if (status.drift) {
    output(chalk.bold("  Drift:"));
    output(`    Files:    ${chalk.yellow(String(status.drift.filesChanged))} changed`);
    output(`    Time:     ${chalk.yellow(String(status.drift.minutesSinceLastCommit))} min since last commit`);
    output(`    Detected: ${chalk.gray(status.drift.detectedAt)}`);
    outputBlank();
  }
  if (status.health) {
    output(chalk.bold("  Health:"));
    const scoreColor = status.health.score >= 70 ? chalk.green : status.health.score >= 40 ? chalk.yellow : chalk.red;
    output(`    Score:    ${scoreColor(String(status.health.score))}/100`);
    output(`    Checked:  ${chalk.gray(status.health.checkedAt)}`);
    outputBlank();
  }
  if (status.challengesQueued > 0) {
    output(chalk.bold("  Challenges:"));
    output(`    Queued:   ${chalk.yellow(String(status.challengesQueued))}`);
    outputBlank();
  }
  if (status.debt) {
    output(chalk.bold("  Knowledge Debt:"));
    output(`    Gaps:     ${chalk.yellow(String(status.debt.gapCount))}`);
    const debtColor = status.debt.healthScore >= 70 ? chalk.green : status.debt.healthScore >= 40 ? chalk.yellow : chalk.red;
    output(`    Health:   ${debtColor(String(status.debt.healthScore))}/100`);
    outputBlank();
  }
}

export function displayAdvancedSection(status: DaemonStatusResponse): void {
  if (status.proactiveEngine) {
    output(chalk.bold("  Proactive Engine:"));
    output(`    Last check:     ${chalk.gray(status.proactiveEngine.lastCheck ?? "Never")}`);
    output(`    Challenges:     ${chalk.yellow(String(status.proactiveEngine.challengesTriggered))} triggered`);
    if (status.proactiveEngine.cooldownUntil) output(`    Cooldown until: ${chalk.gray(status.proactiveEngine.cooldownUntil)}`);
    outputBlank();
  }
  if (status.audit) {
    output(chalk.bold("  Audit:"));
    output(`    Last audit:     ${chalk.gray(status.audit.lastAuditTime ?? "Never")}`);
    output(`    Total audits:   ${chalk.cyan(String(status.audit.auditCount))}`);
  }
}

export function displayDaemonSections(status: DaemonStatusResponse): void {
  displaySessionSection(status);
  outputBlank();
  displayHealthSection(status);
  displayAdvancedSection(status);
}

export function displayRunningDaemonStatus(status: DaemonStatusResponse): void {
  output(`  PID:        ${chalk.bold(status.pid)}`);
  output(`  Version:    ${status.version}`);
  output(`  Uptime:     ${formatUptime(status.uptimeSeconds)}`);
  output(`  Events:     ${status.eventsRecorded} recorded`);
  outputBlank();
  displayDaemonSections(status);
}

export async function attachToDaemonLog(logPath: string, numLines: number): Promise<void> {
  output(chalk.gray(`  Attached to daemon log (${logPath}) — Ctrl+C to detach (daemon keeps running)`));
  outputBlank();

  try {
    const content = readFileSync(logPath, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    const tail = lines.slice(-numLines);
    for (const line of tail) {
      output(colorizeLogLine(line));
    }
  } catch {
    // File may have been rotated — continue to follow
  }

  let lastSize = statSync(logPath).size;
  const stream = () => {
    try {
      const { size } = statSync(logPath);
      if (size > lastSize) {
        const rs = createReadStream(logPath, { start: lastSize, end: size });
        rs.on("data", (chunk) => {
          const text = chunk.toString();
          for (const line of text.split("\n").filter(Boolean)) {
            output(colorizeLogLine(line));
          }
        });
        lastSize = size;
      } else if (size < lastSize) {
        lastSize = 0;
      }
    } catch {
      // Log file may have been removed — keep polling
    }
  };

  const { watchFile, unwatchFile } = await import("node:fs");
  watchFile(logPath, { interval: 300 }, stream);

  process.on("SIGINT", () => {
    unwatchFile(logPath, stream);
    output(chalk.gray("\n  Detached (daemon continues running in background)."));
    process.exitCode = 0;
  });
}
