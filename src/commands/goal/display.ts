import chalk from "chalk";
import { output, outputBlank, outputSection } from "../../output.js";
import type { Goal, GoalStatus, GoalPriority } from "../../prioritization/goals.js";

export const STATUS_COLORS: Record<GoalStatus, (s: string) => string> = {
  draft: (s) => chalk.gray(s),
  active: (s) => chalk.cyan(s),
  completed: (s) => chalk.green(s),
  abandoned: (s) => chalk.red(s),
};

export const PRIORITY_COLORS: Record<GoalPriority, (s: string) => string> = {
  low: (s) => chalk.gray(s),
  medium: (s) => chalk.yellow(s),
  high: (s) => chalk.hex("#FF8800")(s),
  critical: (s) => chalk.red.bold(s),
};

export function progressBar(pct: number): string {
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  return chalk.cyan("█".repeat(filled)) + chalk.dim("░".repeat(empty)) + ` ${pct}%`;
}

export function formatGoal(goal: { id: string; title: string; status: GoalStatus; priority: GoalPriority; progress: number; targets: string[] }): string {
  const status = STATUS_COLORS[goal.status](goal.status.padEnd(10));
  const priority = PRIORITY_COLORS[goal.priority](goal.priority.padEnd(8));
  const bar = progressBar(goal.progress);
  const targets = goal.targets.length > 0 ? chalk.dim(` [${goal.targets.join(", ")}]`) : "";
  return `  ${chalk.bold(goal.id)}  ${status}  ${priority}  ${bar}  ${goal.title}${targets}`;
}

export function displayGoalList(goals: Goal[]): void {
  outputBlank();
  if (goals.length === 0) {
    output(chalk.dim("  No goals found. Create one with: shugo goal create \"<title>\""));
  } else {
    outputSection(`Goals (${goals.length})`);
    output(chalk.dim("  " + "─".repeat(70)));
    for (const goal of goals) {
      output(formatGoal(goal));
    }
  }
  outputBlank();
}

export function displayGoalDetail(goal: Goal): void {
  outputBlank();
  output(chalk.bold(`  ${goal.id}`));
  output(`  ${goal.title}`);
  if (goal.description) output(`  ${chalk.dim(goal.description)}`);
  outputBlank();
  output(`  Status:     ${STATUS_COLORS[goal.status](goal.status)}`);
  output(`  Priority:   ${PRIORITY_COLORS[goal.priority](goal.priority)}`);
  output(`  Progress:   ${progressBar(goal.progress)}`);
  if (goal.targets.length > 0) output(`  Targets:    ${goal.targets.join(", ")}`);
  if (goal.criteria.length > 0) output(`  Criteria:   ${goal.criteria.join(", ")}`);
  if (goal.tags.length > 0) output(`  Tags:       ${goal.tags.join(", ")}`);
  if (goal.parentId) output(`  Parent:     ${goal.parentId}`);
  output(`  Created:    ${goal.createdAt}`);
  output(`  Updated:    ${goal.updatedAt}`);
  if (goal.completedAt) output(`  Completed:  ${goal.completedAt}`);
  outputBlank();
}

export function displayGoalStats(stats: { total: number; byStatus: Record<GoalStatus, number>; byPriority: Record<GoalPriority, number>; avgProgress: number }): void {
  outputBlank();
  outputSection("Goal Statistics");
  output(chalk.dim("  " + "─".repeat(40)));
  output(`  Total:     ${stats.total}`);
  output(`  Avg Progress: ${stats.avgProgress}%`);
  outputBlank();
  outputSection("By Status:");
  for (const [status, count] of Object.entries(stats.byStatus)) {
    if (count > 0) output(`    ${STATUS_COLORS[status as GoalStatus](status)}: ${count}`);
  }
  outputBlank();
  outputSection("By Priority:");
  for (const [priority, count] of Object.entries(stats.byPriority)) {
    if (count > 0) output(`    ${PRIORITY_COLORS[priority as GoalPriority](priority)}: ${count}`);
  }
  outputBlank();
}
