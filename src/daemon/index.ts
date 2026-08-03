/**
 * daemon/index.ts — Daemon orchestrator (thin entry point)
 *
 * All implementation details have been extracted into focused modules:
 * - log-rotation.ts: logging, log rotation, version, paths
 * - pid-manager.ts: PID file management, duplicate detection, cleanup
 * - event-handlers.ts: event bus subscriptions, resource arbitration
 * - semantic-runner.ts: semantic pattern matching, journal initialization
 * - timers.ts: audit scheduling, consolidation, periodic tasks
 * - verification.ts: plan verification loop
 * - engine-init.ts: engine initialization
 * - shutdown.ts: graceful shutdown, signal handling
 *
 * This file remains as the entry point that wires everything together.
 */

import { join } from "node:path";
import { createServer, type Server, type Socket } from "node:net";
import { chmodSync, mkdirSync } from "node:fs";
import { createDaemonState, loadState, recordEvent } from "./state.js";
import { handleMessage, sendJson, type IpcMessage } from "./ipc.js";
import { getVersion, getPaths, daemonLog, initLogByteCounter } from "./log-rotation.js";
import {
  checkDuplicateDaemon, writePidAtomically, markApproved, cleanupStaleSocket,
  type DaemonContext,
} from "./pid-manager.js";
import { subscribeAllEvents } from "./event-handlers.js";
import { setupPeriodicTimers, scheduleCheckNag, runPeriodicAudit, scheduleInitialFullAudit } from "./timers.js";
import { createVerifyAllPendingPlans } from "./verification.js";
import { initializeDaemonEngines } from "./engine-init.js";
import { setupShutdown, type ShutdownTimers } from "./shutdown.js";
import { checkAndArchiveDonePlans } from "../plan-lifecycle.js";
import {
  checkInconsistencies,
  validateReminders,
  moveCompletedBacklogToDone,
  recoverOrphanSidecars,
} from "./startup-scan.js";
import { MarkdownPlanEngine } from "../markdown-plan-engine.js";
import { getEventBus } from "../event-bus.js";

// Re-export public API for consumers that import from daemon/index.js
export { getPaths, daemonLog } from "./log-rotation.js";
export { type DaemonContext } from "./pid-manager.js";

const DAEMON_VERSION = getVersion();

// ── IPC Server ──────────────────────────────────────────────────────────────

const MAX_MESSAGE_BYTES = 64 * 1024;

function setupIpcServer(ctx: DaemonContext, startedAt: number): void {
  const server = createServer((socket: Socket) => {
    let buffer = "";

    socket.on("data", async (chunk: Buffer) => {
      if (buffer.length + chunk.length > MAX_MESSAGE_BYTES) {
        sendJson(socket, { type: "error", message: "Message too large" });
        socket.destroy();
        return;
      }
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line) as IpcMessage;
          await handleMessage({
            msg, socket, shitennoDir: ctx.shitennoDir, sockPath: ctx.sockPath,
            startedAt, logPath: ctx.logPath, state: ctx.state,
            projectRoot: ctx.projectRoot, daemonVersion: DAEMON_VERSION,
          });
        } catch {
          sendJson(socket, { type: "error", message: "Invalid JSON" });
        }
      }
    });

    socket.on("error", () => socket.destroy());
  });

  server.listen(ctx.sockPath, () => {
    try {
      chmodSync(ctx.sockPath, 0o600);
    } catch (err) {
      daemonLog(ctx.logPath, "WARN", `chmod 0600 failed on socket: ${err}`);
    }
    daemonLog(ctx.logPath, "INFO", `IPC socket listening at ${ctx.sockPath}`);
  });

  (ctx as { socket: Server }).socket = server;
}

// ── Startup Scan ────────────────────────────────────────────────────────────

function runSafeScanStep(
  ctx: DaemonContext,
  stepName: string,
  eventName: string,
  fn: () => void,
): void {
  try {
    fn();
    recordEvent(ctx.state, eventName);
  } catch (err) {
    daemonLog(ctx.logPath, "ERROR", `Startup scan: ${stepName} failed: ${err}`);
  }
}

function runStartupScan(
  ctx: DaemonContext,
  verifyAllPendingPlans: () => Promise<void>,
): void {
  daemonLog(ctx.logPath, "INFO", "Running initial startup scan...");
  const scanStartTime = Date.now();

  runSafeScanStep(ctx, "checkAndArchiveDonePlans", "startup_scan.archive_plans", () => {
    const archiveResult = checkAndArchiveDonePlans(ctx.shitennoDir);
    if (archiveResult.archived > 0) {
      daemonLog(ctx.logPath, "INFO", `Startup scan: archived ${archiveResult.archived} plan(s): ${archiveResult.archivedIds.join(", ")}`);
    }
  });

  runSafeScanStep(ctx, "checkInconsistencies", "startup_scan.check_inconsistencies", () => {
    const inconsistencies = checkInconsistencies(ctx.shitennoDir);
    if (inconsistencies.inconsistencies > 0) {
      daemonLog(ctx.logPath, "WARN", `Startup scan: found ${inconsistencies.inconsistencies} inconsistent plan(s)`);
    }
  });

  runSafeScanStep(ctx, "recoverOrphanSidecars", "startup_scan.recover_orphans", () => {
    const orphans = recoverOrphanSidecars(ctx.shitennoDir);
    if (orphans.removed > 0) {
      daemonLog(ctx.logPath, "INFO", `Startup scan: removed ${orphans.removed} orphan sidecar(s)`);
    }
  });

  runSafeScanStep(ctx, "validateReminders", "startup_scan.validate_reminders", () => {
    const reminders = validateReminders(ctx.shitennoDir);
    if (reminders.removed > 0) {
      daemonLog(ctx.logPath, "INFO", `Startup scan: removed ${reminders.removed} stale reminder(s)`);
    }
  });

  runSafeScanStep(ctx, "moveCompletedBacklogToDone", "startup_scan.move_backlog", () => {
    const backlog = moveCompletedBacklogToDone(ctx.shitennoDir, ctx.shitennoDir);
    if (backlog.moved > 0) {
      daemonLog(ctx.logPath, "INFO", `Startup scan: moved ${backlog.moved} completed backlog item(s)`);
    }
  });

  // Finalize
  try {
    const engine = new MarkdownPlanEngine(ctx.shitennoDir);
    const orphanedCheck = engine.listAll().filter((p) => p.isActive && p.status === "check");
    if (orphanedCheck.length > 0) {
      daemonLog(ctx.logPath, "WARN", `Startup scan: ${orphanedCheck.length} orphaned plan(s) in 'check' — running verification now`);
      verifyAllPendingPlans().catch((err) => daemonLog(ctx.logPath, "ERROR", `Startup scan: orphaned verification promise rejected: ${err}`));
    }
  } catch (err) {
    daemonLog(ctx.logPath, "ERROR", `Startup scan: orphaned plan verification failed: ${err}`);
  }

  const scanDuration = Date.now() - scanStartTime;
  daemonLog(ctx.logPath, "INFO", `Initial startup scan completed in ${scanDuration}ms`);
  getEventBus().publish("daemon.ready", { pid: process.pid, uptimeMs: scanDuration });
}

// ── Context Builder ─────────────────────────────────────────────────────────

function buildDaemonContext(shitennoDir: string, resolvedProjectRoot: string, paths: ReturnType<typeof getPaths>): DaemonContext {
  const state = loadState(paths.statePath) ?? createDaemonState();
  state.startedAt = new Date().toISOString();
  daemonLog(paths.logPath, "INFO", `State loaded — ${state.events.length} historical events`);

  return {
    shitennoDir,
    projectRoot: resolvedProjectRoot,
    daemonDir: paths.daemonDir,
    pidPath: paths.pidPath,
    sockPath: paths.sockPath,
    logPath: paths.logPath,
    approvedPath: paths.approvedPath,
    statePath: paths.statePath,
    state,
    socket: null as unknown as Server,
    stopProactive: () => {},
    stopWatcher: () => {},
  };
}

function initializeDaemonInfrastructure(ctx: DaemonContext): void {
  if (!ctx.daemonDir) {
    mkdirSync(ctx.daemonDir, { recursive: true });
  }
  daemonLog(ctx.logPath, "INFO", `Shugo Daemon v${DAEMON_VERSION} starting — shitennoDir: ${ctx.shitennoDir}`);
  initLogByteCounter(ctx.logPath);
  checkDuplicateDaemon(ctx);
  writePidAtomically(ctx);
  markApproved(ctx);
  cleanupStaleSocket(ctx);
}

// ── Main Entry Point ────────────────────────────────────────────────────────

export async function runDaemon(shitennoDir: string, projectRoot?: string): Promise<void> {
  const resolvedProjectRoot = projectRoot ?? join(shitennoDir, "..");
  const paths = getPaths(shitennoDir);

  const ctx = buildDaemonContext(shitennoDir, resolvedProjectRoot, paths);
  initializeDaemonInfrastructure(ctx);

  const startedAt = Date.now();
  setupIpcServer(ctx, startedAt);
  initializeDaemonEngines(ctx, resolvedProjectRoot);

  const verifyAllPendingPlans = createVerifyAllPendingPlans(shitennoDir, resolvedProjectRoot, paths.logPath);
  setImmediate(() => runStartupScan(ctx, verifyAllPendingPlans));

  const runPeriodicAuditFn = () => runPeriodicAudit(ctx);
  const logEvents = subscribeAllEvents(ctx, verifyAllPendingPlans, runPeriodicAuditFn);
  const timers = setupPeriodicTimers(ctx);
  const initialFullAuditTimer = scheduleInitialFullAudit(ctx);

  // Import circuit breaker dynamically to avoid circular deps
  const { DaemonCircuitBreaker } = await import("../daemon-circuit-breaker.js");
  const breaker = new DaemonCircuitBreaker(shitennoDir);
  const stableTimer = setTimeout(() => {
    breaker.reset();
    daemonLog(ctx.logPath, "INFO", "Stable uptime reached — circuit breaker reset");
  }, DaemonCircuitBreaker.stableUptimeMs);

  const checkNagTimer = scheduleCheckNag(ctx);

  const shutdownTimers: ShutdownTimers = { stableTimer, checkNagTimer, initialFullAuditTimer, ...timers };
  setupShutdown(ctx, shutdownTimers);

  daemonLog(ctx.logPath, "INFO", `Daemon ready — consuming ${logEvents.length + 8} event types`);
}
