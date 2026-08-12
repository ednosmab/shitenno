/**
 * usage-tracker.ts — Lightweight MCP tool usage tracking.
 *
 * Records tool call counts and timestamps to a JSONL file.
 * Used by getBacklog(recommend=true) to refine suggestions
 * based on actual usage patterns.
 */

import { existsSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

interface UsageEntry {
  tool: string;
  timestamp: string;
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
