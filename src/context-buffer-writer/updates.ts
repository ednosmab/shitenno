/**
 * updates.ts — Session and task lifecycle buffer updates.
 */

import { logger } from "../logger.js";
import { escapeRegex } from "../validation.js";
import { readBuffer, writeBuffer, replaceSectionField } from "./buffer-io.js";

export interface SessionUpdate {
  id?: string;
  started_at?: string;
  status?: string;
}

export interface CurrentTaskUpdate {
  id?: string;
  description?: string;
  status?: string;
  started_at?: string;
  completed_at?: string;
}

export function updateSession(
  shitennoDir: string,
  updates: SessionUpdate
): { success: boolean; message: string } {
  let content = readBuffer(shitennoDir);
  if (content === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  let changed = false;
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    const result = replaceSectionField(content, `session.${key}`, value);
    if (result.updated) {
      content = result.content;
      changed = true;
    } else {
      logger.warn("buffer-writer", `Field session.${key} not found in buffer`);
    }
  }

  if (changed) {
    writeBuffer(shitennoDir, content);
    return { success: true, message: `Session updated: ${Object.keys(updates).join(", ")}` };
  }
  return { success: false, message: "No fields updated" };
}

export function updateCurrentTask(
  shitennoDir: string,
  updates: CurrentTaskUpdate
): { success: boolean; message: string } {
  let content = readBuffer(shitennoDir);
  if (content === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  let changed = false;
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    const result = replaceSectionField(content, `current_task.${key}`, value);
    if (result.updated) {
      content = result.content;
      changed = true;
    } else {
      logger.warn("buffer-writer", `Field current_task.${key} not found in buffer`);
    }
  }

  if (changed) {
    writeBuffer(shitennoDir, content);
    return { success: true, message: `Current task updated: ${Object.keys(updates).join(", ")}` };
  }
  return { success: false, message: "No fields updated" };
}

export function updateNextP0(
  shitennoDir: string,
  value: string
): { success: boolean; message: string } {
  let content = readBuffer(shitennoDir);
  if (content === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  const escaped = escapeRegex("next_p0");
  const pattern = new RegExp(`(${escaped}:\\s*").*?(")`);
  if (pattern.test(content)) {
    content = content.replace(pattern, `$1${value}$2`);
    writeBuffer(shitennoDir, content);
    return { success: true, message: "next_p0 updated" };
  }

  const insertPattern = /(current_task:[\s\S]*?\n\n)/;
  if (insertPattern.test(content)) {
    content = content.replace(insertPattern, `$1next_p0: "${value}"\n\n`);
    writeBuffer(shitennoDir, content);
    return { success: true, message: "next_p0 created" };
  }

  return { success: false, message: "Could not find insertion point for next_p0" };
}

export function addCompletedTask(
  shitennoDir: string,
  task: { id: string; description: string; completed_at: string; files_modified?: string[] }
): { success: boolean; message: string } {
  let content = readBuffer(shitennoDir);
  if (content === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  const completedRegex = /(completed_tasks:\s*\n)/;
  if (!completedRegex.test(content)) {
    return { success: false, message: "completed_tasks section not found" };
  }

  let entry = `  - id: "${task.id}"\n    description: "${task.description}"\n    completed_at: "${task.completed_at}"`;
  if (task.files_modified && task.files_modified.length > 0) {
    entry += `\n    files_modified:\n${task.files_modified.map(f => `      - "${f}"`).join("\n")}`;
  }
  entry += "\n";

  content = content.replace(completedRegex, `$1${entry}`);
  writeBuffer(shitennoDir, content);
  return { success: true, message: `Completed task added: ${task.id}` };
}

export function updateSessionLifecycle(
  shitennoDir: string,
  session: SessionUpdate,
  task?: CurrentTaskUpdate
): { success: boolean; message: string } {
  let content = readBuffer(shitennoDir);
  if (content === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  const messages: string[] = [];

  for (const [key, value] of Object.entries(session)) {
    if (value === undefined) continue;
    const result = replaceSectionField(content, `session.${key}`, value);
    if (result.updated) {
      content = result.content;
      messages.push(`session.${key}`);
    }
  }

  if (task) {
    for (const [key, value] of Object.entries(task)) {
      if (value === undefined) continue;
      const result = replaceSectionField(content, `current_task.${key}`, value);
      if (result.updated) {
        content = result.content;
        messages.push(`current_task.${key}`);
      }
    }
  }

  if (messages.length > 0) {
    writeBuffer(shitennoDir, content);
    return { success: true, message: `Updated: ${messages.join(", ")}` };
  }
  return { success: false, message: "No fields updated" };
}
