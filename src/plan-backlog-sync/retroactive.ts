/**
 * plan-backlog-sync/retroactive.ts — Retroactive scan for plans without BACKLOG entries
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getEventBus } from "../event-bus.js";
import { logger } from "../logger.js";
import { addImpediment } from "../context-buffer-writer.js";
import { acquireScanLock, releaseScanLock } from "../plan-backlog-sync-lock.js";
import { shouldSkipScan, markScanRun } from "../plan-backlog-sync-cooldown.js";

/**
 * Retroactive scan: process plans that exist but have no BACKLOG entry.
 */
export function retroactivePrepare(
  bus: ReturnType<typeof getEventBus>,
  projectRoot: string,
  shitennoDir: string,
  planId: string,
): Promise<void> {
  return import("../commands/plan.js")
    .then(({ runPrepare }) => runPrepare(projectRoot, shitennoDir, planId))
    .then((results) => {
      const done = results.filter((r) => r.status === "done").length;
      const errors = results.filter((r) => r.status === "error").length;
      logger.info("plan-backlog-sync", `Retroactive prepare ${planId}: ${done} done, ${errors} errors`);
      bus.publish("backlog.updated", { planId, stepsCount: done, errorCount: errors, source: "retroactive_scan" });
      if (errors > 0) {
        addImpediment(shitennoDir, {
          description: `Retroactive sync failed for ${planId}: ${errors} errors`,
          priority: "high",
          createdAt: new Date().toISOString(),
          category: "plan_sync",
        });
      }
    })
    .catch((err) => {
      logger.error("plan-backlog-sync", `Retroactive prepare failed for ${planId}: ${err}`);
      addImpediment(shitennoDir, {
        description: `Retroactive prepare crashed for ${planId}: ${String(err)}`,
        priority: "high",
        createdAt: new Date().toISOString(),
        category: "plan_sync",
      });
    });
}

export function runRetroactiveScan(projectRoot: string, shitennoDir: string): void {
  const bus = getEventBus();
  const plansDir = join(shitennoDir, "governance", "plans");

  if (existsSync(plansDir) && !shouldSkipScan(shitennoDir) && acquireScanLock(shitennoDir)) {
    markScanRun(shitennoDir);
    const scanPromises: Promise<void>[] = [];

    const backlogPath = join(shitennoDir, "docs", "backlog", "ACTIVE.md");
    const backlog = existsSync(backlogPath) ? readFileSync(backlogPath, "utf-8") : "";

    const planFiles = readdirSync(plansDir).filter(
      (f) =>
        f.endsWith(".md") &&
        !f.startsWith("TEMPLATE") &&
        !f.startsWith("README") &&
        !f.includes("/done/") &&
        !f.includes("/reference/")
    );

    for (const file of planFiles) {
      const planId = file.replace(".md", "");
      const planIdUpper = `BACKLOG-${planId.toUpperCase().replace(/-/g, "_")}`;
      const hasBacklogEntry = backlog.includes(planIdUpper);
      const hasStepsSection = backlog.includes("#### Passos do Plano");

      if (!hasBacklogEntry || (hasBacklogEntry && !hasStepsSection)) {
        const reason = !hasBacklogEntry ? "no BACKLOG entry" : "no steps section";
        logger.info("plan-backlog-sync", `Retroactive scan: processing ${planId} (${reason})`);
        scanPromises.push(retroactivePrepare(bus, projectRoot, shitennoDir, planId));
      }
    }

    Promise.allSettled(scanPromises).finally(() => releaseScanLock(shitennoDir));
  } else if (existsSync(plansDir)) {
    logger.debug("plan-backlog-sync", "Retroactive scan skipped (cooldown activo ou lock detido por outro processo)");
  }
}
