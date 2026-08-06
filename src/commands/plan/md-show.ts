/**
 * plan md show — Show markdown plan details.
 */

import chalk from "chalk";
import { join } from "node:path";
import { guardNotInitialized } from "../../shared/shared.js";
import { SHITENNO_DIR_NAME } from "../../domain/types/constants.js";
import { MarkdownPlanEngine } from "../../infrastructure/markdown-plan-engine.js";
import { outputJson } from "../../shared/formatting.js";
import { output, outputBlank } from "../../shared/output.js";

export function registerMdShow(cmd: import("commander").Command) {
  cmd
    .command("show")
    .description("Show markdown plan details")
    .argument("<id>", "Plan ID (filename without .md)")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = new MarkdownPlanEngine(join(ctx.projectRoot, SHITENNO_DIR_NAME));
      const plan = engine.getById(id);

      if (!plan) {
        if (isJson) outputJson({ error: "Plan not found" });
        else output(chalk.red(`  Plan not found: ${id}`));
        return;
      }

      if (isJson) { outputJson(plan as unknown as Record<string, unknown>); return; }

      outputBlank();
      output(chalk.bold(`  Plan: ${plan.title}`));
      output(chalk.dim("  " + "─".repeat(50)));
      output(`  ID:       ${plan.id}`);
      output(`  Status:   ${plan.status}`);
      output(`  Created:  ${plan.createdAt || "N/A"}`);
      output(`  Updated:  ${plan.updatedAt || "N/A"}`);
      output(`  Path:     ${plan.relativePath}`);
      outputBlank();
    });
}
