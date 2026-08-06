/**
 * daemon/timers.ts — Timer management, audit scheduling, and periodic tasks
 *
 * Extracted from daemon/index.ts to keep modules focused.
 */

import { execSync } from "node:child_process";
import { getEventBus } from "../infrastructure/event-bus.js";
import { MarkdownPlanEngine } from "../infrastructure/markdown-plan-engine.js";
import { auditHealth } from "../application/health-auditor.js";
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

function getChangedFiles(projectRoot: string): string[] | undefined {
  try {
    const output = execSync("git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 5000,
    });
    const files = output.trim().split("\n").filter(Boolean);
    return files.length > 0 ? files : undefined;
  } catch {
    return undefined;
  }
}

export async function runPeriodicAudit(ctx: DaemonContext, forceFull = false): Promise<void> {
  try {
    const level = getAuditLevel(ctx);
    const changedFiles = forceFull ? undefined : getChangedFiles(ctx.projectRoot);
    const report = await auditHealth(ctx.projectRoot, ctx.shitennoDir, level, changedFiles);

    // "Overall health" only makes sense from a full sweep (large enough
    // denominator to dilute findings). An incremental audit measures something
    // else — issues introduced by the recent changeset — and must not
    // overwrite the same field, or a small delta with clustered severe findings
    // would mathematically zero the health score (PLANO-FINAL-UNICO-HEALTH-SCORES).
    if (!changedFiles || changedFiles.length === 0) {
      ctx.state.health = {
        score: report.healthScore,
        previousScore: ctx.state.health?.score ?? null,
        checkedAt: report.auditedAt,
      };
    } else {
      ctx.state.lastDeltaAudit = {
        changedFilesCount: changedFiles.length,
        newIssueCount: report.issues.length,
        checkedAt: report.auditedAt,
      };
    }

    recordEvent(ctx.state, "health.checked");
    getEventBus().publish("audit.standard", {
      healthScore: report.healthScore,
      issueCount: report.issues.length,
      level,
      timestamp: new Date().toISOString(),
    });
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

/**
 * The interval timer runs FULL sweeps (forceFull) so ctx.state.health always
 * reflects overall health. Event-driven audits (runPeriodicAuditFn without
 * forceFull) remain incremental and populate lastDeltaAudit only.
 */
function setupAuditTimer(ctx: DaemonContext): { timer: NodeJS.Timeout; cleanup: () => void } {
  let timer = setInterval(() => runPeriodicAudit(ctx, true), getAuditIntervalMs(ctx));
  const sub = getEventBus().subscribe("health.checked", () => {
    const newInterval = getAuditIntervalMs(ctx);
    clearInterval(timer);
    timer = setInterval(() => runPeriodicAudit(ctx, true), newInterval);
    daemonLog(ctx.logPath, "DEBUG", `Audit interval recalculated: ${newInterval / 1000}s (score=${ctx.state.health?.score ?? "unknown"})`);
  });
  return { timer, cleanup: () => sub() };
}

// ── Initial Full Sweep ──────────────────────────────────────────────────────

/**
 * Ensure ctx.state.health is seeded shortly after daemon start — otherwise the
 * first full sweep only fires after getAuditIntervalMs (4-6h), leaving the
 * health score null/stale during an active working session.
 */
export function scheduleInitialFullAudit(ctx: DaemonContext): NodeJS.Timeout {
  return setTimeout(() => {
    runPeriodicAudit(ctx, true);
  }, 15_000);
}

// ── Periodic Timers ─────────────────────────────────────────────────────────

export function setupPeriodicTimers(
  ctx: DaemonContext,
): { persistTimer: NodeJS.Timeout; auditTimer: NodeJS.Timeout; consolidationTimer: NodeJS.Timeout; cleanupAudit: () => void } {
  const persistTimer = setInterval(() => {
    persistState(ctx.state, ctx.statePath);
  }, 30_000);

  const consolidationTimer = setupConsolidationTimer(ctx);
  const { timer: auditTimer, cleanup: cleanupAudit } = setupAuditTimer(ctx);

  return { persistTimer, auditTimer, consolidationTimer, cleanupAudit };
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
