/**
 * plan/management.ts — Plan archiving, removal, and detection
 *
 * Extracted from plan-lifecycle.ts to keep modules focused.
 */

import { existsSync, readFileSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MarkdownPlanEngine } from "../markdown-plan-engine.js";
import type { MarkdownPlan } from "../markdown-plan-engine.js";
import type { ValidationResult } from "../plan-lifecycle.js";

export function detectActivePlans(shitennoDir: string): MarkdownPlan[] {
  const plansDir = join(shitennoDir, "governance", "plans");
  if (!existsSync(plansDir)) return [];
  const engine = new MarkdownPlanEngine(shitennoDir);
  return engine.listAll().filter((p: MarkdownPlan) => p.isActive);
}

export function archivePlan(shitennoDir: string, planId: string, validation?: ValidationResult): boolean {
  const plansDir = join(shitennoDir, "governance", "plans");
  const doneDir = join(plansDir, "done");
  if (!existsSync(doneDir)) mkdirSync(doneDir, { recursive: true });

  const planFile = join(plansDir, `${planId}.md`);
  if (!existsSync(planFile)) return false;

  const doneFile = join(doneDir, `${planId}.md`);
  const content = readFileSync(planFile, "utf-8");
  const archivedContent = content.replace(/\*\*Status:\*\*\s*\w+/, "**Status:** Done");
  writeFileSync(doneFile, archivedContent, "utf-8");
  unlinkSync(planFile);

  if (validation) {
    const verificationFile = join(doneDir, `${planId}.verification.json`);
    writeFileSync(verificationFile, JSON.stringify({ ...validation, verifiedAt: new Date().toISOString() }, null, 2), "utf-8");
  }

  return true;
}

export function removePlan(shitennoDir: string, planId: string): boolean {
  const plansDir = join(shitennoDir, "governance", "plans");
  const planFile = join(plansDir, `${planId}.md`);
  if (!existsSync(planFile)) return false;
  unlinkSync(planFile);
  return true;
}

export function checkAndArchiveDonePlans(shitennoDir: string): { checked: number; archived: number; archivedIds: string[] } {
  const plansDir = join(shitennoDir, "governance", "plans");
  if (!existsSync(plansDir)) return { checked: 0, archived: 0, archivedIds: [] };

  const engine = new MarkdownPlanEngine(shitennoDir);
  const plans = engine.listAll().filter((p: MarkdownPlan) => p.isActive && p.status === "done");
  let archived = 0;
  const archivedIds: string[] = [];

  for (const plan of plans) {
    if (archivePlan(shitennoDir, plan.id)) {
      archived++;
      archivedIds.push(plan.id);
    }
  }

  return { checked: plans.length, archived, archivedIds };
}
