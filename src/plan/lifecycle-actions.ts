/**
 * plan/lifecycle-actions.ts — Plan lifecycle action handlers
 *
 * Extracted from plan-lifecycle.ts to keep modules focused.
 */

import chalk from "chalk";
import { createInterface } from "node:readline";
import type { LifecycleResult } from "../plan-lifecycle.js";
import { MarkdownPlanEngine } from "../markdown-plan-engine.js";
import { runAutoVerification } from "./verification.js";

interface LifecycleActionContext {
  shitennoDir: string;
  projectRoot: string;
  planId: string;
  action: "check" | "done" | "archive" | "remove" | "status";
  auto?: boolean;
  force?: boolean;
}

function askQuestion(query: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(query, (ans) => { rl.close(); resolve(ans.trim()); }));
}

export async function executePlanAction(ctx: LifecycleActionContext): Promise<void> {
  const engine = new MarkdownPlanEngine(ctx.shitennoDir);
  const plans = engine.listAll();
  const plan = plans.find((p) => p.id === ctx.planId);
  if (!plan) {
    const { outputError } = await import("../output.js");
    outputError(`Plan not found: ${ctx.planId}`);
    return;
  }
  if (ctx.auto) {
    handleAutoMode(ctx);
  } else {
    await handleInteractiveMode(ctx);
  }
}

export function handleAutoMode(ctx: LifecycleActionContext): boolean {
  const record = runAutoVerification(ctx.shitennoDir, ctx.projectRoot, ctx.planId);
  // runAutoVerification already handles status update + archiving
  return record.passed;
}

export async function handleInteractiveMode(ctx: LifecycleActionContext): Promise<void> {
  const engine = new MarkdownPlanEngine(ctx.shitennoDir);
  const plans = engine.listAll();
  const plan = plans.find((p) => p.id === ctx.planId);
  if (!plan) return;    const { output, outputBlank } = await import("../output.js");
    output(chalk.bold(`  Plan: ${plan.title}`));
  outputBlank();
  const answer = await askQuestion("  Mark as done? (y/n): ");
  if (answer.toLowerCase() === "y") {
    engine.updateStatus(ctx.planId, "done");
    output(chalk.green("  ✔ Plan marked as done."));
  } else {
    output(chalk.gray("  No changes made."));
  }
}

export async function runLifecycleReview(
  shitennoDir: string,
  projectRoot: string,
): Promise<LifecycleResult> {
  const engine = new MarkdownPlanEngine(shitennoDir);
  const plans = engine.listAll().filter((p) => p.isActive && p.status === "check");
  let checked = 0;
  let archived = 0;
  const archivedIds: string[] = [];
  for (const plan of plans) {
    checked++;
    // runAutoVerification already handles status update + archiving
    const record = runAutoVerification(shitennoDir, projectRoot, plan.id);
    if (record.passed) {
      archived++;
      archivedIds.push(plan.id);
    }
  }
  return { checked, archived, archivedIds, active: true };
}
