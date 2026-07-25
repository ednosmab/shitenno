/**
 * daemon/timers.ts — Timer management, audit scheduling, and periodic tasks
 *
 * Extracted from daemon/index.ts to keep modules focused.
 */

import { getEventBus } from "../event-bus.js";
import { MarkdownPlanEngine } from "../markdown-plan-engine.js";
import { auditHealth } from "../health-auditor.js";
import { isLargeCommit } from "./startup-scan.js";
import { recordEvent, persistState } from "./state.js";
import { runSemanticCycle } from "./semantic-runner.js";
import { daemonLog } from "./log-rotation.js";
import type { DaemonContext } from "./pid-manager.js";

// ── Audit Helpers ───────────────────────────────────────────────────────────

export function getAuditIntervalMs(ctx: DaemonContext): number {
  const score = ctx.state.health?.score ?? 50;
  if (score > 70) return 6 * 60 * 60 * 1000;
  return 4 * 60 * 60 * 1000;
}

export function getAuditLevel(ctx: DaemonContext): "quick" | "standard" | "code-review" {
  const score = ctx.state.health?.score ?? 50;
  if (score > 70) return "quick";
  if (score >= 40) return "standard";
  return "code-review";
}

export async function runPeriodicAudit(ctx: DaemonContext): Promise<void> {
  try {
    const level = getAuditLevel(ctx);
    const report = await auditHealth(ctx.projectRoot, ctx.shitennoDir, level);

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

// ── Consolidation Timer ─────────────────────────────────────────────────────

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

// ── Audit Timer ─────────────────────────────────────────────────────────────

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

// ── Periodic Timers ─────────────────────────────────────────────────────────

export function setupPeriodicTimers(
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

// ── Check Nag ───────────────────────────────────────────────────────────────

export function scheduleCheckNag(ctx: DaemonContext): NodeJS.Timeout {
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
