/**
 * daemon/pid-manager.ts — PID file management, duplicate detection, and cleanup
 *
 * Extracted from daemon/index.ts to keep modules focused.
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, renameSync } from "node:fs";
import { logger } from "../logger.js";
import { daemonLog } from "./log-rotation.js";

// ── PID Management ──────────────────────────────────────────────────────────

export interface DaemonContext {
  shitennoDir: string;
  projectRoot: string;
  daemonDir: string;
  pidPath: string;
  sockPath: string;
  logPath: string;
  approvedPath: string;
  statePath: string;
  state: ReturnType<typeof import("./state.js").createDaemonState>;
  socket: import("node:net").Server;
  stopProactive: () => void;
  stopWatcher: () => void;
}

export function checkDuplicateDaemon(ctx: DaemonContext): void {
  if (!existsSync(ctx.pidPath)) return;
  try {
    const existingPid = parseInt(readFileSync(ctx.pidPath, "utf-8").trim(), 10);
    if (!isNaN(existingPid) && existingPid > 0) {
      try {
        process.kill(existingPid, 0);
        daemonLog(ctx.logPath, "WARN", `Daemon already running (pid ${existingPid}). Exiting.`);
        process.exit(0);
      } catch {
        daemonLog(ctx.logPath, "INFO", `Stale PID file (pid ${existingPid} not running). Overwriting.`);
      }
    }
  } catch {
    // Corrupt PID file — safe to continue
  }
}

export function writePidAtomically(ctx: DaemonContext): void {
  const tmpPath = `${ctx.pidPath}.${process.pid}.tmp`;
  writeFileSync(tmpPath, String(process.pid), "utf-8");
  try {
    renameSync(tmpPath, ctx.pidPath);
  } catch {
    try {
      const writtenPid = parseInt(readFileSync(ctx.pidPath, "utf-8").trim(), 10);
      if (writtenPid !== process.pid) {
        daemonLog(ctx.logPath, "WARN", `Another daemon (pid ${writtenPid}) took over. Exiting.`);
        process.exit(0);
      }
    } catch {
      // PID file corrupted — proceed
    }
  }
  daemonLog(ctx.logPath, "INFO", `PID ${process.pid} written to ${ctx.pidPath}`);
}

export function markApproved(ctx: DaemonContext): void {
  if (!existsSync(ctx.approvedPath)) {
    writeFileSync(ctx.approvedPath, new Date().toISOString(), "utf-8");
    daemonLog(ctx.logPath, "INFO", "Daemon marked as approved for auto-start");
  }
}

export function cleanupStaleSocket(ctx: DaemonContext): void {
  if (existsSync(ctx.sockPath)) {
    try { unlinkSync(ctx.sockPath); } catch { logger.debug("daemon", "Failed to remove stale socket"); }
  }
}

export function cleanup(pidPath: string, sockPath: string): void {
  for (const p of [pidPath, sockPath]) {
    try { if (existsSync(p)) unlinkSync(p); } catch { logger.debug("daemon", `Failed to clean up ${p}`); }
  }
}
