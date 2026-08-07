/**
 * commands/backlog.ts — `shugo backlog` CLI command
 *
 * Subcommands:
 *   shugo backlog list [--state X] [--priority X] [--all] [--json]
 *   shugo backlog add <id> <title> [--priority P1] [--severity Alto] [--description "..."]
 *   shugo backlog done <id>
 *   shugo backlog status <id>
 *   shugo backlog move <id> <to-state>
 *   shugo backlog delete <id>
 */

import { Command } from "commander";
import chalk from "chalk";
import {
  parseBacklogItems,
  findItem,
  addItem,
  deleteItem,
  transitionItem,
  moveItemToDone,
  getBacklogSummary,
  getAllowedTransitions,
  resolveBacklogPaths,
  normalizeState,
  formatItemsByPriority,
  formatSummaryLine,
  type BacklogPriority,
  type BacklogSeverity,
} from "../application/backlog-core.js";
import { guardNotInitialized } from "../shared/shared.js";
import { output, outputBlank } from "../shared/output.js";
import { getEventBus } from "../infrastructure/event-bus.js";

// ── Shared Helpers ─────────────────────────────────────────────────────────

function resolveCtx(options: Record<string, unknown>, isJson: boolean): { projectRoot: string; shitennoDir: string } | null {
  const ctx = guardNotInitialized(options, isJson);
  if (!ctx) return null;
  return ctx;
}

// ── list ───────────────────────────────────────────────────────────────────

function cmdList(shitennoDir: string, opts: { state?: string; priority?: string; all?: boolean; json?: boolean }) {
  const paths = resolveBacklogPaths(shitennoDir);
  let items = parseBacklogItems(paths.active);

  if (!opts.all) {
    items = items.filter((i) => i.state !== "concluído");
  }
  if (opts.state) {
    const normalized = normalizeState(opts.state);
    if (normalized) items = items.filter((i) => i.state === normalized);
  }
  if (opts.priority) {
    const p = opts.priority.toUpperCase();
    items = items.filter((i) => i.priority === p);
  }

  if (opts.json) {
    output(JSON.stringify(items, null, 2));
    return;
  }

  const summary = getBacklogSummary(items);
  output(chalk.bold(`📋 BACKLOG — ${summary.total} itens activos`));
  output(chalk.dim(`   ${formatSummaryLine(summary)}`));
  outputBlank();
  output(formatItemsByPriority(items));
  outputBlank();
  output(chalk.dim("   Use --all para ver concluídos, --json para formato JSON, --state/--priority para filtrar."));
}

// ── add ────────────────────────────────────────────────────────────────────

function cmdAdd(shitennoDir: string, id: string, title: string, opts: { priority?: string; severity?: string; description?: string; owner?: string; source?: string }) {
  const paths = resolveBacklogPaths(shitennoDir);

  const result = addItem(paths.active, {
    id,
    title,
    priority: (opts.priority?.toUpperCase() || "P2") as BacklogPriority,
    severity: (opts.severity || "Medio") as BacklogSeverity,
    owner: opts.owner,
    description: opts.description,
    source: opts.source || "shugo backlog add",
  });

  if (result.success) {
    output(chalk.green(`✅ ${result.message}`));
  } else {
    output(chalk.red(`❌ ${result.message}`));
  }
}

// ── done ───────────────────────────────────────────────────────────────────

function cmdDone(shitennoDir: string, id: string) {
  const paths = resolveBacklogPaths(shitennoDir);

  const item = findItem(parseBacklogItems(paths.active), id);
  const result = transitionItem(paths.active, id, "concluído");
  if (result.success) {
    output(chalk.green(`✅ ${result.message}`));
    if (paths.done) {
      const moveResult = moveItemToDone(paths.active, paths.done, id);
      if (moveResult.success) {
        output(chalk.green(`   📦 ${moveResult.message}`));
      }
    }
    // Publish task.completed — triggers daemon audit + desktop notification.
    // Also publish backlog.updated with the item identity so notifications
    // show the item title instead of a placeholder name. The daemon audit
    // runs only on task.completed, so this does not duplicate audits.
    const bus = getEventBus();
    const itemName = item?.title || id;
    bus.publish("task.completed", {
      taskId: id,
      itemName,
      fromState: result.previousState ?? "em implementação",
      toState: "concluído",
    });
    bus.publish("backlog.updated", {
      itemId: id,
      itemName,
      movedCount: 1,
      source: "cmd_done",
    });
  } else {
    output(chalk.red(`❌ ${result.message}`));
  }
}

// ── status ─────────────────────────────────────────────────────────────────

function cmdStatus(shitennoDir: string, id: string) {
  const paths = resolveBacklogPaths(shitennoDir);
  const items = parseBacklogItems(paths.active);
  const item = findItem(items, id);

  if (!item) {
    output(chalk.red(`❌ Item ${id} não encontrado no backlog`));
    return;
  }

  const allowed = getAllowedTransitions(item.state);
  const icon = item.state === "concluído" ? "✔️" : item.state === "pausado" ? "⏸️" : "📋";

  output(`${icon} ${chalk.bold(item.id)} — ${item.title}`);
  output(`   Estado: ${chalk.bold(item.state)}`);
  output(`   Prioridade: ${item.priority || "N/A"} | Severidade: ${item.severity || "N/A"}`);
  if (item.owner) output(`   Owner: ${item.owner}`);
  if (item.description) output(`   Descrição: ${item.description}`);
  outputBlank();

  if (allowed.length > 0) {
    output(chalk.dim(`   Transições permitidas: ${allowed.join(", ")}`));
  } else {
    output(chalk.dim("   Estado terminal — nenhuma transição possível"));
  }
}

// ── move ───────────────────────────────────────────────────────────────────

function cmdMove(shitennoDir: string, id: string, toStateRaw: string) {
  const paths = resolveBacklogPaths(shitennoDir);
  const toState = normalizeState(toStateRaw);

  if (!toState) {
    output(chalk.red(`❌ Estado inválido: "${toStateRaw}"`));
    output(chalk.dim("   Estados válidos: planeado, em investigação, em implementação, em validação, pausado, adiado, concluído, encerrado"));
    return;
  }

  const result = transitionItem(paths.active, id, toState);
  if (result.success) {
    output(chalk.green(`✅ ${result.message}`));
  } else {
    output(chalk.red(`❌ ${result.message}`));
  }
}

// ── delete ─────────────────────────────────────────────────────────────────

function cmdDelete(shitennoDir: string, id: string) {
  const paths = resolveBacklogPaths(shitennoDir);
  const result = deleteItem(paths.active, id);

  if (result.success) {
    output(chalk.green(`✅ ${result.message}`));
  } else {
    output(chalk.red(`❌ ${result.message}`));
  }
}

// ── Commander Command ──────────────────────────────────────────────────────

export const backlogCommand = new Command("backlog")
  .description("Manage the project backlog (list, add, done, status, move, delete)")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--json", "Output as JSON (for list subcommand)");

backlogCommand
  .command("list")
  .alias("ls")
  .description("List backlog items")
  .option("-s, --state <state>", "Filter by state")
  .option("-p, --priority <priority>", "Filter by priority (P0, P1, P2, P3)")
  .option("-a, --all", "Include done items")
  .option("-j, --json", "Output as JSON")
  .action((opts) => {
    const parentOpts = backlogCommand.opts();
    const ctx = resolveCtx(parentOpts, false);
    if (!ctx) return;
    cmdList(ctx.shitennoDir, opts);
  });

backlogCommand
  .command("add <id> <title...>")
  .description("Add a new backlog item")
  .option("-p, --priority <priority>", "Priority level (P0, P1, P2, P3)", "P2")
  .option("-s, --severity <severity>", "Severity level", "Medio")
  .option("-d, --description <description>", "Detailed description")
  .option("--owner <owner>", "Assigned owner")
  .option("--source <source>", "Source of the item")
  .action((id: string, titleParts: string[], opts) => {
    const parentOpts = backlogCommand.opts();
    const ctx = resolveCtx(parentOpts, false);
    if (!ctx) return;
    cmdAdd(ctx.shitennoDir, id, titleParts.join(" "), opts);
  });

backlogCommand
  .command("done <id>")
  .alias("complete")
  .description("Mark an item as done and move to done file")
  .action((id: string) => {
    const parentOpts = backlogCommand.opts();
    const ctx = resolveCtx(parentOpts, false);
    if (!ctx) return;
    cmdDone(ctx.shitennoDir, id);
  });

backlogCommand
  .command("status <id>")
  .alias("show")
  .description("Show item status and allowed transitions")
  .action((id: string) => {
    const parentOpts = backlogCommand.opts();
    const ctx = resolveCtx(parentOpts, false);
    if (!ctx) return;
    cmdStatus(ctx.shitennoDir, id);
  });

backlogCommand
  .command("move <id> <to-state>")
  .alias("transition")
  .description("Transition an item to a new state")
  .action((id: string, toState: string) => {
    const parentOpts = backlogCommand.opts();
    const ctx = resolveCtx(parentOpts, false);
    if (!ctx) return;
    cmdMove(ctx.shitennoDir, id, toState);
  });

backlogCommand
  .command("delete <id>")
  .alias("rm")
  .description("Remove an item from the backlog")
  .action((id: string) => {
    const parentOpts = backlogCommand.opts();
    const ctx = resolveCtx(parentOpts, false);
    if (!ctx) return;
    cmdDelete(ctx.shitennoDir, id);
  });
