/**
 * reminders.ts — Reminders Management Command
 *
 * The `shugo reminders` command. List, add, remove, and manage reminders
 * with priority levels and categories.
 */

import { Command } from "commander";
import chalk from "chalk";
import { guardNotInitialized } from "../shared.js";
import { sendDesktopNotification } from "../notify.js";
import { outputJson } from "../formatting.js";
import { printDaemonBanner } from "../daemon-context-banner.js";
import { output, outputBlank } from "../output.js";
import type { Reminder, ReminderPriority, ReminderCategory } from "../briefing.js";
import {
  VALID_PRIORITIES, VALID_CATEGORIES, PRIORITY_ICONS, CATEGORY_ICONS,
  loadReminders, saveReminders,
} from "./reminders/storage.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function validateReminderArgs(priority: ReminderPriority, category: ReminderCategory, isJson: boolean): boolean {
  if (!VALID_PRIORITIES.includes(priority)) {
    const msg = `Invalid priority: ${priority}. Must be: ${VALID_PRIORITIES.join(", ")}`;
    if (isJson) outputJson({ error: msg }); else output(chalk.red(`  ${msg}`));
    return false;
  }
  if (!VALID_CATEGORIES.includes(category)) {
    const msg = `Invalid category: ${category}. Must be: ${VALID_CATEGORIES.join(", ")}`;
    if (isJson) outputJson({ error: msg }); else output(chalk.red(`  ${msg}`));
    return false;
  }
  return true;
}

function resolveRemovalTarget(reminders: Reminder[], index: string | undefined, messageOpt: unknown, isJson: boolean): number {
  if (messageOpt) {
    const message = String(messageOpt);
    const idx = reminders.findIndex(r => r.message.includes(message));
    if (idx === -1) {
      if (isJson) outputJson({ error: `Reminder not found: ${message}` });
      else output(chalk.red(`  Reminder not found: ${message}`));
    }
    return idx;
  }
  if (index) {
    const idx = parseInt(index, 10) - 1;
    if (idx < 0 || idx >= reminders.length) {
      if (isJson) outputJson({ error: `Invalid index: ${index}` });
      else output(chalk.red(`  Invalid index: ${index}. Must be 1-${reminders.length}`));
      return -1;
    }
    return idx;
  }
  if (isJson) outputJson({ error: "Specify index or --message" });
  else output(chalk.red("  Specify index or --message to remove a reminder."));
  return -1;
}

async function handleListReminders(opts: Record<string, unknown>): Promise<void> {
  const isJson = opts.json === true;
  const ctx = guardNotInitialized(opts, isJson);
  if (!ctx) return;

  void printDaemonBanner(ctx.shitennoDir, isJson);

  const reminders = loadReminders(ctx.projectRoot);

  if (isJson) {
    outputJson({ reminders, count: reminders.length });
    return;
  }

  outputBlank();
  if (reminders.length === 0) {
    output(chalk.dim("  No active reminders."));
    output(chalk.dim("  Use 'shugo reminders add \"message\"' to create one."));
  } else {
    output(chalk.bold(`  Active Reminders (${reminders.length})`));
    output(chalk.dim("  " + "─".repeat(60)));

    const priorityOrder: Record<ReminderPriority, number> = { high: 0, medium: 1, low: 2 };
    const sortedReminders = [...reminders].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    for (let i = 0; i < sortedReminders.length; i++) {
      const r = sortedReminders[i]!;
      const icon = PRIORITY_ICONS[r.priority];
      const categoryIcon = CATEGORY_ICONS[r.category] ?? "🏷️";
      output(`  ${chalk.cyan(`${i + 1}.`)} ${icon} ${r.message} ${chalk.dim(`${categoryIcon} ${r.category}`)}`);
    }
  }
  outputBlank();
}

async function handleAddReminder(message: string, opts: Record<string, unknown>): Promise<void> {
  const isJson = opts.json === true;
  const ctx = guardNotInitialized(opts, isJson);
  if (!ctx) return;

  void printDaemonBanner(ctx.shitennoDir, isJson);

  const priority = String(opts.priority) as ReminderPriority;
  const category = String(opts.category) as ReminderCategory;

  if (!validateReminderArgs(priority, category, isJson)) return;

  const reminders = loadReminders(ctx.projectRoot);

  const exists = reminders.some((r) => r.message === message);
  if (exists) {
    if (isJson) {
      outputJson({ skipped: true, message: `Reminder already exists: ${message}` });
    } else {
      output(chalk.yellow(`  ⚠ Reminder already exists: ${message} — skipped`));
    }
    return;
  }

  const newReminder: Reminder = {
    message,
    priority,
    category,
    createdAt: new Date().toISOString(),
  };
  reminders.push(newReminder);
  saveReminders(ctx.projectRoot, reminders);

  if (opts.notify) {
    sendDesktopNotification(ctx.shitennoDir, "Shugo Reminder Added", message, priority);
  }

  if (isJson) {
    outputJson({ added: newReminder, count: reminders.length });
  } else {
    const icon = PRIORITY_ICONS[priority];
    const categoryIcon = CATEGORY_ICONS[category] ?? "🏷️";
    output(chalk.green(`  ✓ Reminder added: ${icon} ${message} ${chalk.dim(`${categoryIcon} ${category}`)}`));
    output(chalk.dim(`  Total reminders: ${reminders.length}`));
  }
}

async function handleRemoveReminder(index: string | undefined, opts: Record<string, unknown>): Promise<void> {
  const isJson = opts.json === true;
  const ctx = guardNotInitialized(opts, isJson);
  if (!ctx) return;

  void printDaemonBanner(ctx.shitennoDir, isJson);

  const reminders = loadReminders(ctx.projectRoot);

  if (reminders.length === 0) {
    if (isJson) {
      outputJson({ error: "No reminders to remove" });
    } else {
      output(chalk.red("  No reminders to remove."));
    }
    return;
  }

  const removedIndex = resolveRemovalTarget(reminders, index, opts.message, isJson);
  if (removedIndex === -1) return;

  const removedReminder = reminders[removedIndex]!;
  reminders.splice(removedIndex, 1);
  saveReminders(ctx.projectRoot, reminders);

  if (isJson) {
    outputJson({ removed: removedReminder, index: removedIndex + 1, count: reminders.length });
  } else {
    const icon = PRIORITY_ICONS[removedReminder.priority];
    output(chalk.green(`  ✓ Reminder removed: ${icon} ${removedReminder.message}`));
    output(chalk.dim(`  Remaining reminders: ${reminders.length}`));
  }
}

async function handleClearReminders(opts: Record<string, unknown>): Promise<void> {
  const isJson = opts.json === true;
  const ctx = guardNotInitialized(opts, isJson);
  if (!ctx) return;

  void printDaemonBanner(ctx.shitennoDir, isJson);

  const reminders = loadReminders(ctx.projectRoot);
  const count = reminders.length;

  saveReminders(ctx.projectRoot, []);

  if (isJson) {
    outputJson({ cleared: count });
  } else {
    if (count === 0) {
      output(chalk.dim("  No reminders to clear."));
    } else {
      output(chalk.green(`  ✓ Cleared ${count} reminder(s).`));
    }
  }
}

// ── Command ────────────────────────────────────────────────────────────────

export function remindersCommand(): Command {
  const cmd = new Command("reminders")
    .description("List, add, remove, and manage reminders with priority and category")
    .option("-d, --dir <path>", "Project directory")
    .option("--json", "Output as JSON");

  cmd.action(handleListReminders);

  cmd
    .command("add")
    .description("Add a new reminder with optional priority and category")
    .argument("<message>", "Reminder message")
    .option("--priority <level>", "Priority level: high, medium, low", "medium")
    .option("--category <type>", "Category: bug, feature, debt, security, docs, infra", "feature")
    .option("--notify", "Send desktop notification")
    .option("--json", "Output as JSON")
    .action(handleAddReminder);

  cmd
    .command("rm")
    .description("Remove a reminder by index or message")
    .argument("[index]", "Reminder index (1-based)")
    .option("--message <text>", "Remove by partial message match")
    .option("--json", "Output as JSON")
    .action(handleRemoveReminder);

  cmd
    .command("clear")
    .description("Remove all reminders")
    .option("--json", "Output as JSON")
    .action(handleClearReminders);

  return cmd;
}
