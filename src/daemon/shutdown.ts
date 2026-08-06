/**
 * daemon/shutdown.ts — Graceful shutdown, signal handling, and timer cleanup
 *
 * Extracted from daemon/index.ts to keep modules focused.
 */

import { killActiveProcesses } from "../infrastructure/exec-async.js";
import { releaseVerificationLock } from "../infrastructure/verification-lock.js";
import { persistState } from "./state.js";
import { cleanup } from "./pid-manager.js";
import { cleanupSemanticLayer } from "./semantic-runner.js";
import { daemonLog } from "./log-rotation.js";
import type { DaemonContext } from "./pid-manager.js";

// ── Timer Cleanup ───────────────────────────────────────────────────────────

export type ShutdownTimers = {
  stableTimer: NodeJS.Timeout;
  checkNagTimer: NodeJS.Timeout;
  initialFullAuditTimer?: NodeJS.Timeout;
  persistTimer: NodeJS.Timeout;
  auditTimer: NodeJS.Timeout;
  consolidationTimer: NodeJS.Timeout;
  cleanupAudit: () => void;
};

export function clearAllTimers(timers: ShutdownTimers): void {
  clearTimeout(timers.stableTimer);
  clearTimeout(timers.checkNagTimer);
  if (timers.initialFullAuditTimer) clearTimeout(timers.initialFullAuditTimer);
  clearInterval(timers.persistTimer);
  clearInterval(timers.auditTimer);
  clearInterval(timers.consolidationTimer);
  timers.cleanupAudit();
}

// ── Graceful Shutdown ───────────────────────────────────────────────────────

export function gracefulShutdown(ctx: DaemonContext, timers: ShutdownTimers, signal: string): void {
  daemonLog(ctx.logPath, "INFO", `Received ${signal} — shutting down`);
  clearAllTimers(timers);
  killActiveProcesses();
  releaseVerificationLock(ctx.shitennoDir);
  persistState(ctx.state, ctx.statePath);
  ctx.stopProactive();
  ctx.stopWatcher();
  cleanupSemanticLayer();
  ctx.socket.close(() => {
    cleanup(ctx.pidPath, ctx.sockPath);
    daemonLog(ctx.logPath, "INFO", "Daemon stopped cleanly");
    process.exitCode = 0;
  });
  setTimeout(() => {
    cleanup(ctx.pidPath, ctx.sockPath);
    process.exit(1);
  }, 5_000).unref();
}

export function setupShutdown(ctx: DaemonContext, timers: ShutdownTimers): void {
  process.on("SIGTERM", () => gracefulShutdown(ctx, timers, "SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown(ctx, timers, "SIGINT"));

  process.on("uncaughtException", (err) => {
    daemonLog(ctx.logPath, "FATAL", `Uncaught exception — daemon crashing: ${err.stack ?? err.message}`);
    try { persistState(ctx.state, ctx.statePath); } catch { /* best-effort */ }
    cleanup(ctx.pidPath, ctx.sockPath);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    const msg = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
    daemonLog(ctx.logPath, "ERROR", `Unhandled promise rejection: ${msg}`);
  });
}
