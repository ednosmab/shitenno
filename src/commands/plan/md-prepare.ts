/**
 * plan md prepare — Prepare a plan.
 */

import chalk from "chalk";
import { join } from "node:path";
import { guardNotInitialized } from "../../shared/shared.js";
import { SHITENNO_DIR_NAME } from "../../domain/types/constants.js";
import { MarkdownPlanEngine } from "../../infrastructure/markdown-plan-engine.js";
import { outputJson, banner } from "../../shared/formatting.js";
import { output, outputBlank } from "../../shared/output.js";
import { runPrepare } from "../plan.js";

export function registerMdPrepare(cmd: import("commander").Command) {
  cmd
    .command("prepare")
    .description("Prepare a plan: format header, extract checklist, sync backlog, notify")
    .argument("<id>", "Plan ID (filename without .md)")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const shitennoDir = join(ctx.projectRoot, SHITENNO_DIR_NAME);
      const engine = new MarkdownPlanEngine(shitennoDir);
      const plan = engine.getById(id);

      if (!plan) {
        if (isJson) outputJson({ error: "not_found", message: `Plan not found: ${id}` });
        else output(chalk.red(`  ✘ Plan not found: ${id}`));
        return;
      }

      if (!isJson) {
        outputBlank();
        banner("shugo plan prepare", "Plan Preparation");
        outputBlank();
        output(chalk.gray(`  Plan: ${plan.title}`));
        output(chalk.gray(`  Path: ${plan.relativePath}`));
        outputBlank();
      }

      const results = await runPrepare(ctx.projectRoot, shitennoDir, id);

      if (isJson) {
        outputJson({ planId: id, title: plan.title, results });
      } else {
        output(chalk.bold("  Results:"));
        outputBlank();
        for (const r of results) {
          const icon = r.status === "done" ? "✅" : r.status === "skip" ? "⏭" : r.status === "error" ? "❌" : "⏳";
          output(`    ${icon} ${r.step}: ${r.detail}`);
        }
        outputBlank();
        output(chalk.green(`  ✓ Plan "${plan.title}" prepared`));
        outputBlank();
      }
    });
}
