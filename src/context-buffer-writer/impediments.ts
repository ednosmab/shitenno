/**
 * impediments.ts — Impediment buffer operations.
 */

import { readBufferObject, writeBufferObject } from "./buffer-io.js";

export interface Impediment {
  description: string;
  priority: "high" | "medium" | "low";
  createdAt: string;
  category?: string;
}

export function addImpediment(
  shitennoDir: string,
  impediment: Impediment
): { success: boolean; message: string } {
  const obj = readBufferObject(shitennoDir);
  if (obj === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  if (!Array.isArray(obj.impediments)) {
    obj.impediments = [];
  }

  const entry: Record<string, unknown> = {
    description: impediment.description,
    priority: impediment.priority,
    createdAt: impediment.createdAt,
  };
  if (impediment.category) {
    entry.category = impediment.category;
  }

  (obj.impediments as unknown[]).push(entry);
  writeBufferObject(shitennoDir, obj);
  return { success: true, message: `Impediment added: ${impediment.description}` };
}

export function clearImpediments(
  shitennoDir: string,
  pattern?: string
): { success: boolean; message: string; removed: number } {
  const obj = readBufferObject(shitennoDir);
  if (obj === null) {
    return { success: false, message: "context_buffer.yaml not found", removed: 0 };
  }

  if (!Array.isArray(obj.impediments) || obj.impediments.length === 0) {
    return { success: true, message: "No impediments found", removed: 0 };
  }

  const before = (obj.impediments as Array<Record<string, unknown>>).length;

  if (!pattern) {
    obj.impediments = [];
    writeBufferObject(shitennoDir, obj);
    return { success: true, message: `Cleared all ${before} impediments`, removed: before };
  }

  obj.impediments = (obj.impediments as Array<Record<string, unknown>>).filter(
    (e) => !(typeof e.description === "string" && e.description.includes(pattern))
  );
  const removed = before - (obj.impediments as Array<Record<string, unknown>>).length;

  if (removed === 0) {
    return { success: true, message: `No impediments matching "${pattern}"`, removed: 0 };
  }

  writeBufferObject(shitennoDir, obj);
  return { success: true, message: `Cleared ${removed} impediments matching "${pattern}"`, removed };
}
