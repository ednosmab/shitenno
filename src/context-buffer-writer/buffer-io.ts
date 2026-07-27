/**
 * buffer-io.ts — Low-level buffer I/O and section-aware field replacement.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { escapeRegex } from "../validation.js";

export function getBufferPath(shitennoDir: string): string {
  return join(shitennoDir, "governance", "context", "context_buffer.yaml");
}

export function readBuffer(shitennoDir: string): string | null {
  const path = getBufferPath(shitennoDir);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

export function writeBuffer(shitennoDir: string, content: string): void {
  const path = getBufferPath(shitennoDir);
  const dir = join(shitennoDir, "governance", "context");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  content = ensureContextVersion(content);
  writeFileSync(path, content, "utf-8");
}

function ensureContextVersion(content: string): string {
  const match = content.match(/^contextVersion:\s*(\d+)/m);
  if (match) {
    const next = Number(match[1]) + 1;
    return content.replace(/^contextVersion:\s*\d+/m, `contextVersion: ${next}`);
  }
  return content;
}

/**
 * Replace a scalar YAML value within a section.
 * For field "current_task.status", matches `status: "..."` only after
 * the `current_task:` block anchor — never touches session.status.
 */
export function replaceSectionField(
  content: string,
  fieldPath: string,
  newValue: string
): { updated: boolean; content: string } {
  const keys = fieldPath.split(".");
  if (keys.length < 2) {
    const lastKey = keys[keys.length - 1]!;
    const escaped = escapeRegex(lastKey);
    const pattern = new RegExp(`(${escaped}:\\s*").*?(")`);
    if (pattern.test(content)) {
      return { updated: true, content: content.replace(pattern, `$1${newValue}$2`) };
    }
    return { updated: false, content };
  }

  const parentKeys = keys.slice(0, -1);
  const leafKey = keys[keys.length - 1]!;
  const parentPattern = parentKeys.map(k => escapeRegex(k)).join("[\\s\\S]*?");
  const escapedLeaf = escapeRegex(leafKey);
  const pattern = new RegExp(`(${parentPattern}[\\s\\S]*?${escapedLeaf}:\\s*").*?(")`);

  if (pattern.test(content)) {
    return { updated: true, content: content.replace(pattern, `$1${newValue}$2`) };
  }
  return { updated: false, content };
}
