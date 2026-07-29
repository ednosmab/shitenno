/**
 * Shared types and utilities for sync-docs validators.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const ROOT = resolve(__dirname, "..", "..", "..");
export const SHUGO = resolve(ROOT, ".shitenno");
export const DOCS = resolve(SHUGO, "docs");
export const TEMPLATE_DOCS = resolve(ROOT, "src", "templates", "base", "docs");
export const ROOT_DOCS = resolve(ROOT, "docs");
export const SRC = resolve(ROOT, "src", "commands");
export const SRC_TS = resolve(ROOT, "src");
export const README = resolve(ROOT, "README.md");
export const CHANGELOG = resolve(ROOT, "CHANGELOG.md");
export const PACKAGE_JSON = resolve(ROOT, "package.json");
export const SYSTEM_MAP = resolve(SHUGO, "governance", "SYSTEM_MAP.md");

export interface Discrepancy {
  type: string;
  severity: "error" | "warning";
  message: string;
  file?: string;
  fixable: boolean;
}

export interface FixAction {
  file: string;
  description: string;
  apply: () => void;
}

export interface ValidatorContext {
  discrepancies: Discrepancy[];
  fixActions: FixAction[];
  QUIET: boolean;
  VERBOSE: boolean;
  FIX: boolean;
  DRY_RUN: boolean;
}

export function error(ctx: ValidatorContext, message: string, file?: string, fixable = false) {
  ctx.discrepancies.push({ type: "validation", severity: "error", message, file, fixable });
  if (!ctx.QUIET) console.error(`  ❌ ${message}`);
}

export function warn(ctx: ValidatorContext, message: string, file?: string, fixable = false) {
  ctx.discrepancies.push({ type: "validation", severity: "warning", message, file, fixable });
  if (!ctx.QUIET) console.warn(`  ⚠️  ${message}`);
}

export function pass(ctx: ValidatorContext, message: string) {
  if (ctx.VERBOSE || (!ctx.QUIET && !ctx.FIX)) {
    console.log(`  ✅ ${message}`);
  }
}

export function log(ctx: ValidatorContext, message: string) {
  if (!ctx.QUIET) console.log(message);
}

export function dryLog(ctx: ValidatorContext, message: string) {
  if (ctx.DRY_RUN) console.log(`  🔸 Would fix: ${message}`);
}

export function walkDir(dir: string, prefix = ""): string[] {
  const entries: string[] = [];
  if (!existsSync(dir)) return entries;

  const items = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));

  for (const item of items) {
    if (item.name.startsWith(".") || item.name === "node_modules" || item.name === "checkpoints") continue;
    const relPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.isDirectory()) {
      entries.push(`${relPath}/`);
      entries.push(...walkDir(join(dir, item.name), relPath));
    } else {
      entries.push(relPath);
    }
  }
  return entries;
}
