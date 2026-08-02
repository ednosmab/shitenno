#!/usr/bin/env npx tsx
/**
 * add-frontmatter.ts — One-time migration to add YAML frontmatter to all docs.
 *
 * Flags:
 *   --dry-run    Preview changes without writing
 *   --quiet / -q Minimal output
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { walkDir, ROOT_DOCS } from "./validators/shared.js";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const QUIET = args.includes("--quiet") || args.includes("-q");

const VALID_CATEGORIES = [
  "architecture",
  "domain",
  "implementation",
  "engineering",
  "evolution",
  "philosophy",
  "adr",
  "reference",
  "product",
] as const;

const VALID_LIFECYCLES = ["Draft", "Active", "Deprecated", "Historical", "Archived"] as const;

type Category = (typeof VALID_CATEGORIES)[number];
type Lifecycle = (typeof VALID_LIFECYCLES)[number];

function log(message: string) {
  if (!QUIET) console.log(message);
}

function determineCategory(relPath: string): Category {
  if (relPath.startsWith("architecture/")) return "architecture";
  if (relPath.startsWith("domain/")) return "domain";
  if (relPath.startsWith("implementation/")) return "implementation";
  if (relPath.startsWith("engineering/")) return "engineering";
  if (relPath.startsWith("evolution/")) return "evolution";
  if (relPath.startsWith("handbook/philosophy/")) return "philosophy";
  if (relPath.startsWith("adr/")) return "adr";
  if (relPath.startsWith("reference/")) return "reference";
  if (relPath.startsWith("plans/")) return "product";
  if (relPath.startsWith("history/")) return "reference";
  if (relPath.startsWith("backlog/")) return "product";
  if (relPath.startsWith("feedback/")) return "engineering";
  if (relPath.startsWith("tests/")) return "engineering";
  if (relPath.startsWith("handbook/02-commands/")) return "reference";
  if (relPath.startsWith("handbook/03-architecture/")) return "architecture";
  return "product";
}

function determineLifecycle(relPath: string): Lifecycle {
  if (relPath.startsWith("history/")) return "Historical";
  if (relPath.startsWith("feedback/")) return "Historical";
  if (relPath.startsWith("backlog/")) return "Draft";
  return "Active";
}

function hasFrontmatter(content: string): boolean {
  const lines = content.split("\n");
  return lines.length > 0 && lines[0].trim() === "---";
}

function buildFrontmatter(category: Category, lifecycle: Lifecycle): string {
  return `---\ncategory: ${category}\nlifecycle: ${lifecycle}\n---\n\n`;
}

function main() {
  const files = walkDir(ROOT_DOCS).filter((f) => f.endsWith(".md") && !f.endsWith("README.md"));
  let added = 0;
  let skipped = 0;

  for (const relPath of files) {
    const fullPath = resolve(ROOT_DOCS, relPath);
    const content = readFileSync(fullPath, "utf-8");

    if (hasFrontmatter(content)) {
      skipped++;
      continue;
    }

    const category = determineCategory(relPath);
    const lifecycle = determineLifecycle(relPath);
    const frontmatter = buildFrontmatter(category, lifecycle);
    const newContent = frontmatter + content;

    if (DRY_RUN) {
      log(`  🔸 Would add frontmatter to: ${relPath} (category: ${category}, lifecycle: ${lifecycle})`);
    } else {
      writeFileSync(fullPath, newContent, "utf-8");
      log(`  ✅ Added frontmatter to: ${relPath}`);
    }
    added++;
  }

  log(`\n📊 ${DRY_RUN ? "Dry run" : "Migration complete"}: ${added} files processed, ${skipped} skipped (already have frontmatter)`);
}

main();
