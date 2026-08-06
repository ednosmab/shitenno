/**
 * events.ts — Events Command
 *
 * Shows rule engine execution trace from telemetry/rule-trace.jsonl.
 *
 * Usage: shugo events [--last <n>] [--trigger <type>] [--json]
 */

import { Command } from "commander";
import chalk from "chalk";
import { guardNotInitialized } from "../shared/shared.js";
import { outputJson, banner } from "../shared/formatting.js";
import { loadTrace } from "../infrastructure/events-data.js";
import { output, outputBlank } from "../shared/output.js";

export const eventsCommand = new Command("events")
  .description("Show rule engine execution trace")
  .option("--last <n>", "Show last N events", "20")
  .option("--trigger <type>", "Filter by trigger type")
  .option("--json", "Output as JSON")
  .action((options) => {
    const result = guardNotInitialized({}, options.json ?? false);
    if (result) return;

    const projectRoot = process.cwd();
    const shitennoDir = `${projectRoot}/shitenno`;
    const entries = loadTrace(shitennoDir);

    let filtered = entries;
    if (options.trigger) {
      filtered = entries.filter((e) => e.trigger === options.trigger);
    }

    const lastN = parseInt(options.last, 10);
    const sliced = filtered.slice(-lastN);

    if (sliced.length === 0) {
      output(chalk.yellow("No events found."));
      return;
    }

    if (options.json) {
      outputJson({ events: sliced, total: filtered.length });
      return;
    }

    banner("EVENTS — Rule Engine Trace", `${sliced.length} of ${filtered.length} events`);
    outputBlank();

    for (const entry of sliced.reverse()) {
      const date = new Date(entry.timestamp).toLocaleString();
      const trigger = chalk.cyan(entry.trigger);
      const eventType = chalk.dim(entry.eventType);

      output(`  ${chalk.bold(date)} — ${trigger} ${eventType}`);

      for (const r of entry.results) {
        const icon = r.success ? chalk.green("✓") : chalk.red("✗");
        const duration = chalk.dim(`${r.duration}ms`);
        output(`    ${icon} ${r.ruleId} — ${r.actionsExecuted} action(s) ${duration}`);
      }
      outputBlank();
    }
  });
