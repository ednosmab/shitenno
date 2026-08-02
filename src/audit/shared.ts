/**
 * Audit module — Shared utility functions
 *
 * Common utilities used across governance and engineering detectors.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { SOURCE_SKIP_PATTERNS } from "./constants.js";
import { walkSourceFiles } from "../utils.js";
import type { SourceFileInfo, HistoryEntry, HealthIssue } from "./types.js";

/**
 * Collect all source files (.ts, .tsx, .js, .jsx, .vue, .svelte) from the project.
 * Uses the shared walkSourceFiles utility for consistent extension and directory handling.
 */
export function collectSourceFiles(projectRoot: string): SourceFileInfo[] {
  const result: SourceFileInfo[] = [];

  walkSourceFiles(projectRoot, (fullPath, fileName) => {
    // Skip test infrastructure (fixtures, mocks, helpers without .test. in name)
    if (fullPath.includes("/__tests__/") || fullPath.includes("\\__tests__\\")) return;
    // Apply skip patterns (test files, bench files)
    if (SOURCE_SKIP_PATTERNS.some((p) => p.test(fileName))) return;

    try {
      const content = readFileSync(fullPath, "utf-8");
      const lineCount = content.split("\n").length;
      const basename = fileName.replace(/\.[^.]+$/, "");
      result.push({
        fullPath,
        relPath: fullPath.replace(projectRoot + "/", ""),
        basename,
        content,
        lineCount,
      });
    } catch { /* skip unreadable files */ }
  });

  return result;
}

/**
 * Read history entries from shitenno/docs/history/*.md.
 */
export function readHistory(shitennoDir: string): HistoryEntry[] {
  const historyDir = join(shitennoDir, "docs", "history");
  if (!existsSync(historyDir)) return [];

  return readdirSync(historyDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("README"))
    .map((file) => {
      const content = readFileSync(join(historyDir, file), "utf-8");
      const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
      return { filename: file, date: dateMatch?.[1] ?? "unknown", content: content.toLowerCase() };
    });
}

/**
 * Read rule names from AGENTS.md.
 */
export function readRules(shitennoDir: string): string[] {
  const agentsPath = join(shitennoDir, "docs", "AGENTS.md");
  if (!existsSync(agentsPath)) return [];

  const content = readFileSync(agentsPath, "utf-8");
  const rules: string[] = [];
  // Match numbered rules: "1. **RULE NAME**: description"
  const numberedRegex = /^\d+\.\s+\*\*([^*]+)\*\*/gm;
  let match;
  while ((match = numberedRegex.exec(content)) !== null) {
    const rule = match[1];
    if (rule) rules.push(rule.trim());
  }
  return [...new Set(rules)];
}

/**
 * Remove issues duplicadas por (type, description, location).
 */
export function deduplicateIssues(issues: HealthIssue[]): HealthIssue[] {
  const seen = new Map<string, HealthIssue>();
  const locationHits = new Map<string, number>();

  for (const issue of issues) {
    const key = `${issue.type}|${issue.description}|${issue.location}`;
    if (!seen.has(key)) {
      seen.set(key, issue);
    }
    locationHits.set(issue.location, (locationHits.get(issue.location) ?? 0) + 1);
  }

  return Array.from(seen.values()).map((issue) => {
    const hits = locationHits.get(issue.location) ?? 1;
    if (hits > 1 && issue.confidence !== undefined) {
      return { ...issue, confidence: Math.min(1, issue.confidence + 0.1 * (hits - 1)) };
    }
    return issue;
  });
}

/**
 * Remove line (//) and block (/* *​/) comments from source code.
 * Preserves newlines so line numbers stay aligned.
 * Not a full parser — just enough to stop regex detectors from matching prose.
 */
export function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

/**
 * Hash estável do issue, usado para supressão e tracking histórico.
 */
export function issueFingerprint(issue: HealthIssue): string {
  return createHash("sha1")
    .update(`${issue.type}|${issue.location}|${issue.description}`)
    .digest("hex")
    .slice(0, 10);
}
