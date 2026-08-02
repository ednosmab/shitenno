import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateCompletionGate } from "../task-completion.js";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const mockCheckTests = vi.fn();
const mockCheckLint = vi.fn();

vi.mock("../plan-lifecycle.js", () => ({
  checkTests: (...args: unknown[]) => mockCheckTests(...args),
  checkLint: (...args: unknown[]) => mockCheckLint(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckTests.mockReturnValue({ name: "TESTS", passed: true, message: "Tests passed" });
  mockCheckLint.mockReturnValue({ name: "LINT", passed: true, message: "Lint passed" });
});

describe("task-completion", () => {
  describe("validateCompletionGate", () => {
    it("returns result with 5 gates", () => {
      const result = validateCompletionGate({
        projectRoot: process.cwd(),
        shitennoDir: process.cwd(),
        taskId: "TEST-001",
      });
      expect(result.taskId).toBe("TEST-001");
      expect(result.gates).toHaveLength(5);
    });

    it("returns gate names in order", () => {
      const result = validateCompletionGate({
        projectRoot: process.cwd(),
        shitennoDir: process.cwd(),
        taskId: "TEST-002",
      });
      expect(result.gates[0]?.name).toBe("tests");
      expect(result.gates[1]?.name).toBe("lint");
      expect(result.gates[2]?.name).toBe("documentation");
      expect(result.gates[3]?.name).toBe("backlog");
      expect(result.gates[4]?.name).toBe("plan_status");
    });

    it("returns all gates passed when checkTests/checkLint succeed", () => {
      const result = validateCompletionGate({
        projectRoot: process.cwd(),
        shitennoDir: process.cwd(),
        taskId: "TEST-005",
      });
      expect(result.passed).toBe(true);
    });

    it("reports failed gates when checkTests fails", () => {
      mockCheckTests.mockReturnValue({ name: "TESTS", passed: false, message: "Tests failed" });
      const result = validateCompletionGate({
        projectRoot: process.cwd(),
        shitennoDir: process.cwd(),
        taskId: "TEST-006",
      });
      const testGate = result.gates[0]!;
      expect(testGate.name).toBe("tests");
      expect(testGate.passed).toBe(false);
    });

    it("skips documentation check when no affected files", () => {
      const result = validateCompletionGate({
        projectRoot: process.cwd(),
        shitennoDir: process.cwd(),
        taskId: "TEST-004",
      });
      const docGate = result.gates[2]!;
      expect(docGate.name).toBe("documentation");
      expect(docGate.passed).toBe(true);
      expect(docGate.message).toContain("No affected files specified");
    });

    it("skips backlog check when no backlog file exists", () => {
      const result = validateCompletionGate({
        projectRoot: process.cwd(),
        shitennoDir: "/nonexistent-shitenno",
        taskId: "NONEXISTENT",
      });
      const backlogGate = result.gates[3]!;
      expect(backlogGate.name).toBe("backlog");
      expect(backlogGate.passed).toBe(true);
      expect(backlogGate.message).toContain("No backlog found");
    });

    it("detects missing backlog update for existing item", () => {
      const dir = join(tmpdir(), `completion-test-${randomUUID()}`);
      mkdirSync(join(dir, "docs"), { recursive: true });
      const backlogPath = join(dir, "docs", "BACKLOG.md");
      writeFileSync(backlogPath, "### TASK-010 Some Item\n\n| **Status** | Backlog |", "utf-8");

      const result = validateCompletionGate({
        projectRoot: process.cwd(),
        shitennoDir: dir,
        taskId: "TASK-010",
      });
      const backlogGate = result.gates[3]!;
      expect(backlogGate.name).toBe("backlog");
      expect(backlogGate.passed).toBe(false);
      expect(backlogGate.message).toContain("TASK-010 found but not marked as Done");

      rmSync(dir, { recursive: true, force: true });
    });

    it("passes backlog check when item is marked Done", () => {
      const dir = join(tmpdir(), `completion-test-${randomUUID()}`);
      mkdirSync(join(dir, "docs"), { recursive: true });
      const backlogPath = join(dir, "docs", "BACKLOG.md");
      writeFileSync(backlogPath, "### TASK-020 Some Item\n\n| **Status** | Done — 2026-07-06 |", "utf-8");

      const result = validateCompletionGate({
        projectRoot: process.cwd(),
        shitennoDir: dir,
        taskId: "TASK-020",
      });
      const backlogGate = result.gates[3]!;
      expect(backlogGate.name).toBe("backlog");
      expect(backlogGate.passed).toBe(true);
      expect(backlogGate.message).toContain("TASK-020 marked as Done");

      rmSync(dir, { recursive: true, force: true });
    });

    it("skips plan_status check when no plans directory", () => {
      const result = validateCompletionGate({
        projectRoot: process.cwd(),
        shitennoDir: "/nonexistent-shitenno",
        taskId: "TEST-PLAN",
      });
      const planGate = result.gates[4]!;
      expect(planGate.name).toBe("plan_status");
      expect(planGate.passed).toBe(true);
      expect(planGate.message).toContain("No plans directory found");
    });

    it("passes plan_status when no matching plan exists", () => {
      const dir = join(tmpdir(), `completion-test-${randomUUID()}`);
      mkdirSync(join(dir, "governance", "plans"), { recursive: true });

      const result = validateCompletionGate({
        projectRoot: process.cwd(),
        shitennoDir: dir,
        taskId: "NONEXISTENT-PLAN",
      });
      const planGate = result.gates[4]!;
      expect(planGate.name).toBe("plan_status");
      expect(planGate.passed).toBe(true);
      expect(planGate.message).toContain("No active plan found");

      rmSync(dir, { recursive: true, force: true });
    });

    it("fails plan_status when plan has andamento status", () => {
      const dir = join(tmpdir(), `completion-test-${randomUUID()}`);
      mkdirSync(join(dir, "governance", "plans"), { recursive: true });
      const planPath = join(dir, "governance", "plans", "TASK-1-test-plan.md");
      writeFileSync(planPath, "# Test Plan\n\n**Status:** andamento\n", "utf-8");

      const result = validateCompletionGate({
        projectRoot: process.cwd(),
        shitennoDir: dir,
        taskId: "TASK-1",
      });
      const planGate = result.gates[4]!;
      expect(planGate.name).toBe("plan_status");
      expect(planGate.passed).toBe(false);
      expect(planGate.message).toContain("status is \"andamento\"");

      rmSync(dir, { recursive: true, force: true });
    });

    it("passes plan_status when plan has done status", () => {
      const dir = join(tmpdir(), `completion-test-${randomUUID()}`);
      mkdirSync(join(dir, "governance", "plans"), { recursive: true });
      const planPath = join(dir, "governance", "plans", "TASK-1-test-plan.md");
      writeFileSync(planPath, "# Test Plan\n\n**Status:** Done\n", "utf-8");

      const result = validateCompletionGate({
        projectRoot: process.cwd(),
        shitennoDir: dir,
        taskId: "TASK-1",
      });
      const planGate = result.gates[4]!;
      expect(planGate.name).toBe("plan_status");
      expect(planGate.passed).toBe(true);
      expect(planGate.message).toContain("status is \"Done\"");

      rmSync(dir, { recursive: true, force: true });
    });
  });
});
