/**
 * Decision Core — CreateReminder Executor
 *
 * Migrated from rule-engine/actions.ts (create_reminder).
 * Creates reminders in context_buffer.yaml with deduplication.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ActionExecutor } from "./types.js";

function ensureContextBuffer(shitennoDir: string): string {
  const bufferPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");
  if (!existsSync(bufferPath)) {
    const contextDir = join(shitennoDir, "governance", "context");
    if (!existsSync(contextDir)) {
      mkdirSync(contextDir, { recursive: true });
    }
    writeFileSync(bufferPath, "reminders:\n\nsession:\n  id: auto-created\n  status: in_progress\n", "utf-8");
  }
  return bufferPath;
}

export class CreateReminderExecutor implements ActionExecutor {
  name = "create_reminder" as const;

  async execute(params: Record<string, unknown>, context: { projectRoot: string; shitennoDir: string }): Promise<Record<string, unknown>> {
    const bufferPath = ensureContextBuffer(context.shitennoDir);

    let content = readFileSync(bufferPath, "utf-8");
    let reminder = String(params.message ?? "Reminder from rule engine");
    reminder = reminder
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .substring(0, 200);
    const priority = String(params.priority ?? "medium");
    const category = String(params.category ?? "feature");

    const escapedReminder = reminder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const dedupeRegex = new RegExp(`^\\s*- message: "${escapedReminder}"`, "m");
    if (dedupeRegex.test(content)) {
      return { success: true, created: true, message: `Reminder already exists: ${reminder} — skipped` };
    }

    const createdAt = new Date().toISOString();
    content = content.replace(
      /^reminders:\s*\n/,
      `reminders:\n  - message: "${reminder}"\n    priority: "${priority}"\n    category: "${category}"\n    createdAt: "${createdAt}"\n`
    );
    writeFileSync(bufferPath, content, "utf-8");
    return { success: true, created: true, message: `Created reminder: ${reminder} [${priority}/${category}]` };
  }
}
