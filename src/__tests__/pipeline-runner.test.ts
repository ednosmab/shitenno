/**
 * pipeline-runner.test.ts — Persisted pipeline run state + shell-friendly exec.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  savePipelineReport,
  loadLatestPipelineReport,
  getPipelineHistoryPath,
  runPipelineExec,
  type StoredPipelineReport,
} from "../infrastructure/pipeline-runner.js";
import { type CommandRunner, type ValidationReport } from "../infrastructure/validation-pipeline.js";

function makeReport(phase: "phase1" | "phase2" | "phase3", passed: boolean): ValidationReport {
  return {
    phase,
    startedAt: "2026-08-08T10:00:00.000Z",
    completedAt: "2026-08-08T10:01:00.000Z",
    passed,
    results: [
      {
        phase,
        gate: "common",
        name: "tests-pass",
        passed,
        duration: 1000,
        error: passed ? undefined : "command failed",
      },
    ],
    summary: { total: 1, passed: passed ? 1 : 0, failed: passed ? 0 : 1 },
  };
}

describe("pipeline-runner", () => {
  let testDir: string;
  let shitennoDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `pipeline-runner-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    mkdirSync(testDir, { recursive: true });
    shitennoDir = join(testDir, ".shitenno");
    mkdirSync(shitennoDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("saves a report to the pipeline history file", () => {
    const report = makeReport("phase1", true);
    savePipelineReport(shitennoDir, report);

    const path = getPipelineHistoryPath(shitennoDir);
    expect(existsSync(path)).toBe(true);
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as { runs: StoredPipelineReport[] };
    expect(parsed.runs).toHaveLength(1);
    expect(parsed.runs[0]?.report.phase).toBe("phase1");
  });

  it("loads the latest report after a save", () => {
    savePipelineReport(shitennoDir, makeReport("phase1", true));
    savePipelineReport(shitennoDir, makeReport("phase2", false));

    const latest = loadLatestPipelineReport(shitennoDir);
    expect(latest).not.toBeNull();
    expect(latest?.report.phase).toBe("phase2");
    expect(latest?.report.passed).toBe(false);
  });

  it("returns null when no history exists", () => {
    expect(loadLatestPipelineReport(shitennoDir)).toBeNull();
  });

  it("returns null when the history file is corrupt", () => {
    const path = getPipelineHistoryPath(shitennoDir);
    mkdirSync(join(shitennoDir, "reports"), { recursive: true });
    writeFileSync(path, "{not valid json", "utf-8");

    expect(loadLatestPipelineReport(shitennoDir)).toBeNull();
  });

  it("keeps only the last 20 runs", () => {
    for (let i = 0; i < 25; i++) {
      savePipelineReport(shitennoDir, makeReport("phase1", true));
    }

    const path = getPipelineHistoryPath(shitennoDir);
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as { runs: StoredPipelineReport[] };
    expect(parsed.runs.length).toBe(20);
  });
});

describe("pipeline-runner exec", () => {
  let testDir: string;
  let shitennoDir: string;

  const okRunner: CommandRunner = (cmd, timeout) => ({
    success: true,
    output: `ok: ${cmd}`,
    duration: 10,
    timeout,
  });

  const failRunner: CommandRunner = (cmd, _timeout) => ({
    success: false,
    output: `fail: ${cmd}`,
    duration: 10,
  });

  beforeEach(() => {
    testDir = join(tmpdir(), `pipeline-runner-exec-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    mkdirSync(testDir, { recursive: true });
    shitennoDir = join(testDir, ".shitenno");
    mkdirSync(shitennoDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("runs all phases and persists a report per phase", () => {
    const result = runPipelineExec(shitennoDir, { runner: okRunner });

    expect(result.allPassed).toBe(true);
    expect(result.reports).toHaveLength(3);

    const path = getPipelineHistoryPath(shitennoDir);
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as { runs: StoredPipelineReport[] };
    expect(parsed.runs).toHaveLength(3);
  });

  it("reports allPassed=false when a required phase fails", () => {
    const result = runPipelineExec(shitennoDir, { runner: failRunner });

    expect(result.allPassed).toBe(false);
    expect(result.reports.find((r) => r.phase === "phase1")?.passed).toBe(false);
    expect(result.reports.find((r) => r.phase === "phase2")?.passed).toBe(false);
  });

  it("runs only the requested phase when given a phase", () => {
    const result = runPipelineExec(shitennoDir, { runner: okRunner, phase: "phase2" });

    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]?.phase).toBe("phase2");
  });
});
