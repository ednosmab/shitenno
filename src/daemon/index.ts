import { createServer, type Server, type Socket } from "node:net";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  appendFileSync,
  chmodSync,
  readFileSync,
  renameSync,
  statSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getEventBus } from "../event-bus.js";
import { LRUCache } from "../daemon-resources.js";
import type { ResourceClaimedPayload, ResourceReleasedPayload } from "../event-payloads.js";
import { startWatching } from "../infrastructure/persistence/file-watcher.js";
import { checkAndArchiveDonePlans, runAutoVerification } from "../plan-lifecycle.js";
import { acquireVerificationLock, releaseVerificationLock } from "../verification-lock.js";
import { MarkdownPlanEngine } from "../markdown-plan-engine.js";
import { auditHealth } from "../health-auditor.js";
import { DaemonCircuitBreaker } from "../daemon-circuit-breaker.js";
import { logger } from "../logger.js";
import { initializeRuleEngine } from "../rule-engine/engine.js";
import { initializeProactiveEngine } from "../prioritization/triggers.js";
import { initDesktopNotifier } from "../desktop-notifier.js";
import { initAutoBriefing } from "../auto-briefing.js";
import { initProactiveDigest } from "../proactive-digest.js";
import { classifyEvent } from "../semantic/signal-classifier.js";
import { initializeKnowledgeGraph } from "../knowledge-graph.js";
import { killActiveProcesses } from "../exec-async.js";
import { getChangeJournal, resetChangeJournal } from "../semantic/change-journal.js";
import { getPatternMatcher, resetPatternMatcher } from "../semantic/pattern-matcher.js";
import { loadSemanticGrowthProfile } from "../semantic/growth-profile.js";
import { generateInsights, resetSemanticReasoner } from "../semantic/reasoner.js";
import { detectCorrelations, resetSemanticCorrelator } from "../semantic/correlator.js";
import {
  createDaemonState,
  recordEvent,
  persistState,
  loadState,
  MAX_SESSIONS,
} from "./state.js";
import { handleMessage, sendJson, type IpcMessage } from "./ipc.js";
import {
  checkInconsistencies,
  isLargeCommit,
  validateReminders,
  moveCompletedBacklogToDone,
  recoverOrphanSidecars,
} from "./startup-scan.js";

const __dirname_file = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkgPath = join(__dirname_file, "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

const DAEMON_VERSION = getVersion();

export function getPaths(shitennoDir: string) {
  const daemonDir = join(shitennoDir, "daemon");
  return {
    daemonDir,
    pidPath: join(daemonDir, "daemon.pid"),
    sockPath: join(daemonDir, "daemon.sock"),
    logPath: process.env["SHITENNO_DAEMON_LOG"] ?? join(daemonDir, "daemon.log"),
    approvedPath: join(daemonDir, "daemon.approved"),
    statePath: join(daemonDir, "daemon-state.json"),
  };
}

const DEFAULT_MAX_LOG_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_ROTATED_FILES = 3;

let currentLogBytes = 0;

function getLogRotationConfig(): { maxBytes: number; maxFiles: number } {
  const maxBytes = Number(process.env["SHITENNO_DAEMON_LOG_MAX_BYTES"]) || DEFAULT_MAX_LOG_BYTES;
  const maxFiles = Number(process.env["SHITENNO_DAEMON_LOG_MAX_FILES"]) || DEFAULT_MAX_ROTATED_FILES;
  return { maxBytes, maxFiles };
}

function initLogByteCounter(logPath: string): void {
  try {
    currentLogBytes = existsSync(logPath) ? statSync(logPath).size : 0;
  } catch {
    currentLogBytes = 0;
  }
}

function rotateLogIfNeeded(logPath: string): void {
  const { maxBytes, maxFiles } = getLogRotationConfig();
  if (currentLogBytes < maxBytes) return;

  try {
    for (let i = maxFiles - 1; i >= 1; i--) {
      const src = `${logPath}.${i}`;
      const dst = `${logPath}.${i + 1}`;
      if (existsSync(src)) {
        if (i === maxFiles - 1 && existsSync(dst)) unlinkSync(dst);
        renameSync(src, dst);
      }
    }
    renameSync(logPath, `${logPath}.1`);
    currentLogBytes = 0;
  } catch (err) {
    logger.debug("daemon", `Log rotation failed: ${err}`);
  }
}

export function daemonLog(logPath: string, level: string, msg: string): void {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}\n`;
  try {
    rotateLogIfNeeded(logPath);
    appendFileSync(logPath, line, "utf-8");
    currentLogBytes += Buffer.byteLength(line, "utf-8");
  } catch {
    logger.debug("daemon", `Failed to write log: ${msg}`);
  }
}

function cleanup(pidPath: string, sockPath: string): void {
  for (const p of [pidPath, sockPath]) {
    try { if (existsSync(p)) unlinkSync(p); } catch { logger.debug("daemon", `Failed to clean up ${p}`); }
  }
}

interface DaemonContext {
  shitennoDir: string;
  projectRoot: string;
  daemonDir: string;
  pidPath: string;
  sockPath: string;
  logPath: string;
  approvedPath: string;
  statePath: string;
  state: ReturnType<typeof createDaemonState>;
  socket: Server;
  stopProactive: () => void;
  stopWatcher: () => void;
}

function ensureDaemonDir(ctx: DaemonContext): void {
  if (!existsSync(ctx.daemonDir)) {
    mkdirSync(ctx.daemonDir, { recursive: true });
  }
  daemonLog(ctx.logPath, "INFO", `Shugo Daemon v${DAEMON_VERSION} starting — shitennoDir: ${ctx.shitennoDir}`);
  initLogByteCounter(ctx.logPath);
}

function checkDuplicateDaemon(ctx: DaemonContext): void {
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

function writePidAtomically(ctx: DaemonContext): void {
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

function markApproved(ctx: DaemonContext): void {
  if (!existsSync(ctx.approvedPath)) {
    writeFileSync(ctx.approvedPath, new Date().toISOString(), "utf-8");
    daemonLog(ctx.logPath, "INFO", "Daemon marked as approved for auto-start");
  }
}

function cleanupStaleSocket(ctx: DaemonContext): void {
  if (existsSync(ctx.sockPath)) {
    try { unlinkSync(ctx.sockPath); } catch { logger.debug("daemon", "Failed to remove stale socket"); }
  }
}

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

function runVerificationLoop(
  shitennoDir: string,
  resolvedProjectRoot: string,
  logPath: string,
): void {
  const engine = new MarkdownPlanEngine(shitennoDir);
  const pendingCheck = engine.listAll().filter((p) => p.isActive && p.status === "check");

  for (const plan of pendingCheck) {
    try {
      const record = runAutoVerification(shitennoDir, resolvedProjectRoot, plan.id);
      daemonLog(
        logPath,
        record.passed ? "INFO" : "WARN",
        `Auto-verification for ${plan.id}: ${record.passed ? "PASSED → done" : "REFUSED"} — ${
          record.checks.filter((c) => !c.passed).map((c) => `${c.name}: ${c.message}`).join("; ")
        }`
      );
    } catch (err) {
      daemonLog(logPath, "ERROR", `Auto-verification for ${plan.id} failed: ${err}`);
    }
  }

  const archiveResult = checkAndArchiveDonePlans(shitennoDir);
  if (archiveResult.archived > 0) {
    daemonLog(logPath, "INFO", `Auto-archived ${archiveResult.archived} plan(s)`);
  }
}

function createVerifyAllPendingPlans(
  shitennoDir: string,
  resolvedProjectRoot: string,
  logPath: string,
) {
  let verificationInFlight: Promise<void> | null = null;
  let pendingReVerification = false;

  return async function verifyAllPendingPlans(): Promise<void> {
    if (verificationInFlight) {
      pendingReVerification = true;
      return verificationInFlight;
    }

    verificationInFlight = (async () => {
      if (!acquireVerificationLock(shitennoDir)) {
        daemonLog(logPath, "INFO", "Verification already in progress in another process (e.g. close-session) — skipping this round");
        return;
      }

      try {
        do {
          pendingReVerification = false;
          try {
            runVerificationLoop(shitennoDir, resolvedProjectRoot, logPath);
          } catch (err) {
            daemonLog(logPath, "ERROR", `Verification loop failed: ${err}`);
          }
        } while (pendingReVerification);
      } finally {
        releaseVerificationLock(shitennoDir);
      }
    })();

    await verificationInFlight;
    verificationInFlight = null;
  };
}

function runStartupScan(
  ctx: DaemonContext,
  verifyAllPendingPlans: () => Promise<void>,
): void {
  daemonLog(ctx.logPath, "INFO", "Running initial startup scan...");
  const scanStartTime = Date.now();

  try {
    const archiveResult = checkAndArchiveDonePlans(ctx.shitennoDir);
    if (archiveResult.archived > 0) {
      daemonLog(ctx.logPath, "INFO", `Startup scan: archived ${archiveResult.archived} plan(s): ${archiveResult.archivedIds.join(", ")}`);
    }
    recordEvent(ctx.state, "startup_scan.archive_plans");
  } catch (err) {
    daemonLog(ctx.logPath, "ERROR", `Startup scan: checkAndArchiveDonePlans failed: ${err}`);
  }

  try {
    const inconsistencies = checkInconsistencies(ctx.shitennoDir);
    if (inconsistencies.inconsistencies > 0) {
      daemonLog(ctx.logPath, "WARN", `Startup scan: found ${inconsistencies.inconsistencies} inconsistent plan(s)`);
    }
    recordEvent(ctx.state, "startup_scan.check_inconsistencies");
  } catch (err) {
    daemonLog(ctx.logPath, "ERROR", `Startup scan: checkInconsistencies failed: ${err}`);
  }

  try {
    const orphans = recoverOrphanSidecars(ctx.shitennoDir);
    if (orphans.removed > 0) {
      daemonLog(ctx.logPath, "INFO", `Startup scan: removed ${orphans.removed} orphan sidecar(s)`);
    }
    recordEvent(ctx.state, "startup_scan.recover_orphans");
  } catch (err) {
    daemonLog(ctx.logPath, "ERROR", `Startup scan: recoverOrphanSidecars failed: ${err}`);
  }

  try {
    const reminders = validateReminders(ctx.shitennoDir);
    if (reminders.removed > 0) {
      daemonLog(ctx.logPath, "INFO", `Startup scan: removed ${reminders.removed} stale reminder(s)`);
    }
    recordEvent(ctx.state, "startup_scan.validate_reminders");
  } catch (err) {
    daemonLog(ctx.logPath, "ERROR", `Startup scan: validateReminders failed: ${err}`);
  }

  try {
    const backlog = moveCompletedBacklogToDone(ctx.shitennoDir, ctx.shitennoDir);
    if (backlog.moved > 0) {
      daemonLog(ctx.logPath, "INFO", `Startup scan: moved ${backlog.moved} completed backlog item(s)`);
    }
    recordEvent(ctx.state, "startup_scan.move_backlog");
  } catch (err) {
    daemonLog(ctx.logPath, "ERROR", `Startup scan: moveCompletedBacklogToDone failed: ${err}`);
  }

  finalizeStartupScan(ctx, scanStartTime, verifyAllPendingPlans);
}

function finalizeStartupScan(
  ctx: DaemonContext,
  scanStartTime: number,
  verifyAllPendingPlans: () => Promise<void>,
): void {
  try {
    const engine = new MarkdownPlanEngine(ctx.shitennoDir);
    const orphanedCheck = engine.listAll().filter((p) => p.isActive && p.status === "check");
    if (orphanedCheck.length > 0) {
      daemonLog(ctx.logPath, "WARN", `Startup scan: ${orphanedCheck.length} orphaned plan(s) in 'check' — running verification now`);
      verifyAllPendingPlans().catch((err) => daemonLog(ctx.logPath, "ERROR", `Startup scan: orphaned verification promise rejected: ${err}`));
    }
    recordEvent(ctx.state, "startup_scan.verify_orphaned_check");
  } catch (err) {
    daemonLog(ctx.logPath, "ERROR", `Startup scan: orphaned plan verification failed: ${err}`);
  }

  const scanDuration = Date.now() - scanStartTime;
  daemonLog(ctx.logPath, "INFO", `Initial startup scan completed in ${scanDuration}ms`);
  getEventBus().publish("daemon.ready", { pid: process.pid, uptimeMs: scanDuration });
}

function setupResourceArbitration(ctx: DaemonContext): (resourceId: string) => boolean {
  const claimedResources = new LRUCache<string, { sessionId: string; claimedAt: string }>(200, 5 * 60_000);
  const isResourceClaimed = (resourceId: string): boolean => claimedResources.has(resourceId);
  const bus = getEventBus();

  bus.subscribe("resource.claimed", (payload) => {
    const p = payload as unknown as ResourceClaimedPayload;
    if (!p?.resourceId) return;
    claimedResources.set(p.resourceId, { sessionId: p.sessionId, claimedAt: p.timestamp ?? new Date().toISOString() });
    daemonLog(ctx.logPath, "INFO", `Resource claimed by session ${p.sessionId}: ${p.resourceId}`);
  });

  bus.subscribe("resource.released", (payload) => {
    const p = payload as unknown as ResourceReleasedPayload;
    if (!p?.resourceId) return;
    claimedResources.delete(p.resourceId);
    daemonLog(ctx.logPath, "INFO", `Resource released by session ${p.sessionId}: ${p.resourceId}`);
  });

  return isResourceClaimed;
}

function initEngines(ctx: DaemonContext): { stopProactive: () => void; isResourceClaimed: (id: string) => boolean } {
  const isResourceClaimed = setupResourceArbitration(ctx);

  initializeRuleEngine(ctx.projectRoot, ctx.shitennoDir, isResourceClaimed);
  daemonLog(ctx.logPath, "INFO", "Rule engine initialized — subscribed to event bus");

  const stopProactive = initializeProactiveEngine(ctx.projectRoot, ctx.shitennoDir);
  daemonLog(ctx.logPath, "INFO", "Proactive engine initialized — subscribed to event bus");

  initDesktopNotifier(ctx.shitennoDir);
  daemonLog(ctx.logPath, "INFO", "Desktop notifier initialized — subscribed to lifecycle events");

  initAutoBriefing(ctx.projectRoot, ctx.shitennoDir);
  daemonLog(ctx.logPath, "INFO", "Auto-briefing initialized — will generate BRIEFING.md on session start");

  const stopDigest = initProactiveDigest(ctx.shitennoDir);
  daemonLog(ctx.logPath, "INFO", "Proactive digest initialized — periodic summary every 30min");

  // Semantic Layer: Initialize journal and subscribe to events
  const journal = getChangeJournal(ctx.shitennoDir, ctx.state.startedAt);
  const bus = getEventBus();

  // Enable dead letter queue for async error capture
  bus.enableDeadLetterQueue(ctx.shitennoDir);
  daemonLog(ctx.logPath, "INFO", "Dead letter queue enabled — async errors will be captured");

  // Subscribe to all events and classify them into the journal
  const allEventTypes = [
    "session.start", "session.end", "analysis.complete", "command.completed",
    "score.calculated", "pattern.detected", "health.checked", "debt.detected",
    "capability.installed", "capability.unlocked", "maturity.changed",
    "rule.triggered", "evolution.recommended", "adr.created", "skill.created",
    "validation.completed", "task.completed", "pipeline.complete",
    "engineering_state.consolidated", "knowledge_debt.detected",
    "plan.status_changed", "plan.created", "plan.file_changed",
    "source.changed", "source.file_added", "source.file_deleted",
    "git.branch_changed", "git.commit_detected", "git.ref_updated",
    "challenge.generated", "audit.standard",
  ] as const;

  for (const eventType of allEventTypes) {
    bus.subscribe(eventType, (payload) => {
      try {
        const event = { type: eventType, payload, timestamp: new Date().toISOString(), traceId: crypto.randomUUID() };
        const classification = classifyEvent(event);
        const files = Array.isArray((payload as Record<string, unknown>).affectedFiles)
          ? (payload as Record<string, unknown>).affectedFiles as string[]
          : typeof (payload as Record<string, unknown>).file === "string"
            ? [(payload as Record<string, unknown>).file as string]
            : [];
        journal.add(classification, 1, files, [classification.signals[0] ?? "source.changed"]);
      } catch {
        // Classification failure should not break the daemon
      }
    });
  }
  daemonLog(ctx.logPath, "INFO", "Semantic journal initialized — classifying events into journal");

  return { stopProactive: () => { stopProactive(); stopDigest(); }, isResourceClaimed };
}

function handlePlanVerification(
  planId: string,
  verificationDebounce: Map<string, NodeJS.Timeout>,
  verifyAllPendingPlans: () => Promise<void>,
  logPath: string,
): void {
  const existing = verificationDebounce.get(planId);
  if (existing) clearTimeout(existing);
  verificationDebounce.set(
    planId,
    setTimeout(() => {
      verificationDebounce.delete(planId);
      try {
        verifyAllPendingPlans();
      } catch (err) {
        daemonLog(logPath, "ERROR", `Auto-verification for ${planId} failed: ${err}`);
      }
    }, 3000)
  );
}

function onPlanFileChanged(
  ctx: DaemonContext,
  verificationDebounce: Map<string, NodeJS.Timeout>,
  verifyAllPendingPlans: () => Promise<void>,
  runPeriodicAuditFn: () => Promise<void>,
): void {
  recordEvent(ctx.state, "plan.file_changed");
  ctx.state.briefingCache = null;
  ctx.state.riskMapCache = null;
  try {
    const engine = new MarkdownPlanEngine(ctx.shitennoDir);
    const pendingCheck = engine.listAll().filter((p) => p.isActive && p.status === "check");
    for (const plan of pendingCheck) {
      handlePlanVerification(plan.id, verificationDebounce, verifyAllPendingPlans, ctx.logPath);
    }
  } catch (err) {
    daemonLog(ctx.logPath, "ERROR", `checkAndArchiveDonePlans failed: ${err}`);
  }
  runPeriodicAuditFn();
}

function subscribeTier1Events(
  ctx: DaemonContext,
  verifyAllPendingPlans: () => Promise<void>,
  runPeriodicAuditFn: () => Promise<void>,
): void {
  const bus = getEventBus();

  const verificationDebounce = new Map<string, NodeJS.Timeout>();

  bus.subscribe("plan.file_changed", () => {
    onPlanFileChanged(ctx, verificationDebounce, verifyAllPendingPlans, runPeriodicAuditFn);
  });

  bus.subscribe("workdir.large_uncommitted_drift", (payload) => {
    recordEvent(ctx.state, "workdir.large_uncommitted_drift");
    const p = payload as { filesChanged?: number; minutesSinceLastCommit?: number } | undefined;
    ctx.state.drift = {
      filesChanged: p?.filesChanged ?? 0,
      minutesSinceLastCommit: p?.minutesSinceLastCommit ?? 0,
      detectedAt: new Date().toISOString(),
    };
    daemonLog(ctx.logPath, "WARN", `Drift detected: ${ctx.state.drift.filesChanged} files, ${ctx.state.drift.minutesSinceLastCommit} min`);
  });

  bus.subscribe("git.branch_changed", () => {
    recordEvent(ctx.state, "git.branch_changed");
    ctx.state.briefingCache = null;
    ctx.state.riskMapCache = null;
    daemonLog(ctx.logPath, "INFO", "Branch changed — briefing and risk caches invalidated");
  });

  bus.subscribe("task.completed", () => {
    recordEvent(ctx.state, "task.completed");
    try {
      const result = checkAndArchiveDonePlans(ctx.shitennoDir);
      if (result.archived > 0) {
        daemonLog(ctx.logPath, "INFO", `Task completed — auto-archived ${result.archived} plan(s)`);
      }
    } catch (err) {
      daemonLog(ctx.logPath, "ERROR", `task.completed handler failed: ${err}`);
    }
    runPeriodicAuditFn();
  });

  subscribeSessionAndStateTracking(ctx);
}

function subscribeSessionAndStateTracking(ctx: DaemonContext): void {
  const bus = getEventBus();

  bus.subscribe("session.start", (payload) => {
    recordEvent(ctx.state, "session.start");
    const p = payload as { sessionId?: string } | undefined;
    ctx.state.sessions.push({
      id: p?.sessionId ?? `session-${Date.now()}`,
      startedAt: new Date().toISOString(),
    });
    if (ctx.state.sessions.length > MAX_SESSIONS) {
      ctx.state.sessions.shift();
    }
  });

  bus.subscribe("session.end", (payload) => {
    recordEvent(ctx.state, "session.end");
    const p = payload as { sessionId?: string; duration?: number } | undefined;
    const session = ctx.state.sessions.find((s) => !s.endedAt);
    if (session) {
      session.endedAt = new Date().toISOString();
      session.duration = p?.duration ?? Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000);
    }
  });

  bus.subscribe("command.completed", (payload) => {
    recordEvent(ctx.state, "command.completed");
    const p = payload as { command?: string } | undefined;
    ctx.state.lastCommandName = p?.command ?? null;
    ctx.state.lastCommandAt = new Date().toISOString();
  });

  bus.subscribe("health.checked", (payload) => {
    recordEvent(ctx.state, "health.checked");
    const p = payload as { score?: number } | undefined;
    if (p?.score !== undefined) {
      ctx.state.health = { score: p.score, previousScore: ctx.state.health?.score ?? null, checkedAt: new Date().toISOString() };
    }
  });
}

function subscribeTier2Events(ctx: DaemonContext, runPeriodicAuditFn: () => Promise<void>): void {
  const bus = getEventBus();

  bus.subscribe("challenge.generated", (payload) => {
    recordEvent(ctx.state, "challenge.generated");
    const p = payload as { type?: string; severity?: string; message?: string } | undefined;
    ctx.state.challenges.push({
      type: p?.type ?? "unknown",
      severity: p?.severity ?? "medium",
      message: p?.message ?? "",
      generatedAt: new Date().toISOString(),
    });
    if (ctx.state.challenges.length > 20) {
      ctx.state.challenges.shift();
    }
  });

  bus.subscribe("knowledge_debt.detected", (payload) => {
    recordEvent(ctx.state, "knowledge_debt.detected");
    const p = payload as { gapCount?: number; healthScore?: number } | undefined;
    ctx.state.debt = {
      gapCount: p?.gapCount ?? 0,
      healthScore: p?.healthScore ?? 100,
      detectedAt: new Date().toISOString(),
    };
  });

  bus.subscribe("backlog.updated", () => {
    recordEvent(ctx.state, "backlog.updated");
    ctx.state.briefingCache = null;
    ctx.state.riskMapCache = null;
    try {
      const backlog = moveCompletedBacklogToDone(ctx.shitennoDir, ctx.shitennoDir);
      if (backlog.moved > 0) {
        daemonLog(ctx.logPath, "INFO", `backlog.updated: moved ${backlog.moved} completed item(s)`);
      }
    } catch (err) {
      daemonLog(ctx.logPath, "ERROR", `backlog.updated handler failed: ${err}`);
    }
    runPeriodicAuditFn();
  });

  bus.subscribe("plan.inconsistency_detected", (payload) => {
    recordEvent(ctx.state, "plan.inconsistency_detected");
    const p = payload as { planId?: string; message?: string } | undefined;
    daemonLog(ctx.logPath, "WARN", `Plan inconsistency detected: ${p?.planId ?? "unknown"} — ${p?.message ?? ""}`);
  });
}

function subscribeGenericLogEvents(ctx: DaemonContext): string[] {
  const bus = getEventBus();
  const logEvents = [
    "adr.created", "skill.created", "plan.created", "asset.created",
    "asset.updated", "engineering_state.updated", "docs.sync.triggered",
    "backlog.updated", "validation.completed", "pipeline.complete",
    "capability.installed", "maturity.changed", "rule.triggered",
  ] as const;

  for (const evt of logEvents) {
    bus.subscribe(evt, () => {
      recordEvent(ctx.state, evt);
      if (evt === "asset.updated" || evt === "engineering_state.updated" || evt === "docs.sync.triggered") {
        ctx.state.briefingCache = null;
        ctx.state.riskMapCache = null;
      }
    });
  }

  return [...logEvents];
}

function subscribeAllEvents(
  ctx: DaemonContext,
  verifyAllPendingPlans: () => Promise<void>,
  runPeriodicAuditFn: () => Promise<void>,
): string[] {
  subscribeTier1Events(ctx, verifyAllPendingPlans, runPeriodicAuditFn);
  subscribeTier2Events(ctx, runPeriodicAuditFn);
  subscribeGenericLogEvents(ctx);

  // E.1: Track proactive engine and audit state
  const bus = getEventBus();
  bus.subscribe("challenge.generated", () => {
    if (!ctx.state.proactiveEngine) {
      ctx.state.proactiveEngine = { lastCheck: null, challengesTriggered: 0, cooldownUntil: null };
    }
    ctx.state.proactiveEngine.challengesTriggered++;
  });
  bus.subscribe("health.checked", () => {
    if (!ctx.state.proactiveEngine) {
      ctx.state.proactiveEngine = { lastCheck: null, challengesTriggered: 0, cooldownUntil: null };
    }
    ctx.state.proactiveEngine.lastCheck = new Date().toISOString();
  });
  bus.subscribe("audit.standard", () => {
    if (!ctx.state.audit) {
      ctx.state.audit = { lastAuditTime: null, auditCount: 0, notificationsSent: 0 };
    }
    ctx.state.audit.lastAuditTime = new Date().toISOString();
    ctx.state.audit.auditCount++;
  });

  return [];
}

function runSemanticCycle(ctx: DaemonContext): void {
  try {
    const journal = getChangeJournal(ctx.shitennoDir, ctx.state.startedAt);
    const matcher = getPatternMatcher(journal);
    const patterns = matcher.detect();
    if (patterns.length === 0) return;

    daemonLog(ctx.logPath, "INFO", `Semantic pattern matcher: ${patterns.length} pattern(s) detected`);

    const profile = loadSemanticGrowthProfile(ctx.shitennoDir);
    daemonLog(ctx.logPath, "DEBUG", `Semantic growth: capacity=${Math.round(profile.growthCapacity * 100)}%, challenge=${Math.round(profile.challengeLevel * 100)}%, patterns=${profile.semanticChoices.length}`);

    const insights = generateInsights(ctx.shitennoDir, ctx.projectRoot, patterns, journal);
    if (insights.length > 0) {
      daemonLog(ctx.logPath, "INFO", `Semantic reasoner: ${insights.length} insight(s) generated`);
      for (const insight of insights) {
        getEventBus().publish("semantic.insight_detected", {
          insightId: insight.id,
          insightType: insight.type,
          domains: insight.domains,
          priority: insight.priority,
          confidence: insight.confidence,
        });
      }
    }

    const correlations = detectCorrelations(ctx.shitennoDir, ctx.projectRoot, journal);
    if (correlations.length > 0) {
      daemonLog(ctx.logPath, "INFO", `Semantic correlator: ${correlations.length} correlation(s) detected`);
    }
  } catch (err) {
    daemonLog(ctx.logPath, "ERROR", `Semantic pattern matcher failed: ${err}`);
  }
}

function setupConsolidationTimer(ctx: DaemonContext): NodeJS.Timeout {
  return setInterval(() => {
    try {
      getEventBus().publish("engineering_state.consolidated", {});
      runSemanticCycle(ctx);
    } catch (err) {
      daemonLog(ctx.logPath, "ERROR", `Engineering state consolidation failed: ${err}`);
    }
  }, 15 * 60 * 1000);
}

function setupAuditTimer(ctx: DaemonContext, runPeriodicAuditFn: () => Promise<void>): { timer: NodeJS.Timeout; cleanup: () => void } {
  let timer = setInterval(runPeriodicAuditFn, getAuditIntervalMs(ctx));
  const sub = getEventBus().subscribe("health.checked", () => {
    const newInterval = getAuditIntervalMs(ctx);
    clearInterval(timer);
    timer = setInterval(runPeriodicAuditFn, newInterval);
    daemonLog(ctx.logPath, "DEBUG", `Audit interval recalculated: ${newInterval / 1000}s (score=${ctx.state.health?.score ?? "unknown"})`);
  });
  return { timer, cleanup: () => sub() };
}

function setupPeriodicTimers(
  ctx: DaemonContext,
  runPeriodicAuditFn: () => Promise<void>,
): { persistTimer: NodeJS.Timeout; largeCommitTimer: NodeJS.Timeout; auditTimer: NodeJS.Timeout; consolidationTimer: NodeJS.Timeout; cleanupAudit: () => void } {
  const persistTimer = setInterval(() => {
    persistState(ctx.state, ctx.statePath);
  }, 30_000);

  const largeCommitTimer = setInterval(() => {
    try {
      if (isLargeCommit(ctx.shitennoDir, 50)) {
        daemonLog(ctx.logPath, "WARN", `Large commit detected (50+ staged files) — triggering standard audit`);
        runPeriodicAuditFn();
      }
    } catch (err) {
      daemonLog(ctx.logPath, "ERROR", `Large commit check failed: ${err}`);
    }
  }, 5 * 60 * 1000);

  const consolidationTimer = setupConsolidationTimer(ctx);
  const { timer: auditTimer, cleanup: cleanupAudit } = setupAuditTimer(ctx, runPeriodicAuditFn);

  return { persistTimer, largeCommitTimer, auditTimer, consolidationTimer, cleanupAudit };
}

function getAuditIntervalMs(ctx: DaemonContext): number {
  const score = ctx.state.health?.score ?? 50;
  if (score > 70) return 6 * 60 * 60 * 1000;
  return 4 * 60 * 60 * 1000;
}

function getAuditLevel(ctx: DaemonContext): "quick" | "standard" | "code-review" {
  const score = ctx.state.health?.score ?? 50;
  if (score > 70) return "quick";
  if (score >= 40) return "standard";
  return "code-review";
}

async function runPeriodicAudit(ctx: DaemonContext): Promise<void> {
  try {
    const level = getAuditLevel(ctx);
    const report = await auditHealth(ctx.shitennoDir, ctx.shitennoDir, level);

    ctx.state.health = {
      score: report.healthScore,
      previousScore: ctx.state.health?.score ?? null,
      checkedAt: report.auditedAt,
    };

    recordEvent(ctx.state, "health.checked");
    daemonLog(ctx.logPath, "INFO", `Periodic audit (${level}): score=${report.healthScore}/100, ${report.issues.length} issue(s)`);
  } catch (err) {
    daemonLog(ctx.logPath, "ERROR", `Periodic audit failed: ${err}`);
  }
}

function scheduleCheckNag(ctx: DaemonContext): NodeJS.Timeout {
  return setTimeout(() => {
    try {
      const engine = new MarkdownPlanEngine(ctx.shitennoDir);
      const pending = engine.listAll().filter((p) => p.isActive && p.status === "check");
      if (pending.length > 0) {
        daemonLog(ctx.logPath, "WARN", `Check-nag: ${pending.length} plan(s) stuck in 'check': ${pending.map((p) => p.id).join(", ")}`);
      }
    } catch (err) {
      daemonLog(ctx.logPath, "ERROR", `Check-nag failed: ${err}`);
    } finally {
      scheduleCheckNag(ctx);
    }
  }, 30 * 60 * 1000);
}

function setupShutdown(
  ctx: DaemonContext,
  timers: {
    stableTimer: NodeJS.Timeout;
    checkNagTimer: NodeJS.Timeout;
    persistTimer: NodeJS.Timeout;
    auditTimer: NodeJS.Timeout;
    largeCommitTimer: NodeJS.Timeout;
    consolidationTimer: NodeJS.Timeout;
    cleanupAudit: () => void;
  },
): void {
  const shutdown = (signal: string) => {
    daemonLog(ctx.logPath, "INFO", `Received ${signal} — shutting down`);
    clearTimeout(timers.stableTimer);
    clearTimeout(timers.checkNagTimer);
    clearInterval(timers.persistTimer);
    clearInterval(timers.auditTimer);
    clearInterval(timers.largeCommitTimer);
    clearInterval(timers.consolidationTimer);
    timers.cleanupAudit();
    killActiveProcesses();
    releaseVerificationLock(ctx.shitennoDir);
    persistState(ctx.state, ctx.statePath);
    ctx.stopProactive();
    ctx.stopWatcher();
    // Semantic Layer cleanup
    try {
      resetChangeJournal();
      resetPatternMatcher();
      resetSemanticReasoner();
      resetSemanticCorrelator();
    } catch {
      // Cleanup failure should not prevent shutdown
    }
    ctx.socket.close(() => {
      cleanup(ctx.pidPath, ctx.sockPath);
      daemonLog(ctx.logPath, "INFO", "Daemon stopped cleanly");
      process.exit(0);
    });
    setTimeout(() => {
      cleanup(ctx.pidPath, ctx.sockPath);
      process.exit(1);
    }, 5_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

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

export async function runDaemon(shitennoDir: string, projectRoot?: string): Promise<void> {
  const paths = getPaths(shitennoDir);
  const resolvedProjectRoot = projectRoot ?? join(shitennoDir, "..");

  const state = loadState(paths.statePath) ?? createDaemonState();
  state.startedAt = new Date().toISOString();
  daemonLog(paths.logPath, "INFO", `State loaded — ${state.events.length} historical events`);

  const ctx: DaemonContext = {
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

  ensureDaemonDir(ctx);
  checkDuplicateDaemon(ctx);
  writePidAtomically(ctx);
  markApproved(ctx);
  cleanupStaleSocket(ctx);

  const startedAt = Date.now();
  setupIpcServer(ctx, startedAt);

  ctx.stopWatcher = startWatching(shitennoDir, {
    watchSourceCode: process.env.SHITENNO_WATCH_SOURCE === "1",
    projectRoot: resolvedProjectRoot,
    watchGitEvents: process.env.SHITENNO_WATCH_GIT === "1",
  });
  const { stopProactive } = initEngines(ctx);
  ctx.stopProactive = stopProactive;

  // Initialize knowledge graph persistence
  try {
    initializeKnowledgeGraph(ctx.shitennoDir);
    daemonLog(ctx.logPath, "INFO", "Knowledge graph initialized — subscribed to adr/skill/capability events");
  } catch (err) {
    daemonLog(ctx.logPath, "ERROR", `Knowledge graph init failed: ${err}`);
  }

  const verifyAllPendingPlans = createVerifyAllPendingPlans(shitennoDir, resolvedProjectRoot, paths.logPath);
  setImmediate(() => runStartupScan(ctx, verifyAllPendingPlans));

  const runPeriodicAuditFn = () => runPeriodicAudit(ctx);
  const logEvents = subscribeAllEvents(ctx, verifyAllPendingPlans, runPeriodicAuditFn);
  const timers = setupPeriodicTimers(ctx, runPeriodicAuditFn);

  const breaker = new DaemonCircuitBreaker(shitennoDir);
  const stableTimer = setTimeout(() => {
    breaker.reset();
    daemonLog(ctx.logPath, "INFO", "Stable uptime reached — circuit breaker reset");
  }, DaemonCircuitBreaker.stableUptimeMs);

  const checkNagTimer = scheduleCheckNag(ctx);

  setupShutdown(ctx, { stableTimer, checkNagTimer, ...timers });

  daemonLog(ctx.logPath, "INFO", `Daemon ready — consuming ${logEvents.length + 8} event types`);
}
