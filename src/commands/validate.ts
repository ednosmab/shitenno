/**
 * validate.ts — Session integrity validation command
 *
 * The `shugo validate` command. Checks session integrity and governance health.
 */

import { Command } from "commander";
import { outputJson, banner } from "../shared/formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared/shared.js";
import { getEventBus } from "../infrastructure/event-bus.js";
import { printDaemonBanner } from "../interface/cli/daemon-context-banner.js";
import { outputBlank } from "../shared/output.js";
import { muteLogs } from "../shared/logger.js";

import { runValidationChecks } from "./validate/checks.js";
import { displayValidationResults } from "./validate/display.js";

// ── Command ────────────────────────────────────────────────────────────────

export const validateCommand = new Command("validate")
  .description("Validate session integrity")
  .option("-d, --dir <path>", "Project root directory (default: current)")
  .option("--fix", "Attempt to fix issues automatically")
  .option("--json", "Output results as JSON")
  .action(async (options) => {
    const isJson = options.json === true;
    if (isJson) muteLogs();

    if (!isJson) {
      outputBlank();
      banner("shugo validate", "Session Check");
      outputBlank();
    }

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    void printDaemonBanner(ctx.shitennoDir, isJson);

    if (!checkLifecycleGate("validate", ctx.projectRoot, ctx.shitennoDir, isJson)) return;

    const results = runValidationChecks(ctx.projectRoot);

    const passCount = results.filter((r) => r.status === "pass").length;
    const warnCount = results.filter((r) => r.status === "warn").length;
    const failCount = results.filter((r) => r.status === "fail").length;
    const passed = failCount === 0;
    const issues = results
      .filter((r) => r.status !== "pass")
      .map((r) => `${r.name}: ${r.message}`);
    getEventBus().publish("validation.completed", {
      validatorType: "session",
      passed,
      issues,
      duration: 0,
    });

    if (isJson) {
      outputJson({
        projectRoot: ctx.projectRoot,
        results: results.map((r) => ({ name: r.name, status: r.status, message: r.message })),
        passCount,
        warnCount,
        failCount,
        summary: `${passCount} passed, ${warnCount} warnings, ${failCount} failed`,
      });
      return;
    }

    displayValidationResults(results, options.fix, ctx.projectRoot);
  });
