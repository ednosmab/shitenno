/**
 * reminders.ts — Reminder buffer operations.
 */

import type { ReminderPriority, ReminderCategory } from "../briefing.js";
import { readBuffer, writeBuffer } from "./buffer-io.js";

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
  const content = readBuffer(shitennoDir);
  if (content === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  if (content.includes(`message: "${reminder.message}"`)) {
    return { success: true, message: "Reminder already exists, skipped", skipped: true };
  }

  const entry = `  - message: "${reminder.message}"
    priority: "${reminder.priority}"
    category: "${reminder.category}"
    createdAt: "${reminder.createdAt}"
`;

  const remindersRegex = /^reminders:\s*\n/m;
  const match = remindersRegex.exec(content);

  if (match) {
    const insertPos = match.index + match[0].length;
    const updated = content.slice(0, insertPos) + entry + content.slice(insertPos);
    writeBuffer(shitennoDir, updated);
    return { success: true, message: `Reminder added: ${reminder.message}` };
  }

  const updated = "reminders:\n" + entry + "\n" + content;
  writeBuffer(shitennoDir, updated);
  return { success: true, message: `Reminder added (new section): ${reminder.message}` };
}

export function clearRemindersByCategory(
  shitennoDir: string,
  category: ReminderCategory
): { success: boolean; removed: number } {
  const content = readBuffer(shitennoDir);
  if (content === null) return { success: false, removed: 0 };

  const lines = content.split("\n");
  const remindersStart = lines.findIndex((l) => /^reminders:\s*$/.test(l));
  if (remindersStart === -1) return { success: true, removed: 0 };

  let remindersEnd = lines.length;
  for (let i = remindersStart + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.length > 0 && !line.startsWith(" ") && !line.startsWith("\t")) {
      remindersEnd = i;
      break;
    }
  }

  const entries: string[][] = [];
  let currentEntry: string[] | null = null;
  for (let i = remindersStart + 1; i < remindersEnd; i++) {
    const line = lines[i]!;
    if (/^\s+- /.test(line)) {
      if (currentEntry) entries.push(currentEntry);
      currentEntry = [line];
    } else if (currentEntry) {
      currentEntry.push(line);
    }
  }
  if (currentEntry) entries.push(currentEntry);

  const kept = entries.filter(
    (entry) => !entry.some((l) => l.includes(`category: "${category}"`))
  );
  const removed = entries.length - kept.length;

  if (removed === 0) return { success: true, removed: 0 };

  const keptBlock = kept.length > 0 ? kept.map((e) => e.join("\n")).join("\n") + "\n" : "[]\n";
  const before = lines.slice(0, remindersStart + 1).join("\n");
  const after = lines.slice(remindersEnd).join("\n");
  const updated = before + "\n" + keptBlock + (after.startsWith("\n") ? after.slice(1) : after);
  writeBuffer(shitennoDir, updated);
  return { success: true, removed };
}
