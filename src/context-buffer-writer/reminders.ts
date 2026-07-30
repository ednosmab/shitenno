/**
 * reminders.ts — Reminder buffer operations.
 */

import type { ReminderPriority, ReminderCategory } from "../briefing.js";
import { readBufferObject, writeBufferObject } from "./buffer-io.js";

export interface ReminderInput {
  message: string;
  priority: ReminderPriority;
  category: ReminderCategory;
  createdAt: string;
}

export function addReminder(
  shitennoDir: string,
  reminder: ReminderInput
): { success: boolean; message: string; skipped?: boolean } {
  const obj = readBufferObject(shitennoDir);
  if (obj === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  if (!Array.isArray(obj.reminders)) {
    obj.reminders = [];
  }

  const exists = (obj.reminders as Array<Record<string, unknown>>).some(
    (r) => r.message === reminder.message
  );
  if (exists) {
    return { success: true, message: "Reminder already exists, skipped", skipped: true };
  }

  (obj.reminders as unknown[]).push({
    message: reminder.message,
    priority: reminder.priority,
    category: reminder.category,
    createdAt: reminder.createdAt,
  });

  writeBufferObject(shitennoDir, obj);
  return { success: true, message: `Reminder added: ${reminder.message}` };
}

export function clearRemindersByCategory(
  shitennoDir: string,
  category: ReminderCategory
): { success: boolean; removed: number } {
  const obj = readBufferObject(shitennoDir);
  if (obj === null) return { success: false, removed: 0 };

  if (!Array.isArray(obj.reminders) || obj.reminders.length === 0) {
    return { success: true, removed: 0 };
  }

  const before = (obj.reminders as Array<Record<string, unknown>>).length;
  obj.reminders = (obj.reminders as Array<Record<string, unknown>>).filter(
    (r) => r.category !== category
  );
  const removed = before - (obj.reminders as Array<Record<string, unknown>>).length;

  if (removed > 0) {
    writeBufferObject(shitennoDir, obj);
  }
  return { success: true, removed };
}
