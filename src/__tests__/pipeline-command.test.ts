/**
 * pipeline-command.test.ts — Subcommand wiring for `shugo pipeline exec|status|notify`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../infrastructure/notify.js", () => ({
  sendDesktopNotification: vi.fn(() => true),
  logNotificationOnly: vi.fn(),
}));

vi.mock("../infrastructure/pipeline-runner.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../infrastructure/pipeline-runner.js")>();
  return {
    ...actual,
    runPipelineExec: vi.fn(),
  };
});

import { pipelineCommand } from "../commands/pipeline.js";
import { savePipelineReport, runPipelineExec } from "../infrastructure/pipeline-runner.js";
import { sendDesktopNotification } from "../infrastructure/notify.js";
import type { ValidationReport } from "../infrastructure/validation-pipeline.js";
import type { Mock } from "vitest";

let tempDir: string;
let shitennoDir: string;
let stdoutSpy: ReturnType<typeof vi.spyOn>;

function makeReport(passed: boolean): ValidationReport {
  return {
    phase: "phase1",
    startedAt: "2026-08-08T10:00:00.000Z",
    completedAt: "2026-08-08T10:01:00.000Z",
    passed,
    results: [
      {
        phase: "phase1",
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

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "pipeline-cmd-"));
  shitennoDir = join(tempDir, ".shitenno");
  mkdirSync(shitennoDir, { recursive: true });
  stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.clearAllMocks();
  (runPipelineExec as Mock).mockReset();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  stdoutSpy.mockRestore();
});

describe("shugo pipeline exec", () => {
  it("sets exit code 0 when all phases passed", () => {
    (runPipelineExec as Mock).mockReturnValue({ reports: [makeReport(true)], allPassed: true });
    const originalExitCode = process.exitCode;

    pipelineCommand.parse(["exec", "--dir", tempDir], { from: "user" });

    expect(process.exitCode).toBe(0);
    process.exitCode = originalExitCode;
  });

  it("sets exit code 1 when a phase failed", () => {
    (runPipelineExec as Mock).mockReturnValue({ reports: [makeReport(false)], allPassed: false });
    const originalExitCode = process.exitCode;

    pipelineCommand.parse(["exec", "--dir", tempDir], { from: "user" });

    expect(process.exitCode).toBe(1);
    process.exitCode = originalExitCode;
  });

  it("forwards the phase option", () => {
    (runPipelineExec as Mock).mockReturnValue({ reports: [makeReport(true)], allPassed: true });
    const originalExitCode = process.exitCode;

    pipelineCommand.parse(["exec", "--phase", "phase2", "--dir", tempDir], { from: "user" });

    expect(runPipelineExec).toHaveBeenCalledWith(shitennoDir, { phase: "phase2" });
    process.exitCode = originalExitCode;
  });
});

describe("shugo pipeline status", () => {
  it("reports when no runs exist", () => {
    pipelineCommand.parse(["status", "--dir", tempDir], { from: "user" });
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining("No pipeline runs recorded"));
  });

  it("shows the latest run", () => {
    savePipelineReport(shitennoDir, makeReport(true));

    pipelineCommand.parse(["status", "--dir", tempDir], { from: "user" });

    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining("Last pipeline run"));
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining("PASSED"));
  });
});

describe("shugo pipeline notify", () => {
  it("sends a high-priority notification when the latest run failed", () => {
    savePipelineReport(shitennoDir, makeReport(false));

    pipelineCommand.parse(["notify", "--dir", tempDir], { from: "user" });

    expect(sendDesktopNotification).toHaveBeenCalledWith(
      shitennoDir,
      expect.stringContaining("Failed"),
      expect.any(String),
      "high",
    );
  });

  it("sends a low-priority notification when the latest run passed", () => {
    savePipelineReport(shitennoDir, makeReport(true));

    pipelineCommand.parse(["notify", "--dir", tempDir], { from: "user" });

    expect(sendDesktopNotification).toHaveBeenCalledWith(
      shitennoDir,
      expect.stringContaining("Passed"),
      expect.any(String),
      "low",
    );
  });

  it("reports when no runs exist", () => {
    pipelineCommand.parse(["notify", "--dir", tempDir], { from: "user" });
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining("No pipeline runs recorded"));
  });
});
