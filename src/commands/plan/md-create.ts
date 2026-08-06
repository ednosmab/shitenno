/**
 * plan md create — Create a new markdown plan.
 */

import chalk from "chalk";
import { join } from "node:path";
import { guardNotInitialized } from "../../shared/shared.js";
import { SHITENNO_DIR_NAME } from "../../domain/types/constants.js";
import { MarkdownPlanEngine } from "../../infrastructure/markdown-plan-engine.js";
import { outputJson } from "../../shared/formatting.js";
import { output, outputBlank } from "../../shared/output.js";

export function registerMdCreate(cmd: import("commander").Command) {
  cmd
    .command("create")
    .description("Create a new markdown plan")
    .argument("<title>", "Plan title")
    .option("--description <text>", "Plan description")
    .option("--priority <level>", "Priority (P0, P1, P2)", "P1")
    .option("--time <estimate>", "Estimated time")
    .option("--owner <name>", "Plan owner", "AI Agent")
    .option("--json", "Output as JSON")
    .action((title: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = new MarkdownPlanEngine(join(ctx.projectRoot, SHITENNO_DIR_NAME));
      const plan = engine.create({
        title,
        description: opts.description as string,
        priority: opts.priority as string,
        estimatedTime: opts.time as string,
        owner: opts.owner as string,
      });

      if (isJson) outputJson(plan as unknown as Record<string, unknown>);
      else {
        output(chalk.green(`  ✓ Plan created: ${chalk.bold(plan.id)}`));
        output(`    ${plan.title}`);
        output(`    Path: ${plan.relativePath}`);
        outputBlank();
      }
    });
}
