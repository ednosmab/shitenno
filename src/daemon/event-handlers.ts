/**
 * daemon/event-handlers.ts — Event bus subscriptions for the daemon
 *
 * Extracted from daemon/index.ts to keep modules focused.
 */

import { getEventBus } from "../event-bus.js";
import type { ResourceClaimedPayload, ResourceReleasedPayload } from "../event-payloads.js";
import { LRUCache } from "../daemon-resources.js";
import { checkAndArchiveDonePlans } from "../plan-lifecycle.js";
import { moveCompletedBacklogToDone } from "./startup-scan.js";
import { recordEvent, recordNotificationStat, MAX_SESSIONS } from "./state.js";
import { daemonLog } from "./log-rotation.js";
import type { DaemonContext } from "./pid-manager.js";
import { MarkdownPlanEngine } from "../markdown-plan-engine.js";

// ── Resource Arbitration ────────────────────────────────────────────────────

export function setupResourceArbitration(ctx: DaemonContext): (resourceId: string) => boolean {
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

// ── Tier 1 Events (high priority, trigger re-verification) ──────────────────

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

export function subscribeTier1Events(
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

  bus.subscribe("git.large_commit_detected", (payload) => {
    const p = payload as { count?: number } | undefined;
    recordEvent(ctx.state, "git.large_commit_detected");
    daemonLog(ctx.logPath, "WARN", `Large commit detected (${p?.count ?? "?"} files) — triggering audit`);
    runPeriodicAuditFn();
  });

  subscribeSessionAndStateTracking(ctx);
}

// ── Session & State Tracking ────────────────────────────────────────────────

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

// ── Tier 2 Events (medium priority) ─────────────────────────────────────────

export function subscribeTier2Events(ctx: DaemonContext, runPeriodicAuditFn: () => Promise<void>): void {
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
        // Notify user about completed backlog items
        bus.publish("backlog.updated", { itemId: "batch", movedCount: backlog.moved });
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

// ── Generic Log Events ──────────────────────────────────────────────────────

export function subscribeGenericLogEvents(ctx: DaemonContext): string[] {
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

// ── Subscribe All ───────────────────────────────────────────────────────────

export function subscribeAllEvents(
  ctx: DaemonContext,
  verifyAllPendingPlans: () => Promise<void>,
  runPeriodicAuditFn: () => Promise<void>,
): string[] {
  subscribeTier1Events(ctx, verifyAllPendingPlans, runPeriodicAuditFn);
  subscribeTier2Events(ctx, runPeriodicAuditFn);
  subscribeGenericLogEvents(ctx);

  // Track proactive engine and audit state
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
  bus.subscribe("notification.sent", () => {
    recordNotificationStat(ctx.state, true);
  });
  bus.subscribe("notification.throttled", () => {
    recordNotificationStat(ctx.state, false);
  });

  return [];
}
