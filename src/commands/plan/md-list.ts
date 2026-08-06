/**
 * plan md list — List markdown plans.
 */

import chalk from "chalk";
import { join } from "node:path";
import { guardNotInitialized } from "../../shared/shared.js";
import { SHITENNO_DIR_NAME } from "../../domain/types/constants.js";
import { MarkdownPlanEngine } from "../../infrastructure/markdown-plan-engine.js";
import { outputJson } from "../../shared/formatting.js";
import { output, outputBlank } from "../../shared/output.js";

export function registerMdList(cmd: import("commander").Command) {
  cmd
    .command("list")
    .description("List active markdown plans")
    .option("--done", "Include done plans")
    .option("--json", "Output as JSON")
    .action((opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = new MarkdownPlanEngine(join(ctx.projectRoot, SHITENNO_DIR_NAME));
      let plans = engine.list();
      if (opts.done) plans = [...plans, ...engine.listDone()];

      if (isJson) { outputJson(plans as unknown as Record<string, unknown>); return; }

      if (plans.length === 0) { output(chalk.dim("  No markdown plans found.")); return; }

      outputBlank();
      output(chalk.bold(`  Markdown Plans (${plans.length})`));
      output(chalk.dim("  " + "─".repeat(50)));
      for (const plan of plans) {
        const status = plan.status === "done" ? chalk.green("done") :
                       plan.status === "parado" ? chalk.yellow("parado") : chalk.cyan("andamento");
        output(`  ${chalk.bold(plan.id)}  ${status.padEnd(12)}  ${plan.title}`);
      }
      outputBlank();
    });
}
