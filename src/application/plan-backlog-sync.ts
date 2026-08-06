/**
 * plan-backlog-sync.ts — Plan Checklist ↔ Backlog Sync
 *
 * Provides bidirectional sync between plan checklists and BACKLOG.md.
 * Subscribes to plan.file_changed and plan.archived events.
 *
 * PRINCIPLE: Plan state changes should propagate to BACKLOG.md automatically.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getEventBus } from "../infrastructure/event-bus.js";
import { logger } from "../shared/logger.js";
import { addImpediment, clearImpediments } from "./context-buffer-writer.js";
import { withSyncWriteGuard, isSyncWriteInProgress } from "../domain/rules/sync-write-guard.js";
import { MarkdownPlanEngine, type MarkdownPlanStatus } from "../infrastructure/markdown-plan-engine.js";
import { extractChecklist } from "../plan-backlog-sync/checklist.js";

export { extractChecklist, type ChecklistItem } from "../plan-backlog-sync/checklist.js";
export { retroactivePrepare, runRetroactiveScan } from "../plan-backlog-sync/retroactive.js";

// ── Plan → Backlog Sync ──────────────────────────────────────────────────────

export function syncPlanToBacklog(
  shitennoDir: string,
  planId: string,
  planContent: string
): void {
  const backlogPath = join(shitennoDir, "docs", "backlog", "ACTIVE.md");
  if (!existsSync(backlogPath)) return;

  const backlog = readFileSync(backlogPath, "utf-8");
  const planIdUpper = `BACKLOG-${planId.toUpperCase().replace(/-/g, "_")}`;
  const checklist = extractChecklist(planContent);

  const total = checklist.length;
  const completed = checklist.filter((i) => i.checked).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (backlog.includes(planIdUpper)) {
    const statusRegex = new RegExp(
      `(### ${planIdUpper}[\\s\\S]*?\\| \\*\\*Status\\*\\* \\| )([^|]+)( \\|)`,
      "m"
    );
    const status = percentage === 100 ? "concluído" : percentage > 0 ? "em implementação" : "planeado";
    const statusWithPct = `${status} (${percentage}% — ${completed}/${total})`;

    const updatedBacklog = backlog.replace(statusRegex, `$1${statusWithPct}$3`);
    if (updatedBacklog !== backlog) {
      withSyncWriteGuard(() => writeFileSync(backlogPath, updatedBacklog, "utf-8"));
      logger.info("plan-backlog-sync", `Updated ${planIdUpper}: ${percentage}% complete`);
      getEventBus().publish("backlog.updated", {
        planId, percentage, completed, total, source: "checklist_sync",
      });
    }
  }
}

// ── Backlog → Plan Sync ──────────────────────────────────────────────────────

export function syncBacklogToPlan(
  shitennoDir: string,
  planId: string,
  backlogStatus: string
): void {
  const VERIFICATION_OWNED = new Set(["check", "done", "refused"]);
  const engine = new MarkdownPlanEngine(shitennoDir);
  const plan = engine.getById(planId);
  if (plan && VERIFICATION_OWNED.has(plan.status)) {
    logger.debug("plan-backlog-sync", `Skipping sync for ${planId} — status '${plan.status}' is verification-owned`);
    return;
  }

  const statusMap: Record<string, MarkdownPlanStatus> = {
    "concluído": "done",
    "em implementação": "andamento",
    "pausado": "parado",
    "planeado": "andamento",
    "rejeitado": "refused",
    "blocked": "blocked",
  };

  const planStatus = statusMap[backlogStatus] || "andamento";
  try {
    withSyncWriteGuard(() => {
      markPlanWritten(planId);
      engine.updateStatus(planId, planStatus);
    });
    logger.info("plan-backlog-sync", `Updated plan ${planId} status to ${planStatus}`);
  } catch (error) {
    logger.warn("plan-backlog-sync", `Failed to sync plan ${planId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ── Cooldown per Plan ─────────────────────────────────────────────────────────

const PLAN_WRITE_COOLDOWN_MS = 1000;
const lastPlanWriteTimestamps = new Map<string, number>();

function isWithinPlanCooldown(planId: string): boolean {
  const lastWrite = lastPlanWriteTimestamps.get(planId) ?? 0;
  return Date.now() - lastWrite < PLAN_WRITE_COOLDOWN_MS;
}

function markPlanWritten(planId: string): void {
  lastPlanWriteTimestamps.set(planId, Date.now());
}

// ── Initialization ───────────────────────────────────────────────────────────

let syncInitialized = false;

function onPlanCreated(
  bus: ReturnType<typeof getEventBus>,
  projectRoot: string,
  shitennoDir: string,
  payload: Record<string, unknown>,
): void {
  const planId = payload.planId as string;
  if (!planId) return;
  logger.info("plan-backlog-sync", `Plan created: ${planId} — running auto-prepare`);
  import("../commands/plan.js").then(({ runPrepare }) => {
    runPrepare(projectRoot, shitennoDir, planId).then((results) => {
      const done = results.filter((r) => r.status === "done").length;
      const errors = results.filter((r) => r.status === "error").length;
      logger.info("plan-backlog-sync", `Auto-prepare ${planId}: ${done} done, ${errors} errors`);
      bus.publish("backlog.updated", { planId, stepsCount: done, errorCount: errors, source: "auto_prepare" });
      if (errors === 0) {
        clearImpediments(shitennoDir, planId);
      } else {
        addImpediment(shitennoDir, {
          description: `Sync failed for ${planId}: ${errors} errors during auto-prepare`,
          priority: "high", createdAt: new Date().toISOString(), category: "plan_sync",
        });
      }
    });
  }).catch((err) => {
    logger.error("plan-backlog-sync", `Auto-prepare failed for ${planId}: ${err}`);
    addImpediment(shitennoDir, {
      description: `Auto-prepare crashed for ${planId}: ${String(err)}`,
      priority: "high", createdAt: new Date().toISOString(), category: "plan_sync",
    });
  });
}

function onPlanFileChanged(shitennoDir: string, payload: Record<string, unknown>): void {
  if (isSyncWriteInProgress()) return;
  const planId = payload.planId as string;
  const content = payload.content as string;
  if (!planId || !content) return;
  if (isWithinPlanCooldown(planId)) {
    logger.debug("plan-backlog-sync", `Skipping plan ${planId} — within cooldown`);
    return;
  }
  logger.info("plan-backlog-sync", `Plan changed: ${planId}`);
  syncPlanToBacklog(shitennoDir, planId, content);
  import("../infrastructure/markdown-plan-engine.js").then(({ MarkdownPlanEngine }) => {
    const engine = new MarkdownPlanEngine(shitennoDir);
    const archived = engine.archiveIfDone(planId);
    if (archived) logger.info("plan-backlog-sync", `Auto-archived plan ${planId} → done/`);
  }).catch((err) => {
    logger.debug("plan-backlog-sync", `archiveIfDone skipped for ${planId}: ${err}`);
  });
}

function onPlanArchived(shitennoDir: string, payload: Record<string, unknown>): void {
  if (isSyncWriteInProgress()) return;
  const planId = payload.planId as string;
  if (!planId) return;
  logger.info("plan-backlog-sync", `Plan archived: ${planId}`);
  const planIdUpper = `BACKLOG-${planId.toUpperCase().replace(/-/g, "_")}`;
  const backlogPath = join(shitennoDir, "docs", "backlog", "ACTIVE.md");
  if (existsSync(backlogPath)) {
    let backlog = readFileSync(backlogPath, "utf-8");
    const statusRegex = new RegExp(
      `(### ${planIdUpper}[\\s\\S]*?\\| \\*\\*Status\\*\\* \\| )([^|]+)( \\|)`, "m"
    );
    backlog = backlog.replace(statusRegex, `$1concluído$3`);
    withSyncWriteGuard(() => writeFileSync(backlogPath, backlog, "utf-8"));
  }
}

export function initPlanBacklogSync(projectRoot: string, shitennoDir: string): void {
  if (syncInitialized) return;
  syncInitialized = true;
  const bus = getEventBus();
  bus.subscribe("plan.created", (payload: Record<string, unknown>) => onPlanCreated(bus, projectRoot, shitennoDir, payload));
  bus.subscribe("plan.file_changed", (payload: Record<string, unknown>) => onPlanFileChanged(shitennoDir, payload));
  bus.subscribe("plan.archived", (payload: Record<string, unknown>) => onPlanArchived(shitennoDir, payload));
  logger.info("plan-backlog-sync", "Plan-Backlog sync subscribers initialized");
}
