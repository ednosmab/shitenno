/**
 * buffer-io.ts — Low-level buffer I/O with YAML.parse/stringify.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export function getBufferPath(shitennoDir: string): string {
  return join(shitennoDir, "governance", "context", "context_buffer.yaml");
}

export function readBuffer(shitennoDir: string): string | null {
  const path = getBufferPath(shitennoDir);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

/**
 * Read buffer and parse into a JavaScript object.
 * Returns null if file doesn't exist or is invalid YAML.
 */
export function readBufferObject(shitennoDir: string): Record<string, unknown> | null {
  const content = readBuffer(shitennoDir);
  if (content === null) return null;
  try {
    const parsed = parseYaml(content);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Write a JavaScript object back to the buffer file.
 * Automatically increments contextVersion.
 */
export function writeBufferObject(shitennoDir: string, obj: Record<string, unknown>): void {
  const path = getBufferPath(shitennoDir);
  const dir = join(shitennoDir, "governance", "context");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const version = typeof obj.contextVersion === "number" ? obj.contextVersion + 1 : 1;
  obj.contextVersion = version;
  const content = stringifyYaml(obj, null, { lineWidth: 0 });
  writeFileSync(path, content, "utf-8");
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
 * Replace a scalar YAML value within a section (legacy, kept for backward compat).
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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
