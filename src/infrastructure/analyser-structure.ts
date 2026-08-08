/**
 * analyser-structure.ts — Source structure analysis
 *
 * Analyses the src/ layout: flat files, layered directories,
 * node API imports outside adapter layers, and port consumption.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { walkSourceFiles } from "./utils.js";

const LAYER_DIRS = ["shared", "domain", "application", "infrastructure", "interface"];

export function countFlatSourceFiles(rootDir: string): number {
  const srcDir = join(rootDir, "src");
  if (!existsSync(srcDir)) return 0;
  try {
    return readdirSync(srcDir).filter(
      (name) => /\.(ts|tsx|js|jsx)$/.test(name) && !name.endsWith(".d.ts")
    ).length;
  } catch {
    return 0;
  }
}

export function countLayeredDirs(rootDir: string): number {
  const srcDir = join(rootDir, "src");
  if (!existsSync(srcDir)) return 0;
  try {
    const entries = readdirSync(srcDir);
    return LAYER_DIRS.filter((layer) => entries.includes(layer)).length;
  } catch {
    return 0;
  }
}

function isOutsideAdapterLayers(relPath: string): boolean {
  const parts = relPath.split("/");
  const srcIndex = parts.indexOf("src");
  if (srcIndex === -1) return false;
  const layer = parts[srcIndex + 1];
  return layer !== undefined && !["infrastructure", "interface"].includes(layer);
}

export function countNodeImportsOutsideLayers(rootDir: string): number {
  let count = 0;
  walkSourceFiles(rootDir, (fullPath, _fileName) => {
    const rel = fullPath.replace(rootDir, "").replace(/^[/\\]/, "");
    if (!rel.startsWith("src/")) return;
    if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(rel)) return;
    if (rel.includes("/__tests__/") || rel.includes("/__fixtures__/") || rel.includes("/templates/")) return;
    if (!isOutsideAdapterLayers(rel)) return;
    try {
      const content = readFileSync(fullPath, "utf-8");
      if (/["']node:[a-z][a-z0-9]*["']/.test(content)) count++;
    } catch { /* unreadable file is not evidence of coupling */ }
  });
  return count;
}

export function detectPortConsumption(rootDir: string): boolean {
  let found = false;
  walkSourceFiles(rootDir, (fullPath, _fileName) => {
    if (found) return;
    const rel = fullPath.replace(rootDir, "").replace(/^[/\\]/, "");
    if (!rel.startsWith("src/")) return;
    if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(rel)) return;
    if (rel.includes("/__tests__/") || rel.includes("/__fixtures__/")) return;
    if (rel.startsWith("src/domain/")) return;
    try {
      const content = readFileSync(fullPath, "utf-8");
      if (/["'][^"']*\/ports\//.test(content)) found = true;
    } catch { /* unreadable file is not evidence of port usage */ }
  });
  return found;
}
