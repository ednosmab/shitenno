/**
 * Security detectors — shared helpers
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { DETECTOR_PATTERN_FILES } from "../constants.js";

const NODE_BUILTINS = new Set([
  "fs", "path", "os", "child_process", "util", "events", "stream", "http", "https",
  "url", "crypto", "assert", "buffer", "zlib", "net", "tls", "dns", "readline",
  "worker_threads", "perf_hooks", "v8", "vm", "module", "constants",
]);
for (const b of [...NODE_BUILTINS]) NODE_BUILTINS.add("node:" + b);

/**
 * True only when the LINE is a pattern definition inside one of the closed
 * set of definition files. Never excludes an entire file, and never excludes
 * files outside DETECTOR_PATTERN_FILES — a real secret in detector code must
 * be detected.
 */
export function isDetectorPatternLine(relPath: string, lineContent: string): boolean {
  if (!DETECTOR_PATTERN_FILES.has(relPath)) return false;
  const line = lineContent.trim();
  // Comment/JSDoc lines inside a definition file describe patterns — never real usage.
  if (line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) return true;
  // Object-format pattern entries: { name: "...", pattern: /.../, regex: /.../ }
  if (/(?:name|pattern|regex)\s*:\s*["'`/]/.test(line)) return true;
  // Regex-literal pattern array elements: /.../flags,  or  /.../flags)
  if (/^\s*\/.*\/[a-z]*\s*,?\s*$/.test(line)) return true;
  return false;
}

export function isLocalHttpUrl(url: string): boolean {
  return url.includes("http://localhost") || url.includes("http://127.0.0.1") || url.includes("http://0.0.0.0");
}

export function isSkippableFile(relPath: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(relPath));
}

export function collectMissingFlags(flags: Record<string, boolean>): string[] {
  return Object.entries(flags)
    .filter(([, present]) => !present)
    .map(([name]) => name);
}

export function shannonEntropy(str: string): number {
  const freq = new Map<string, number>();
  for (const ch of str) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  const len = str.length;
  let h = 0;
  for (const count of freq.values()) {
    const p = count / len;
    h -= p * Math.log2(p);
  }
  return h;
}

export function extractPackageName(spec: string): string {
  return spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0] ?? "";
}

export function isUndeclaredDependency(
  pkgName: string,
  declaredDeps: Set<string>,
  workspaceRoot: string,
  projectRoot: string,
): boolean {
  if (!pkgName || NODE_BUILTINS.has(pkgName) || declaredDeps.has(pkgName)) return false;
  if (existsSync(join(workspaceRoot, "node_modules", pkgName))) return false;
  if (workspaceRoot !== projectRoot && existsSync(join(projectRoot, "node_modules", pkgName))) return false;
  return true;
}
