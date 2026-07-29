/**
 * desktop-notifier.ts — Smart Desktop Notifications for Shugo
 *
 * Subscribes to lifecycle events and sends desktop notifications
 * with intelligent rate limiting:
 *
 * 1. GLOBAL COOLDOWN: 60s between ANY notification (not per-key)
 * 2. PRIORITY BY SEVERITY: high/critical bypass cooldown, low never notifies
 * 3. BROAD SCOPE: Covers challenges, drift, task completion, session end
 * 4. PERSISTENT LOG: All notifications logged to notifications.jsonl
 *
 * PRINCIPLE: Notifications inform, never interrupt.
 */

import { getEventBus } from "./event-bus.js";
import { sendDesktopNotification, logNotificationOnly } from "./notify.js";
import { logger } from "./logger.js";

// ── Configuration ────────────────────────────────────────────────────────

const GLOBAL_COOLDOWN_MS = 60_000;    // 60s between ANY notification
const MIN_SESSION_DURATION_MS = 60_000; // Ignore sessions shorter than 60s

// ── State ────────────────────────────────────────────────────────────────

let lastGlobalNotification = 0;
let initialized = false;
let sharedShitennoDir = "";

export function _resetForTesting(): void {
  initialized = false;
  sharedShitennoDir = "";
  lastGlobalNotification = 0;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function canNotify(): boolean {
  const now = Date.now();
  return now - lastGlobalNotification >= GLOBAL_COOLDOWN_MS;
}

function throttledNotify(
  key: string,
  title: string,
  message: string,
  priority: "high" | "medium" | "low" = "medium",
): void {
  // Low priority never notifies via desktop — log only
  if (priority === "low") {
    if (sharedShitennoDir) {
      logNotificationOnly(sharedShitennoDir, title, message, "low");
    }
    getEventBus().publish("notification.throttled", { key, title, priority, reason: "low_priority" });
    return;
  }

  // High/critical bypass cooldown
  if (priority !== "high" && !canNotify()) {
    const remaining = Math.round(((lastGlobalNotification + GLOBAL_COOLDOWN_MS) - Date.now()) / 1000);
    logger.debug("desktop-notifier", `Throttled: ${key} (${remaining}s remaining)`);
    if (sharedShitennoDir) {
      logNotificationOnly(sharedShitennoDir, title, message, priority);
    }
    getEventBus().publish("notification.throttled", { key, title, priority, reason: "cooldown" });
    return;
  }

  lastGlobalNotification = Date.now();
  if (sharedShitennoDir) {
    sendDesktopNotification(sharedShitennoDir, title, message, priority);
  }
  getEventBus().publish("notification.sent", { key, title, priority });
}

// ── Event Handlers ───────────────────────────────────────────────────────

function handleTaskCompleted(payload: Record<string, unknown>): void {
  const taskId = String(payload.taskId ?? "desconhecida");
  const gatesPassed = payload.gatesPassed ?? payload.gates ?? "?";
  const count = typeof gatesPassed === "number"
    ? gatesPassed
    : Array.isArray(gatesPassed)
      ? gatesPassed.length
      : "?";

  throttledNotify(
    `task:${taskId}:${Date.now()}`,
    "✅ Tarefa Concluída",
    `Tarefa ${taskId} finalizada com sucesso (${count} verificações OK)`,
    "high",
  );
}

function handleSessionEnd(payload: Record<string, unknown>): void {
  const outcome = String(payload.outcome ?? "unknown");
  const durationMs = Number(payload.duration ?? 0);

  if (durationMs > 0 && durationMs < MIN_SESSION_DURATION_MS) {
    logger.debug("desktop-notifier", `Ignored short session: ${Math.round(durationMs / 1000)}s`);
    return;
  }

  const mins = Math.floor(durationMs / 60000);
  const secs = Math.round((durationMs % 60000) / 1000);
  const time = mins > 0 ? `${mins}m${secs}s` : `${secs}s`;

  const statusMap: Record<string, string> = {
    success: "✅ Sessão encerrada",
    failed: "❌ Sessão encerrada com falha",
  };
  const title = statusMap[outcome] ?? "⚠️ Sessão encerrada";

  throttledNotify(`session:${outcome}:${Date.now()}`, title, `Duração: ${time}`, "high");
}

function handleChallengeGenerated(payload: Record<string, unknown>): void {
  const type = String(payload.type ?? "unknown");
  const severity = String(payload.severity ?? "medium");
  const description = String(payload.description ?? "");

  const sevLabel: Record<string, string> = {
    high: "🔴",
    medium: "🟡",
    low: "🔵",
  };
  const icon = sevLabel[severity] ?? "⚪";

  throttledNotify(
    `challenge:${type}:${Date.now()}`,
    `${icon} Proactive Alert`,
    description,
    severity as "high" | "medium" | "low",
  );
}

function handleDriftDetected(payload: Record<string, unknown>): void {
  const filesChanged = Number(payload.filesChanged ?? 0);
  const minutes = Number(payload.minutesSinceLastCommit ?? 0);

  throttledNotify(
    `drift:${Date.now()}`,
    "⚠️ Drift Detected",
    `${filesChanged} files changed, ${minutes} min since last commit`,
    "medium",
  );
}

function handlePlanInconsistency(payload: Record<string, unknown>): void {
  const planId = String(payload.planId ?? "unknown");
  const message = String(payload.message ?? "Plan has inconsistent status");

  throttledNotify(
    `plan:${planId}:${Date.now()}`,
    "⚠️ Plan Inconsistency",
    `${planId}: ${message}`,
    "medium",
  );
}

function handleBriefingGenerated(): void {
  throttledNotify(
    `briefing:${Date.now()}`,
    "📋 Briefing Updated",
    "BRIEFING.md regenerated with fresh project context",
    "low",
  );
}

// ── Initialization ───────────────────────────────────────────────────────

export function initDesktopNotifier(shitennoDir: string): void {
  if (initialized) return;
  initialized = true;
  sharedShitennoDir = shitennoDir;

  const bus = getEventBus();

  // Core lifecycle events
  bus.subscribe("task.completed", handleTaskCompleted);
  bus.subscribe("session.end", handleSessionEnd);

  // Proactive events
  bus.subscribe("challenge.generated", handleChallengeGenerated);
  bus.subscribe("workdir.large_uncommitted_drift", handleDriftDetected);
  bus.subscribe("plan.inconsistency_detected", handlePlanInconsistency);
  bus.subscribe("briefing.generated", handleBriefingGenerated);

  logger.info("desktop-notifier", "Initialized — subscribed to task.completed, session.end, challenge.generated, drift, plan.inconsistency, briefing.generated");
}
