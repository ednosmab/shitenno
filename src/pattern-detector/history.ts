/**
 * pattern-detector/history.ts — History reader for pattern detection
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface HistoryEntry {
  filename: string;
  date: string;
  content: string;
  violations: string[];
  areas: string[];
}

export function readHistoryEntries(shitennoDir: string): HistoryEntry[] {
  const historyDir = join(shitennoDir, "docs", "history");
  if (!existsSync(historyDir)) return [];

  const files = readdirSync(historyDir).filter(
    (f) => f.endsWith(".md") && !f.startsWith("README")
  );

  const violationKeywords = [
    "erro", "bug", "corrigi", "falhou", "rollback",
    "violação", "violated", "revert", "fix", "broken",
    "regression", "incidente", "problema",
  ];

  return files.map((file) => {
    const content = readFileSync(join(historyDir, file), "utf-8");
    const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch?.[1] ?? "unknown";
    const lower = content.toLowerCase();
    const violations = violationKeywords.filter((kw) => lower.includes(kw));
    const areaRegex = /((?:src|packages|apps|lib)\/[\w-]+)/g;
    const areaMatches = content.match(areaRegex) || [];
    const areas = [...new Set(areaMatches)];
    return { filename: file, date, content, violations, areas };
  });
}
