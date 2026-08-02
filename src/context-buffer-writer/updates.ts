/**
 * updates.ts — Session and task lifecycle buffer updates.
 */

import { logger } from "../logger.js";
import { readBufferObject, writeBufferObject } from "./buffer-io.js";

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
  const obj = readBufferObject(shitennoDir);
  if (obj === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  const session = obj.session as Record<string, unknown> | undefined;
  if (!session || typeof session !== "object") {
    return { success: false, message: "session section not found" };
  }

  let changed = false;
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (session[key] !== undefined) {
      session[key] = value;
      changed = true;
    } else {
      logger.warn("buffer-writer", `Field session.${key} not found in buffer`);
    }
  }

  if (changed) {
    writeBufferObject(shitennoDir, obj);
    return { success: true, message: `Session updated: ${Object.keys(updates).join(", ")}` };
  }
  return { success: false, message: "No fields updated" };
}

export function updateCurrentTask(
  shitennoDir: string,
  updates: CurrentTaskUpdate
): { success: boolean; message: string } {
  const obj = readBufferObject(shitennoDir);
  if (obj === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  const task = obj.current_task as Record<string, unknown> | undefined;
  if (!task || typeof task !== "object") {
    return { success: false, message: "current_task section not found" };
  }

  let changed = false;
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (task[key] !== undefined) {
      task[key] = value;
      changed = true;
    } else {
      logger.warn("buffer-writer", `Field current_task.${key} not found in buffer`);
    }
  }

  if (changed) {
    writeBufferObject(shitennoDir, obj);
    return { success: true, message: `Current task updated: ${Object.keys(updates).join(", ")}` };
  }
  return { success: false, message: "No fields updated" };
}

export function updateNextP0(
  shitennoDir: string,
  value: string
): { success: boolean; message: string } {
  const obj = readBufferObject(shitennoDir);
  if (obj === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  obj.next_p0 = value;
  writeBufferObject(shitennoDir, obj);
  return { success: true, message: "next_p0 updated" };
}

export function addCompletedTask(
  shitennoDir: string,
  task: { id: string; description: string; completed_at: string; files_modified?: string[] }
): { success: boolean; message: string } {
  const obj = readBufferObject(shitennoDir);
  if (obj === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  if (!Array.isArray(obj.completed_tasks)) {
    obj.completed_tasks = [];
  }

  const entry: Record<string, unknown> = {
    id: task.id,
    description: task.description,
    completed_at: task.completed_at,
  };
  if (task.files_modified && task.files_modified.length > 0) {
    entry.files_modified = task.files_modified;
  }

  (obj.completed_tasks as unknown[]).push(entry);
  writeBufferObject(shitennoDir, obj);
  return { success: true, message: `Completed task added: ${task.id}` };
}

export function updateSessionLifecycle(
  shitennoDir: string,
  session: SessionUpdate,
  task?: CurrentTaskUpdate
): { success: boolean; message: string } {
  const obj = readBufferObject(shitennoDir);
  if (obj === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  const messages: string[] = [];

  const sessionObj = obj.session as Record<string, unknown> | undefined;
  if (sessionObj && typeof sessionObj === "object") {
    for (const [key, value] of Object.entries(session)) {
      if (value === undefined) continue;
      if (sessionObj[key] !== undefined) {
        sessionObj[key] = value;
        messages.push(`session.${key}`);
      }
    }
  }

  if (task) {
    const taskObj = obj.current_task as Record<string, unknown> | undefined;
    if (taskObj && typeof taskObj === "object") {
      for (const [key, value] of Object.entries(task)) {
        if (value === undefined) continue;
        if (taskObj[key] !== undefined) {
          taskObj[key] = value;
          messages.push(`current_task.${key}`);
        }
      }
    }
  }

  if (messages.length > 0) {
    writeBufferObject(shitennoDir, obj);
    return { success: true, message: `Updated: ${messages.join(", ")}` };
  }
  return { success: false, message: "No fields updated" };
}
