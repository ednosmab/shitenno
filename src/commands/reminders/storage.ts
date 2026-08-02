import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { SHITENNO_DIR_NAME } from "../../constants.js";
import type { Reminder, ReminderPriority, ReminderCategory } from "../../briefing.js";

export const VALID_PRIORITIES: ReminderPriority[] = ["high", "medium", "low"];
export const VALID_CATEGORIES: ReminderCategory[] = ["bug", "feature", "debt", "security", "docs", "infra"];

export const PRIORITY_ICONS: Record<ReminderPriority, string> = {
  high: "🔴",
  medium: "🟡",
  low: "🟢",
};

export const CATEGORY_ICONS: Record<ReminderCategory, string> = {
  bug: "🐛",
  feature: "✨",
  debt: "🔧",
  security: "🔒",
  docs: "📝",
  infra: "⚙️",
};

export function getBufferPath(projectRoot: string): string {
  return join(projectRoot, SHITENNO_DIR_NAME, "governance", "context", "context_buffer.yaml");
}

export function ensureBuffer(projectRoot: string): string {
  const bufferPath = getBufferPath(projectRoot);
  const dir = join(projectRoot, SHITENNO_DIR_NAME, "governance", "context");

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (!existsSync(bufferPath)) {
    writeFileSync(bufferPath, "reminders: []\n", "utf-8");
  }

  return bufferPath;
}

export function loadReminders(projectRoot: string): Reminder[] {
  const bufferPath = getBufferPath(projectRoot);

  if (!existsSync(bufferPath)) {
    return [];
  }

  try {
    const content = readFileSync(bufferPath, "utf-8");
    const data = parseYaml(content);

    if (Array.isArray(data?.reminders)) {
      return data.reminders.map((r: string | Reminder) => {
        if (typeof r === "string") {
          return {
            message: r,
            priority: "medium" as ReminderPriority,
            category: "feature" as ReminderCategory,
            createdAt: new Date().toISOString(),
          };
        }
        return {
          message: r.message || "",
          priority: (r.priority as ReminderPriority) || "medium",
          category: (r.category as ReminderCategory) || "feature",
          createdAt: r.createdAt || new Date().toISOString(),
        };
      });
    }
    return [];
  } catch {
    return [];
  }
}

export function saveReminders(projectRoot: string, reminders: Reminder[]): void {
  const bufferPath = ensureBuffer(projectRoot);
  const content = readFileSync(bufferPath, "utf-8");
  let data: Record<string, unknown>;

  try {
    data = parseYaml(content) || {};
  } catch {
    data = {};
  }

  data.reminders = reminders;
  writeFileSync(bufferPath, stringifyYaml(data, { indent: 2, lineWidth: 0 }), "utf-8");
}
