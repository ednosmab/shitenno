/**
 * usage-tracker.ts — Lightweight MCP tool usage tracking.
 *
 * Records tool call counts and timestamps to a JSONL file.
 * Used by getBacklog(recommend=true) to refine suggestions
 * based on actual usage patterns.
 */

import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

interface UsageEntry {
  tool: string;
  timestamp: string;
}

interface UsageStats {
  tool: string;
  count: number;
  lastUsed: string;
}

function getUsagePath(shitennoDir: string): string {
  return join(shitennoDir, "governance", "context", "usage-log.jsonl");
}

export function recordToolCall(shitennoDir: string, toolName: string): void {
  const path = getUsagePath(shitennoDir);
  const dir = join(shitennoDir, "governance", "context");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const entry: UsageEntry = { tool: toolName, timestamp: new Date().toISOString() };
  appendFileSync(path, JSON.stringify(entry) + "\n", "utf-8");
}

export function getUsageStats(shitennoDir: string, limit = 50): UsageStats[] {
  const path = getUsagePath(shitennoDir);
  if (!existsSync(path)) return [];

  const lines = readFileSync(path, "utf-8").trim().split("\n").filter(Boolean);
  const recent = lines.slice(-limit);

  const counts = new Map<string, { count: number; lastUsed: string }>();
  for (const line of recent) {
    try {
      const entry: UsageEntry = JSON.parse(line);
      const existing = counts.get(entry.tool);
      if (existing) {
        existing.count++;
        if (entry.timestamp > existing.lastUsed) existing.lastUsed = entry.timestamp;
      } else {
        counts.set(entry.tool, { count: 1, lastUsed: entry.timestamp });
      }
    } catch {
      // Skip malformed lines
    }
  }

  return Array.from(counts.entries())
    .map(([tool, stats]) => ({ tool, ...stats }))
    .sort((a, b) => b.count - a.count);
}
