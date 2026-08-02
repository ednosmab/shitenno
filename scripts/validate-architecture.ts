#!/usr/bin/env npx tsx
/**
 * validate-architecture.ts — Architecture Validation Script
 *
 * Checks for file size violations, oversized functions, and circular imports.
 * Used as a CI gate and local pre-commit check.
 *
 * Exit codes:
 *   0 — All checks passed
 *   1 — Violations found
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = resolve(ROOT, "src");

const MAX_FILE_LINES = 300;
const MAX_FUNCTION_LINES = 50;
const EXCLUDE_DIRS = ["__tests__", "templates"];

interface Violation {
  type: "file_too_large" | "function_too_large" | "circular_import";
  file: string;
  detail: string;
  lines?: number;
}

const violations: Violation[] = [];

function getSourceFiles(dir: string): string[] {
  const files: string[] = [];
  if (!statSync(dir).isDirectory()) return files;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    if (EXCLUDE_DIRS.includes(entry.name)) continue;

    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getSourceFiles(fullPath));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

function checkFileSizes(files: string[]): void {
  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    const lines = content.split("\n");
    let inJsdocBlock = false;
    let effectiveLines = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines
      if (trimmed === "") continue;

      // Track JSDoc block state (/* ... */)
      if (trimmed.startsWith("/*")) {
        inJsdocBlock = true;
      }
      if (inJsdocBlock) {
        if (trimmed.includes("*/")) {
          inJsdocBlock = false;
        }
        continue; // Skip all lines inside JSDoc blocks
      }

      // Skip single-line comments (//)
      if (trimmed.startsWith("//")) continue;

      effectiveLines++;
    }

    if (effectiveLines > MAX_FILE_LINES) {
      violations.push({
        type: "file_too_large",
        file: relative(ROOT, file),
        detail: `${effectiveLines} lines (max ${MAX_FILE_LINES})`,
        lines: effectiveLines,
      });
    }
  }
}

function checkFunctionSizes(files: string[]): void {
  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    const lines = content.split("\n");

    let inFunction = false;
    let funcName = "";
    let funcStart = 0;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!inFunction) {
        const match = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
        if (match) {
          inFunction = true;
          funcName = match[1];
          funcStart = i;
          braceDepth = 0;
        }
      } else {
        braceDepth += (line.match(/{/g) || []).length;
        braceDepth -= (line.match(/}/g) || []).length;

        if (braceDepth <= 0) {
          const funcLines = i - funcStart + 1;
          if (funcLines > MAX_FUNCTION_LINES) {
            violations.push({
              type: "function_too_large",
              file: relative(ROOT, file),
              detail: `${funcName}(): ${funcLines} lines (max ${MAX_FUNCTION_LINES})`,
              lines: funcLines,
            });
          }
          inFunction = false;
        }
      }
    }
  }
}

function checkCircularImports(files: string[]): void {
  const imports = new Map<string, string[]>();

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    const relFile = relative(ROOT, file);
    const deps: string[] = [];

    const importMatches = content.matchAll(/(?:import|from)\s+["']([^"']+)["']/g);
    for (const match of importMatches) {
      const dep = match[1];
      if (dep.startsWith(".") || dep.startsWith("node:")) {
        deps.push(dep);
      }
    }
    imports.set(relFile, deps);
  }

  // Simple cycle detection (DFS)
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string, path: string[]): boolean {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      const cycle = path.slice(cycleStart).join(" → ");
      violations.push({
        type: "circular_import",
        file: node,
        detail: `Circular: ${cycle} → ${node}`,
      });
      return true;
    }
    if (visited.has(node)) return false;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const dep of imports.get(node) || []) {
      // Resolve relative imports to absolute path
      const resolvedDep = dep.startsWith(".")
        ? relative(ROOT, resolve(ROOT, node, "..", dep))
        : dep;
      if (imports.has(resolvedDep)) {
        dfs(resolvedDep, [...path]);
      }
    }

    inStack.delete(node);
    path.pop();
    return false;
  }

  for (const file of imports.keys()) {
    dfs(file, []);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────

function main() {
  console.log("\n🔍 Architecture Validation\n");

  const files = getSourceFiles(SRC);
  console.log(`  Scanning ${files.length} source files...\n`);

  checkFileSizes(files);
  checkFunctionSizes(files);
  checkCircularImports(files);

  if (violations.length === 0) {
    console.log("✅ All architecture checks passed.\n");
    process.exit(0);
  }

  console.log(`❌ Found ${violations.length} violation(s):\n`);
  for (const v of violations) {
    console.log(`  [${v.type}] ${v.file}: ${v.detail}`);
  }

  console.log("\n💡 Fix violations before committing. See ADR-007 for thresholds.\n");
  process.exit(1);
}

main();
