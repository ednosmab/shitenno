/**
 * exec-async.ts — Async wrapper for child_process.execFile.
 *
 * Provides execAsync() for non-blocking command execution,
 * used by plan-lifecycle to avoid blocking the daemon event loop.
 */

import { execFile, type ChildProcess } from "node:child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
}

// ── Child Process Tracker ──────────────────────────────────────────────────

const activeProcesses = new Set<ChildProcess>();

/**
 * Kill all active child processes (called on daemon shutdown).
 */
export function killActiveProcesses(): void {
  for (const proc of activeProcesses) {
    try {
      proc.kill("SIGTERM");
    } catch {
      // Process already dead
    }
  }
  activeProcesses.clear();
}

/**
 * Run a command asynchronously with a timeout.
 * Rejects on non-zero exit, timeout, or signal termination.
 */
export function execAsync(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
    maxBuffer?: number;
  } = {}
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const proc: ChildProcess = execFile(
      command,
      args,
      {
        cwd: options.cwd,
        encoding: "utf-8",
        timeout: options.timeout ?? 120_000,
        maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
      },
      (error: Error | null, stdout: string, stderr: string) => {
        activeProcesses.delete(proc);
        if (error) {
          const execErr = error as Error & { killed?: boolean; signal?: string; stderr?: string };
          if (execErr.killed) {
            reject(new Error(`[TIMEOUT] Process killed after ${options.timeout ?? 120_000}ms`));
            return;
          }
          reject(error);
          return;
        }
        resolve({ stdout: stdout ?? "", stderr: stderr ?? "" });
      }
    );

    activeProcesses.add(proc);
    proc.on("error", (err) => {
      activeProcesses.delete(proc);
      reject(err);
    });
  });
}

/**
 * Parse a shell command string into [command, args[]].
 * Simple split — works for "pnpm run test:unit" style commands.
 */
export function parseCommand(cmd: string): { command: string; args: string[] } {
  const parts = cmd.trim().split(/\s+/);
  return { command: parts[0]!, args: parts.slice(1) };
}
