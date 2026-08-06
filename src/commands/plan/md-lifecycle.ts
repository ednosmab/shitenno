/**
 * plan md lifecycle — Detect, review and archive completed plans.
 */

import chalk from "chalk";
import { guardNotInitialized } from "../../shared/shared.js";
import { outputJson } from "../../shared/formatting.js";
import { output } from "../../shared/output.js";

export function registerMdLifecycle(cmd: import("commander").Command) {
  cmd
    .command("lifecycle")
    .description("Detect, review and archive completed plans")
    .option("--auto", "Archive without prompts (CI/CD)")
    .option("--dry", "Dry run — show what would happen")
    .option("--json", "Output as JSON")
    .action(async (opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const { runLifecycleReview } = await import("../../application/plan-lifecycle.js");
      try {
        const result = await runLifecycleReview(ctx.shitennoDir, ctx.projectRoot);
        if (isJson) outputJson(result as unknown as Record<string, unknown>);
      } catch (error) {
        if (isJson) outputJson({ error: error instanceof Error ? error.message : String(error) });
        else output(chalk.red(`  Error: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
}
