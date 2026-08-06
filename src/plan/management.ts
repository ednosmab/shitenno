/**
 * plan/management.ts — Plan archiving, removal, and detection
 *
 * Extracted from plan-lifecycle.ts to keep modules focused.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MarkdownPlanEngine } from "../infrastructure/markdown-plan-engine.js";
import type { MarkdownPlan } from "../infrastructure/markdown-plan-engine.js";
import type { ValidationResult } from "../application/plan-lifecycle.js";

export function detectActivePlans(shitennoDir: string): MarkdownPlan[] {
  const plansDir = join(shitennoDir, "governance", "plans");
  if (!existsSync(plansDir)) return [];
  const engine = new MarkdownPlanEngine(shitennoDir);
  return engine.listAll().filter((p: MarkdownPlan) => p.isActive);
}

export function archivePlan(shitennoDir: string, planId: string, validation?: ValidationResult): boolean {
  const engine = new MarkdownPlanEngine(shitennoDir);
  engine.updateStatus(planId, "done");

  if (validation) {
    const doneDir = join(shitennoDir, "governance", "plans", "done");
    if (!existsSync(doneDir)) mkdirSync(doneDir, { recursive: true });
    const verificationFile = join(doneDir, `${planId}.verification.json`);
    writeFileSync(verificationFile, JSON.stringify({ ...validation, verifiedAt: new Date().toISOString() }, null, 2), "utf-8");
  }

  return true;
}

export function removePlan(shitennoDir: string, planId: string): boolean {
  const engine = new MarkdownPlanEngine(shitennoDir);
  engine.updateStatus(planId, "done");
  return true;
}

export function checkAndArchiveDonePlans(shitennoDir: string): { checked: number; archived: number; archivedIds: string[] } {
  const plansDir = join(shitennoDir, "governance", "plans");
  if (!existsSync(plansDir)) return { checked: 0, archived: 0, archivedIds: [] };

  const engine = new MarkdownPlanEngine(shitennoDir);
  const plans = engine.listAll().filter((p: MarkdownPlan) => p.isActive);
  let archived = 0;
  const archivedIds: string[] = [];

  for (const plan of plans) {
    if (engine.archiveIfDone(plan.id)) {
      archived++;
      archivedIds.push(plan.id);
    }
  }

  return { checked: plans.length, archived, archivedIds };
}
