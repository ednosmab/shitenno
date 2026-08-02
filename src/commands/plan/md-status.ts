/**
 * plan md status — Update markdown plan status.
 */

import chalk from "chalk";
import { join } from "node:path";
import { guardNotInitialized } from "../../shared.js";
import { SHITENNO_DIR_NAME } from "../../constants.js";
import { MarkdownPlanEngine, type MarkdownPlanStatus, type MarkdownPlan } from "../../markdown-plan-engine.js";
import { outputJson } from "../../formatting.js";
import { output } from "../../output.js";

export const VALID_PLAN_STATUSES: MarkdownPlanStatus[] = ["andamento", "parado", "check", "done", "refused"];

export interface PlanStatusResult {
  success: boolean;
  error?: string;
  updated?: MarkdownPlan;
}

/**
 * Lógica pura do comando `plan status` — sem I/O de terminal, sem commander.
 * Testável diretamente, em processo, sem spawnar subprocesso.
 */
export function handlePlanStatus(
  shitennoDir: string,
  id: string,
  status: string
): PlanStatusResult {
  if (!VALID_PLAN_STATUSES.includes(status as MarkdownPlanStatus)) {
    return { success: false, error: `Invalid status: ${status}. Must be: ${VALID_PLAN_STATUSES.join(", ")}` };
  }

  const engine = new MarkdownPlanEngine(shitennoDir);
  try {
    const updated = engine.updateStatus(id, status as MarkdownPlanStatus);
    return { success: true, updated };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function registerMdStatus(cmd: import("commander").Command) {
  cmd
    .command("status")
    .description("Update markdown plan status")
    .argument("<id>", "Plan ID")
    .argument("<status>", "New status: andamento, parado, check, done, refused")
    .option("--json", "Output as JSON")
    .action((id: string, status: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const shitennoDir = join(ctx.projectRoot, SHITENNO_DIR_NAME);
      const result = handlePlanStatus(shitennoDir, id, status);

      if (isJson) {
        if (result.error) outputJson({ error: result.error });
        else outputJson(result.updated as unknown as Record<string, unknown>);
      } else if (result.success) {
        output(chalk.green(`  ✓ Plan status updated: ${id} → ${status}`));
        if (status === "done") output(chalk.dim(`    Moved to done/ directory`));
      } else {
        output(chalk.red(`  ${result.error}`));
      }
    });
}
