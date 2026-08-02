/**
 * act.ts — Action Engine CLI Command
 *
 * The `shugo act` command. Execute actions with idempotency guarantees.
 *
 * Usage:
 *   shugo act log-event --event "session.start" --message "Session started"
 *   shugo act notify --message "Build complete" --level info
 *   shugo act reminder --message "Run audit" --priority high
 *   shugo act script --script "shugo audit"
 *   shugo act --list
 *   shugo act --show EXE-abc123
 *   shugo act --stats
 *   shugo act --rollback EXE-abc123
 */

import { Command } from "commander";
import chalk from "chalk";
import { join } from "node:path";
import { guardNotInitialized } from "../shared.js";
import { SHITENNO_DIR_NAME } from "../constants.js";
import {
  ActionEngine,
  FileExecutionRepository,
  type ActionStatus,
  type ActionResult,
} from "../action-engine.js";
import { outputJson } from "../formatting.js";
import { output, outputBlank, outputSection, outputSuccess, outputError } from "../output.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function getEngine(dir: string): ActionEngine {
  const shitennoDir = join(dir, SHITENNO_DIR_NAME);
  return new ActionEngine(new FileExecutionRepository(shitennoDir), shitennoDir);
}

const STATUS_COLORS: Record<ActionStatus, (s: string) => string> = {
  pending: (s) => chalk.gray(s),
  running: (s) => chalk.cyan(s),
  completed: (s) => chalk.green(s),
  failed: (s) => chalk.red(s),
  rolled_back: (s) => chalk.yellow(s),
};

const RESULT_COLORS: Record<ActionResult, (s: string) => string> = {
  success: (s) => chalk.green(s),
  failure: (s) => chalk.red(s),
  skipped: (s) => chalk.gray(s),
  rolled_back: (s) => chalk.yellow(s),
};

function formatExecution(r: { executionId: string; request: { type: string; id: string }; status: ActionStatus; result?: ActionResult; duration?: number }): string {
  const status = STATUS_COLORS[r.status](r.status.padEnd(12));
  const result = r.result ? RESULT_COLORS[r.result](r.result.padEnd(10)) : "".padEnd(10);
  const duration = r.duration ? `${r.duration}ms` : "-";
  return `  ${chalk.bold(r.executionId)}  ${status}  ${result}  ${r.request.type.padEnd(16)}  ${duration}`;
}

// ── Command ────────────────────────────────────────────────────────────────

function registerLogEvent(cmd: Command) {
  cmd.command("log-event").description("Log an event")
    .option("--event <name>", "Event name", "unknown").option("--message <text>", "Event message", "")
    .option("--action-id <id>", "Custom action ID (for idempotency)").option("--correlation-id <id>", "Correlation ID")
    .option("--json", "Output as JSON")
    .action(async (opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;
      const engine = getEngine(ctx.projectRoot);
      const record = await engine.execute({ id: (opts["action-id"] as string) ?? `act-log-${Date.now().toString(36)}`, type: "log_event", params: { event: opts.event, message: opts.message }, correlationId: opts["correlation-id"] as string });
      if (isJson) outputJson(record as unknown as Record<string, unknown>);
      else { outputSuccess(`Action executed: ${record.executionId}`); output(`    ${formatExecution(record)}`); }
    });
}

function registerNotify(cmd: Command) {
  cmd.command("notify").description("Send a notification")
    .option("--message <text>", "Notification message").option("--level <level>", "Notification level", "info")
    .option("--action-id <id>", "Custom action ID").option("--correlation-id <id>", "Correlation ID")
    .option("--json", "Output as JSON")
    .action(async (opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;
      const engine = getEngine(ctx.projectRoot);
      const record = await engine.execute({ id: (opts["action-id"] as string) ?? `act-notify-${Date.now().toString(36)}`, type: "notify", params: { message: opts.message, level: opts.level }, correlationId: opts["correlation-id"] as string });
      if (isJson) outputJson(record as unknown as Record<string, unknown>);
      else outputSuccess(`Notification sent: ${record.executionId}`);
    });
}

function registerReminder(cmd: Command) {
  cmd.command("reminder").description("Create a reminder")
    .option("--message <text>", "Reminder message").option("--priority <level>", "Priority level", "medium")
    .option("--action-id <id>", "Custom action ID").option("--correlation-id <id>", "Correlation ID")
    .option("--json", "Output as JSON")
    .action(async (opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;
      const engine = getEngine(ctx.projectRoot);
      const record = await engine.execute({ id: (opts["action-id"] as string) ?? `act-remind-${Date.now().toString(36)}`, type: "create_reminder", params: { message: opts.message, priority: opts.priority }, correlationId: opts["correlation-id"] as string });
      if (isJson) outputJson(record as unknown as Record<string, unknown>);
      else outputSuccess(`Reminder created: ${record.executionId}`);
    });
}

function registerScript(cmd: Command) {
  cmd.command("script").description("Run a whitelisted script")
    .option("--script <name>", "Script name (e.g., 'shugo audit')")
    .option("--action-id <id>", "Custom action ID").option("--correlation-id <id>", "Correlation ID")
    .option("--json", "Output as JSON")
    .action(async (opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;
      const engine = getEngine(ctx.projectRoot);
      const record = await engine.execute({ id: (opts["action-id"] as string) ?? `act-script-${Date.now().toString(36)}`, type: "run_script", params: { script: opts.script }, correlationId: opts["correlation-id"] as string });
      if (isJson) outputJson(record as unknown as Record<string, unknown>);
      else { const icon = record.status === "completed" ? chalk.green("✓") : chalk.red("✗"); output(`${icon} Script executed: ${record.executionId}`); }
    });
}

function registerList(cmd: Command) {
  cmd.command("list").description("List action executions")
    .option("--status <status>", "Filter by status").option("--type <type>", "Filter by action type")
    .option("--correlation-id <id>", "Filter by correlation ID").option("--json", "Output as JSON")
    .action((opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;
      const engine = getEngine(ctx.projectRoot);
      const records = engine.list({ status: opts.status as ActionStatus, type: opts.type as string, correlationId: opts["correlation-id"] as string });
      if (isJson) { outputJson(records as unknown as Record<string, unknown>); return; }
      outputBlank();
      if (records.length === 0) output(chalk.dim("  No executions found."));
      else { outputSection(`Executions (${records.length})`); output(chalk.dim("  " + "─".repeat(70))); for (const r of records) output(formatExecution(r)); }
      outputBlank();
    });
}

function registerShow(cmd: Command) {
  cmd.command("show").description("Show execution details").argument("<id>", "Execution ID").option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;
      const engine = getEngine(ctx.projectRoot);
      const record = engine.get(id);
      if (!record) { if (isJson) outputJson({ error: "Execution not found" }); else outputError(`Execution not found: ${id}`); return; }
      if (isJson) { outputJson(record as unknown as Record<string, unknown>); return; }
      outputBlank();
      output(chalk.bold(`  ${record.executionId}`));
      output(`  Action:     ${record.request.type}`); output(`  Action ID:  ${record.request.id}`);
      output(`  Status:     ${STATUS_COLORS[record.status](record.status)}`);
      if (record.result) output(`  Result:     ${RESULT_COLORS[record.result](record.result)}`);
      output(`  Hash:       ${record.executionHash}`); output(`  Started:    ${record.startedAt}`);
      if (record.completedAt) output(`  Completed:  ${record.completedAt}`);
      if (record.duration) output(`  Duration:   ${record.duration}ms`);
      if (record.error) output(`  Error:      ${chalk.red(record.error)}`);
      if (record.output) output(`  Output:     ${JSON.stringify(record.output)}`);
      if (record.request.correlationId) output(`  Correlation: ${record.request.correlationId}`);
      if (record.rollback) { outputSection("Rollback:"); output(`    ID:       ${record.rollback.rollbackId}`); output(`    Status:   ${record.rollback.status}`); if (record.rollback.error) output(`    Error:    ${record.rollback.error}`); }
      outputBlank();
    });
}

function registerRollback(cmd: Command) {
  cmd.command("rollback").description("Rollback a completed action").argument("<id>", "Execution ID").option("--json", "Output as JSON")
    .action(async (id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;
      const engine = getEngine(ctx.projectRoot);
      const record = await engine.rollback(id);
      if (!record) { if (isJson) outputJson({ error: "Execution not found or not rollbackable" }); else outputError(`Cannot rollback: ${id}`); return; }
      if (isJson) outputJson(record as unknown as Record<string, unknown>);
      else { if (record.rollback?.status === "completed") outputSuccess(`Action rolled back: ${record.executionId}`); else outputError(`Rollback failed: ${record.rollback?.error}`); }
    });
}

function registerStats(cmd: Command) {
  cmd.command("stats").description("Show execution statistics").option("--json", "Output as JSON")
    .action((opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;
      const engine = getEngine(ctx.projectRoot);
      const stats = engine.stats();
      if (isJson) { outputJson(stats as unknown as Record<string, unknown>); return; }
      outputBlank(); outputSection("Execution Statistics"); output(chalk.dim("  " + "─".repeat(40)));
      output(`  Total:       ${stats.total}`); output(`  Avg Duration: ${stats.avgDuration}ms`); output(`  Success Rate: ${stats.successRate}%`);
      outputBlank(); for (const [status, count] of Object.entries(stats.byStatus)) { if (count > 0) output(`  ${STATUS_COLORS[status as ActionStatus](status)}: ${count}`); }
      outputBlank();
    });
}
export function actCommand(): Command {
  const cmd = new Command("act").description("Execute actions with idempotency guarantees").option("-d, --dir <path>", "Project directory");
  registerLogEvent(cmd); registerNotify(cmd); registerReminder(cmd); registerScript(cmd);
  registerList(cmd); registerShow(cmd); registerRollback(cmd); registerStats(cmd);
  return cmd;
}
