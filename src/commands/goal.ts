/**
 * goal.ts — Goal Management CLI Command
 *
 * The `shugo goal` command. CRUD operations for governance goals.
 */

import { Command } from "commander";
import chalk from "chalk";

import { guardNotInitialized } from "../shared.js";
import { GoalEngine, type Goal, type GoalStatus, type GoalPriority, FileGoalRepository } from "../prioritization/goals.js";
import { printDaemonBanner } from "../daemon-context-banner.js";
import { outputJson } from "../formatting.js";
import { SHITENNO_DIR_NAME } from "../constants.js";
import { output, outputBlank, outputSuccess, outputError, outputWarning } from "../output.js";
import { formatGoal, displayGoalList, displayGoalDetail, displayGoalStats } from "./goal/display.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function getEngine(dir: string): GoalEngine {
  const shitennoDir = join(dir, SHITENNO_DIR_NAME);
  return new GoalEngine(new FileGoalRepository(shitennoDir));
}

function join(...paths: string[]): string {
  return paths.reduce((a, b) => {
    const sep = a.endsWith("/") || a.endsWith("\\") ? "" : "/";
    return a + sep + b;
  });
}

function resolveGoalContext(opts: Record<string, unknown>, isJson: boolean) {
  const ctx = guardNotInitialized(opts, isJson);
  if (!ctx) return null;
  void printDaemonBanner(ctx.shitennoDir, isJson);
  return { engine: getEngine(ctx.projectRoot), projectRoot: ctx.projectRoot };
}

function handleGoalError(isJson: boolean, jsonMsg: string, humanMsg: string): void {
  if (isJson) {
    outputJson({ error: jsonMsg });
  } else {
    outputError(humanMsg);
  }
}

function handleGoalUpdate(id: string, opts: Record<string, unknown>, engine: GoalEngine, projectRoot: string): { goal?: Goal; error?: string } {
  let goal = engine.get(id);
  if (!goal) return { error: "Goal not found" };

  if (opts.progress !== undefined) {
    const pct = parseInt(opts.progress as string, 10);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return { error: "Progress must be between 0 and 100" };
    }
    goal = engine.updateProgress(id, pct);
  }

  if (opts.title) {
    goal!.title = opts.title as string;
    goal!.updatedAt = new Date().toISOString();
    const repo = new FileGoalRepository(join(projectRoot, SHITENNO_DIR_NAME));
    repo.save(goal!);
  }
  return { goal };
}

async function handleCreateGoal(title: string, opts: Record<string, unknown>): Promise<void> {
  const isJson = opts.json === true;
  const rc = resolveGoalContext(opts, isJson);
  if (!rc) return;

  const goal = rc.engine.create({
    title,
    description: opts.description as string,
    priority: (opts.priority as GoalPriority) ?? "medium",
    targets: opts.target ? (opts.target as string).split(",").map((s) => s.trim()) : [],
    criteria: opts.criteria ? (opts.criteria as string).split(",").map((s) => s.trim()) : [],
    tags: opts.tag ? (opts.tag as string).split(",").map((s) => s.trim()) : [],
    parentId: opts.parent as string,
  });

  if (isJson) {
    outputJson(goal as unknown as Record<string, unknown>);
  } else {
    outputBlank();
    outputSuccess(`Goal created: ${chalk.bold(goal.id)}`);
    output(`    ${goal.title}`);
    outputBlank();
  }
}

async function handleListGoals(opts: Record<string, unknown>): Promise<void> {
  const isJson = opts.json === true;
  const rc = resolveGoalContext(opts, isJson);
  if (!rc) return;

  const goals = rc.engine.list({
    status: opts.status as GoalStatus,
    priority: opts.priority as GoalPriority,
    target: opts.target as string,
    tag: opts.tag as string,
  });

  if (isJson) {
    outputJson(goals as unknown as Record<string, unknown>);
    return;
  }
  displayGoalList(goals);
}

async function handleShowGoal(id: string, opts: Record<string, unknown>): Promise<void> {
  const isJson = opts.json === true;
  const rc = resolveGoalContext(opts, isJson);
  if (!rc) return;

  const goal = rc.engine.get(id);
  if (!goal) {
    handleGoalError(isJson, "Goal not found", `Goal not found: ${id}`);
    return;
  }

  if (isJson) {
    outputJson(goal as unknown as Record<string, unknown>);
    return;
  }
  displayGoalDetail(goal);
}

async function handleUpdateGoal(id: string, opts: Record<string, unknown>): Promise<void> {
  const isJson = opts.json === true;
  const rc = resolveGoalContext(opts, isJson);
  if (!rc) return;

  const result = handleGoalUpdate(id, opts, rc.engine, rc.projectRoot);
  if (result.error) {
    const isNotFound = result.error === "Goal not found";
    handleGoalError(
      isJson,
      result.error,
      isNotFound ? `Goal not found: ${id}` : result.error,
    );
    return;
  }

  if (isJson) {
    outputJson(result.goal as unknown as Record<string, unknown>);
  } else {
    outputSuccess(`Goal updated: ${result.goal!.id}`);
    output(`    ${formatGoal(result.goal!)}`);
  }
}

async function handleActivateGoal(id: string, opts: Record<string, unknown>): Promise<void> {
  const isJson = opts.json === true;
  const rc = resolveGoalContext(opts, isJson);
  if (!rc) return;

  const goal = rc.engine.activate(id);
  if (!goal) {
    handleGoalError(isJson, "Goal not found or not in draft status", `Cannot activate goal: ${id} (not found or not in draft status)`);
    return;
  }

  if (isJson) {
    outputJson(goal as unknown as Record<string, unknown>);
  } else {
    outputSuccess(`Goal activated: ${goal.id}`);
  }
}

async function handleCompleteGoal(id: string, opts: Record<string, unknown>): Promise<void> {
  const isJson = opts.json === true;
  const rc = resolveGoalContext(opts, isJson);
  if (!rc) return;

  const goal = rc.engine.complete(id);
  if (!goal) {
    handleGoalError(isJson, "Goal not found or not active", `Cannot complete goal: ${id} (not found or not active)`);
    return;
  }

  if (isJson) {
    outputJson(goal as unknown as Record<string, unknown>);
  } else {
    outputSuccess(`Goal completed: ${goal.id}`);
  }
}

async function handleAbandonGoal(id: string, opts: Record<string, unknown>): Promise<void> {
  const isJson = opts.json === true;
  const rc = resolveGoalContext(opts, isJson);
  if (!rc) return;

  const goal = rc.engine.abandon(id);
  if (!goal) {
    handleGoalError(isJson, "Goal not found or already completed", `Cannot abandon goal: ${id}`);
    return;
  }

  if (isJson) {
    outputJson(goal as unknown as Record<string, unknown>);
  } else {
    outputWarning(`Goal abandoned: ${goal.id}`);
  }
}

async function handleStatsGoal(opts: Record<string, unknown>): Promise<void> {
  const isJson = opts.json === true;
  const rc = resolveGoalContext(opts, isJson);
  if (!rc) return;

  const stats = rc.engine.stats();
  if (isJson) {
    outputJson(stats as unknown as Record<string, unknown>);
    return;
  }
  displayGoalStats(stats);
}

async function handleDeleteGoal(id: string, opts: Record<string, unknown>): Promise<void> {
  const isJson = opts.json === true;
  const rc = resolveGoalContext(opts, isJson);
  if (!rc) return;

  const deleted = rc.engine.delete(id);
  if (!deleted) {
    handleGoalError(isJson, "Goal not found", `Goal not found: ${id}`);
    return;
  }

  if (isJson) {
    outputJson({ deleted: true, id });
  } else {
    outputSuccess(`Goal deleted: ${id}`);
  }
}

// ── Command ────────────────────────────────────────────────────────────────

export function goalCommand(): Command {
  const cmd = new Command("goal")
    .description("Manage governance goals")
    .option("-d, --dir <path>", "Project directory");

  cmd.command("create").description("Create a new goal")
    .argument("<title>", "Goal title")
    .option("--description <text>", "Goal description")
    .option("--priority <level>", "Priority: low, medium, high, critical", "medium")
    .option("--target <targets>", "Comma-separated capability targets")
    .option("--criteria <criteria>", "Comma-separated success criteria")
    .option("--tag <tags>", "Comma-separated tags")
    .option("--parent <id>", "Parent goal ID")
    .option("--json", "Output as JSON")
    .action(handleCreateGoal);

  cmd.command("list").description("List goals")
    .option("--status <status>", "Filter by status")
    .option("--priority <priority>", "Filter by priority")
    .option("--target <target>", "Filter by target capability")
    .option("--tag <tag>", "Filter by tag")
    .option("--json", "Output as JSON")
    .action(handleListGoals);

  cmd.command("show").description("Show goal details")
    .argument("<id>", "Goal ID")
    .option("--json", "Output as JSON")
    .action(handleShowGoal);

  cmd.command("update").description("Update goal progress")
    .argument("<id>", "Goal ID")
    .option("--progress <pct>", "Progress percentage (0-100)")
    .option("--title <title>", "Update title")
    .option("--description <text>", "Update description")
    .option("--priority <level>", "Update priority")
    .option("--json", "Output as JSON")
    .action(handleUpdateGoal);

  cmd.command("activate").description("Activate a goal (draft → active)")
    .argument("<id>", "Goal ID").option("--json", "Output as JSON")
    .action(handleActivateGoal);

  cmd.command("complete").description("Complete a goal (active → completed)")
    .argument("<id>", "Goal ID").option("--json", "Output as JSON")
    .action(handleCompleteGoal);

  cmd.command("abandon").description("Abandon a goal")
    .argument("<id>", "Goal ID").option("--json", "Output as JSON")
    .action(handleAbandonGoal);

  cmd.command("stats").description("Show goal statistics")
    .option("--json", "Output as JSON")
    .action(handleStatsGoal);

  cmd.command("delete").description("Delete a goal")
    .argument("<id>", "Goal ID").option("--json", "Output as JSON")
    .action(handleDeleteGoal);

  return cmd;
}
