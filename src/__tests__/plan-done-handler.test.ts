import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("node:child_process", () => ({
  execSync: vi.fn().mockReturnValue(""),
}));

import { handlePlanDone } from "../commands/plan/md-done.js";

describe("handlePlanDone (in-process, no subprocess)", () => {
  let dir: string;

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    dir = mkdtempSync(join(tmpdir(), "plan-done-"));
    mkdirSync(join(dir, ".shitenno/governance/plans"), { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "t" }));
    writeFileSync(
      join(dir, ".shitenno/governance/plans/PLAN-A.md"),
      "# A\n\n**Status:** In Progress\n"
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  it("blocks when there is no test script", () => {
    const result = handlePlanDone(join(dir, ".shitenno"), dir, "PLAN-A");
    expect(result.passed).toBe(false);
    expect(result.checks.find((c) => c.name === "TESTS")?.message).toMatch(/No 'test'/);
  });

  it("returns checks array with BUILD, TESTS, LINT, GATE_SELF_TEST, DOCS", () => {
    const result = handlePlanDone(join(dir, ".shitenno"), dir, "PLAN-A");
    const names = result.checks.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["BUILD", "TESTS", "LINT", "GATE_SELF_TEST", "DOCS"]));
  });
});
