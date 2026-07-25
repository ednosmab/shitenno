/**
 * commands/daemon.ts — shugo daemon <start|stop|status|restart>
 *
 * Manages the Shugo background daemon lifecycle.
 *
 * PRINCIPLE: The daemon is opt-in. These commands give full control.
 */

import { Command } from "commander";
import chalk from "chalk";
// eslint-disable-next-line no-restricted-imports -- daemon log viewer needs direct fs access
import { existsSync, statSync, createReadStream, readFileSync } from "node:fs";
import { join } from "node:path";
import { guardNotInitialized } from "../shared.js";
import { isDaemonRunning, startDaemon, stopDaemon, shouldSkipDaemon, getSocketPath, isDaemonApproved, queryDaemonStatus } from "../daemon-client.js";
import type { DaemonStatusResponse } from "../daemon-client.js";
import { DaemonCircuitBreaker } from "../daemon-circuit-breaker.js";
import { output, outputBlank } from "../output.js";

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function colorizeLogLine(line: string): string {
  if (line.includes("[ERROR]")) return chalk.red(line);
  if (line.includes("[WARN]")) return chalk.yellow(line);
  if (line.includes("[DEBUG]")) return chalk.gray(line);
  return line;
}

async function handleStartAction(opts: Record<string, unknown>): Promise<void> {
  const ctx = guardNotInitialized(opts, false);
  if (!ctx) return;

  if (shouldSkipDaemon()) {
    output(chalk.yellow("  ⚠  Daemon is disabled (SHITENNO_NO_DAEMON=1 or CI=true)"));
    return;
  }

  const breaker = new DaemonCircuitBreaker(ctx.shitennoDir);
  if (breaker.isTripped()) {
    const state = breaker.getState();
    output(chalk.red("  ✗ Circuit breaker is tripped — too many crashes"));
    output(chalk.gray(`    Last crash: ${state.lastCrashAt}`));
    output(chalk.gray("    Run 'shugo daemon status' for details."));
    output(chalk.dim("    To force-reset: delete shitenno/daemon/circuit-breaker.json"));
    process.exitCode = 1;
    return;
  }

  if (isDaemonRunning(ctx.shitennoDir)) {
    output(chalk.yellow("  ℹ  Daemon is already running"));
    return;
  }

  output(chalk.gray("  Starting daemon..."));
  try {
    await startDaemon(ctx.shitennoDir);
    output(chalk.green("  ✓ Daemon started"));
    output(chalk.gray(`    Socket: ${getSocketPath(ctx.shitennoDir)}`));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    output(chalk.red(`  ✗ Failed to start daemon: ${msg}`));
    breaker.record();
    process.exitCode = 1;
  }
}

function handleStopAction(opts: Record<string, unknown>): void {
  const ctx = guardNotInitialized(opts, false);
  if (!ctx) return;

  if (!isDaemonRunning(ctx.shitennoDir)) {
    output(chalk.yellow("  ℹ  Daemon is not running"));
    return;
  }

  const stopped = stopDaemon(ctx.shitennoDir);
  if (stopped) {
    output(chalk.green("  ✓ Daemon stopped"));
  } else {
    output(chalk.red("  ✗ Failed to stop daemon"));
    process.exitCode = 1;
  }
}

async function handleRestartAction(opts: Record<string, unknown>): Promise<void> {
  const ctx = guardNotInitialized(opts, false);
  if (!ctx) return;

  if (isDaemonRunning(ctx.shitennoDir)) {
    output(chalk.gray("  Stopping daemon..."));
    stopDaemon(ctx.shitennoDir);
    await new Promise<void>((r) => setTimeout(r, 1_000));
  }

  const breaker = new DaemonCircuitBreaker(ctx.shitennoDir);
  if (breaker.isTripped()) {
    output(chalk.red("  ✗ Circuit breaker is tripped — cannot restart"));
    process.exitCode = 1;
    return;
  }

  output(chalk.gray("  Starting daemon..."));
  try {
    await startDaemon(ctx.shitennoDir);
    output(chalk.green("  ✓ Daemon restarted"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    output(chalk.red(`  ✗ Failed to restart daemon: ${msg}`));
    breaker.record();
    process.exitCode = 1;
  }
}

function displaySessionSection(status: DaemonStatusResponse): void {
  output(chalk.bold("  Sessions:"));
  output(`    Active:   ${status.activeSessions}`);
  if (status.lastSession) {
    const dur = status.lastSession.duration ? `${status.lastSession.duration}min` : "em curso";
    output(`    Latest:   ${chalk.gray(`${status.lastSession.id} (${dur})`)}`);
  }
}

function displayHealthSection(status: DaemonStatusResponse): void {
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

function displayAdvancedSection(status: DaemonStatusResponse): void {
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

function displayDaemonSections(status: DaemonStatusResponse): void {
  displaySessionSection(status);
  outputBlank();
  displayHealthSection(status);
  displayAdvancedSection(status);
}

function displayRunningDaemonStatus(status: DaemonStatusResponse): void {
  output(`  PID:        ${chalk.bold(status.pid)}`);
  output(`  Version:    ${status.version}`);
  output(`  Uptime:     ${formatUptime(status.uptimeSeconds)}`);
  output(`  Events:     ${status.eventsRecorded} recorded`);
  outputBlank();
  displayDaemonSections(status);
}

async function handleStatusAction(opts: Record<string, unknown>): Promise<void> {
  const ctx = guardNotInitialized(opts, false);
  if (!ctx) return;

  outputBlank();
  output(chalk.bold.cyan("  🔧 Shugo Daemon Status"));
  outputBlank();

  const running = isDaemonRunning(ctx.shitennoDir);
  const breaker = new DaemonCircuitBreaker(ctx.shitennoDir);
  const breakerState = breaker.getState();

  output(`  Running:    ${running ? chalk.green("yes") : chalk.red("no")}`);

  if (running) {
    const status = await queryDaemonStatus(ctx.shitennoDir);
    if (status) {
      displayRunningDaemonStatus(status);
    } else {
      output(chalk.yellow("  ℹ  Daemon is running but did not respond to status query"));
    }
  }

  outputBlank();
  output(chalk.bold("  Circuit Breaker:"));
  output(`    Tripped:   ${breakerState.tripped ? chalk.red("yes") : chalk.green("no")}`);
  output(`    Crashes:   ${breakerState.crashCount}`);
  if (breakerState.lastCrashAt) {
    output(`    Last crash: ${chalk.gray(breakerState.lastCrashAt)}`);
  }

  outputBlank();
  output(chalk.bold("  Environment:"));
  output(`    Skip daemon: ${shouldSkipDaemon() ? chalk.yellow("yes (env override)") : chalk.green("no")}`);
  output(`    Approved:    ${isDaemonApproved(ctx.shitennoDir) ? chalk.green("yes") : chalk.gray("no (run 'shugo daemon start' once to approve)")}`);
  outputBlank();
}

async function attachToDaemonLog(logPath: string, numLines: number): Promise<void> {
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
    process.exit(0);
  });
}

async function handleLogsAction(opts: Record<string, unknown>): Promise<void> {
  const ctx = guardNotInitialized(opts, false);
  if (!ctx) return;

  if (!isDaemonRunning(ctx.shitennoDir)) {
    output(chalk.yellow("  ℹ  Daemon is not running — nothing to attach to."));
    output(chalk.gray("     Start it with: shugo daemon start"));
    return;
  }

  const daemonDir = join(ctx.shitennoDir, "daemon");
  const logPath = process.env["SHITENNO_DAEMON_LOG"] ?? join(daemonDir, "daemon.log");
  if (!existsSync(logPath)) {
    output(chalk.yellow(`  ℹ  Log file not found yet at ${logPath}`));
    return;
  }

  // Non-interactive environments: just dump recent lines and exit
  if (!process.stdin.isTTY) {
    const numLines = Number(opts.lines) || 20;
    try {
      const content = readFileSync(logPath, "utf-8");
      const lines = content.split("\n").filter(Boolean);
      for (const line of lines.slice(-numLines)) {
        output(colorizeLogLine(line));
      }
    } catch {
      output(chalk.red(`  ✗ Failed to read log file: ${logPath}`));
    }
    return;
  }

  const numLines = Number(opts.lines) || 50;
  await attachToDaemonLog(logPath, numLines);
}

async function handleNotificationsAction(opts: Record<string, unknown>): Promise<void> {
  const ctx = guardNotInitialized(opts, false);
  if (!ctx) return;

  const { readNotificationLog } = await import("../notify.js");
  const entries = readNotificationLog(ctx.shitennoDir, { last: Number(opts.lines) || 20 });

  if (entries.length === 0) {
    output(chalk.yellow("  No notifications log found. Desktop notifications may not have been sent yet."));
    return;
  }

  outputBlank();
  output(chalk.bold.cyan(`  Recent Notifications (last ${entries.length}):`));
  outputBlank();

  for (const entry of entries) {
    const time = entry.timestamp ? chalk.gray(new Date(entry.timestamp as string).toLocaleTimeString()) : "";
    const type = entry.type ? chalk.cyan(`[${entry.type}]`) : "";
    const msg = entry.message ?? "";
    output(`  ${time} ${type} ${msg}`);
  }

  outputBlank();
  output(chalk.gray(`  Total: ${entries.length} notifications shown`));
}

export function daemonCommand(): Command {
  const cmd = new Command("daemon")
    .description("Manage the Shugo background daemon")
    .addHelpText("after", `
Exemplos:
  shugo daemon start     Iniciar o daemon em segundo plano
  shugo daemon stop      Parar o daemon graciosamente
  shugo daemon status    Mostrar estado e uptime do daemon
  shugo daemon restart   Reiniciar o daemon

O daemon é um hub de eventos que monitoriza:
  - Arquivo automático de planos concluídos
  - Alertas de drift no working directory
  - Sessões activas e histórico
  - Saúde do projecto e desafios de melhoria
  - Dívida de conhecimento
`);

  cmd.command("start")
    .description("Start the Shugo daemon in the background")
    .action(handleStartAction);

  cmd.command("stop")
    .description("Stop the Shugo daemon")
    .action(handleStopAction);

  cmd.command("status")
    .description("Show daemon status")
    .action(handleStatusAction);

  cmd.command("restart")
    .description("Restart the Shugo daemon")
    .action(handleRestartAction);

  cmd.command("logs")
    .description("Attach to the running daemon and stream its log in real time")
    .option("--lines <n>", "Number of historical lines to show before following", "50")
    .action(handleLogsAction);

  cmd.command("notifications")
    .description("Show recent desktop notifications sent by the daemon")
    .option("--lines <n>", "Number of recent notifications to show", "20")
    .action(handleNotificationsAction);

  return cmd;
}
