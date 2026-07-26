import chalk from "chalk";
import { existsSync, readFileSync, createReadStream, statSync } from "node:fs";
import { join } from "node:path";
import { output, outputBlank } from "../../output.js";
import { isDaemonRunning } from "../../daemon-client.js";
import { colorizeLogLine } from "./display.js";

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
    process.exit(0);
  });
}

export async function handleLogsAction(opts: Record<string, unknown>): Promise<void> {
  const { guardNotInitialized } = await import("../../shared.js");
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
