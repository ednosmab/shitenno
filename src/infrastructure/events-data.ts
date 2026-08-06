/**
 * events-data.ts — Event trace data access
 *
 * Reads rule engine execution trace from telemetry/rule-trace.jsonl.
 * Separated from commands/events.ts to respect architecture boundaries
 * (commands cannot import node:fs directly).
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface TraceEntry {
  timestamp: string;
  trigger: string;
  eventType: string;
  rulesEvaluated: number;
  rulesExecuted: number;
  rulesSkipped: number;
  rulesFailed: number;
  results: Array<{
    ruleId: string;
    success: boolean;
    actionsExecuted: number;
    duration: number;
  }>;
}

export function loadTrace(shitennoDir: string): TraceEntry[] {
  const tracePath = join(shitennoDir, "telemetry", "rule-trace.jsonl");
  if (!existsSync(tracePath)) return [];

  const content = readFileSync(tracePath, "utf-8");
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line) as TraceEntry;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is TraceEntry => entry !== null);
}
