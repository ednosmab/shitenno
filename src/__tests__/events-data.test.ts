/**
 * events-data.test.ts — Tests for event trace data access
 *
 * Validates trace loading from JSONL files.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { loadTrace, type TraceEntry } from "../infrastructure/events-data.js";

describe("loadTrace", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `shitenno-trace-${Date.now()}`);
    mkdirSync(join(tmpDir, "telemetry"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when trace file missing", () => {
    const result = loadTrace(tmpDir);
    expect(result).toEqual([]);
  });

  it("parses valid JSONL entries", () => {
    const entry: TraceEntry = {
      timestamp: "2026-07-10T00:00:00Z",
      trigger: "test",
      eventType: "rule.evaluated",
      rulesEvaluated: 5,
      rulesExecuted: 3,
      rulesSkipped: 1,
      rulesFailed: 1,
      results: [],
    };
    writeFileSync(join(tmpDir, "telemetry", "rule-trace.jsonl"), JSON.stringify(entry) + "\n", "utf-8");
    const trace = loadTrace(tmpDir);
    expect(trace.length).toBe(1);
    expect(trace[0]?.trigger).toBe("test");
  });

  it("skips invalid JSON lines", () => {
    writeFileSync(join(tmpDir, "telemetry", "rule-trace.jsonl"), "invalid json\n", "utf-8");
    const trace = loadTrace(tmpDir);
    expect(trace.length).toBe(0);
  });

  it("handles empty file", () => {
    writeFileSync(join(tmpDir, "telemetry", "rule-trace.jsonl"), "", "utf-8");
    const result = loadTrace(tmpDir);
    expect(result).toEqual([]);
  });
});
