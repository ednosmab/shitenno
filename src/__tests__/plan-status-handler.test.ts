import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("node:child_process", () => ({
  execSync: vi.fn().mockReturnValue(""),
}));

import { handlePlanStatus, VALID_PLAN_STATUSES } from "../commands/plan/md-status.js";

describe("handlePlanStatus (in-process, no subprocess)", () => {
  let dir: string;

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    dir = mkdtempSync(join(tmpdir(), "plan-status-"));
    mkdirSync(join(dir, ".shitenno/governance/plans"), { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "t" }));
    writeFileSync(
      join(dir, ".shitenno/governance/plans/PLAN-A.md"),
      `# Plan A\n\n**Status:** In Progress\n`
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects invalid status", () => {
    const result = handlePlanStatus(join(dir, ".shitenno"), "PLAN-A", "invalid-status");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid status/);
  });

  it("accepts all valid statuses", () => {
    for (const status of VALID_PLAN_STATUSES) {
      // Create fresh plan for each status since "done" moves the file
      writeFileSync(
        join(dir, ".shitenno/governance/plans/PLAN-A.md"),
        `# Plan A\n\n**Status:** In Progress\n`
      );
      const result = handlePlanStatus(join(dir, ".shitenno"), "PLAN-A", status);
      expect(result.success).toBe(true);
    }
  });
});
