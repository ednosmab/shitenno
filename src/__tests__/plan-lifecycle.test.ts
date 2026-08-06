import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  detectActivePlans,
  archivePlan,
  removePlan,
  checkAndArchiveDonePlans,
  type CompletionCheck,
  type ValidationResult,
  type LifecycleResult,
} from "../application/plan-lifecycle.js";
import { detectCommand } from "../commands/detect.js";

vi.mock("../infrastructure/markdown-plan-engine.js", () => {
  const mockList = vi.fn().mockReturnValue([
    { id: "plan-1", status: "active", title: "Test Plan 1", isActive: true },
    { id: "plan-2", status: "done", title: "Test Plan 2", isActive: false },
    { id: "plan-3", status: "in-progress", title: "Test Plan 3", isActive: true },
  ]);
  const mockListAll = vi.fn().mockReturnValue([
    { id: "plan-1", status: "andamento", title: "Test Plan 1", isActive: true },
    { id: "plan-2", status: "done", title: "Test Plan 2", isActive: false },
    { id: "plan-3", status: "andamento", title: "Test Plan 3", isActive: true },
  ]);
  const mockUpdate = vi.fn();
  const mockArchiveIfDone = vi.fn().mockImplementation((id: string) => {
    // Only archive plan-1 if it has status done
    return id === "plan-archive-me";
  });
  return {
    MarkdownPlanEngine: vi.fn(function () {
      return { list: mockList, listAll: mockListAll, updateStatus: mockUpdate, archiveIfDone: mockArchiveIfDone };
    }),
    __mockList: mockList,
    __mockListAll: mockListAll,
    __mockUpdate: mockUpdate,
    __mockArchiveIfDone: mockArchiveIfDone,
  };
});

vi.mock("ora", () => ({
  default: vi.fn().mockReturnValue({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: "",
  }),
}));

vi.mock("chalk", () => ({
  default: {
    bold: Object.assign((s: string) => s, { cyan: (s: string) => s, green: (s: string) => s, red: (s: string) => s, yellow: (s: string) => s }),
    cyan: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
    yellow: (s: string) => s,
    dim: (s: string) => s,
  },
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, existsSync: vi.fn().mockReturnValue(true) };
});

vi.mock("node:child_process", () => ({
  execSync: vi.fn().mockReturnValue(""),
}));

vi.mock("node:readline", () => ({
  createInterface: vi.fn().mockReturnValue({
    question: vi.fn((_q: string, cb: Function) => cb("a")),
    close: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ── detectActivePlans ──────────────────────────────────────────────────────

describe("detectActivePlans", () => {
  it("returns plans that are not done", () => {
    const plans = detectActivePlans("/shugo");
    expect(plans).toHaveLength(2);
    expect(plans.map((p) => p.id)).toContain("plan-1");
    expect(plans.map((p) => p.id)).toContain("plan-3");
    expect(plans.map((p) => p.id)).not.toContain("plan-2");
  });
});

// ── archivePlan ────────────────────────────────────────────────────────────

describe("archivePlan", () => {
  it("calls updateStatus with done", async () => {
    const mod = await import("../infrastructure/markdown-plan-engine.js") as any;
    archivePlan("/shugo", "plan-1");
    expect(mod.__mockUpdate).toHaveBeenCalledWith("plan-1", "done");
  });
});

// ── removePlan ─────────────────────────────────────────────────────────────

describe("removePlan", () => {
  it("calls updateStatus with done", async () => {
    const mod = await import("../infrastructure/markdown-plan-engine.js") as any;
    removePlan("/shugo", "plan-1");
    expect(mod.__mockUpdate).toHaveBeenCalledWith("plan-1", "done");
  });
});

// ── Type exports ───────────────────────────────────────────────────────────

describe("type exports", () => {
  it("CompletionCheck type is usable", () => {
    const check: CompletionCheck = { name: "BUILD", passed: true, message: "ok" };
    expect(check.name).toBe("BUILD");
  });

  it("ValidationResult type is usable", () => {
    const result: ValidationResult = { valid: true, checks: [], passed: true, verifiedAt: new Date().toISOString() };
    expect(result.valid).toBe(true);
  });

  it("LifecycleResult type is usable", () => {
    const result: LifecycleResult = { checked: 1, archived: 0, archivedIds: [], active: true };
    expect(result.active).toBe(true);
  });
});

// ── checkAndArchiveDonePlans ──────────────────────────────────────────────

describe("checkAndArchiveDonePlans", () => {
  it("returns zero archived when no plans have Status: Done", () => {
    const result = checkAndArchiveDonePlans("/shugo");
    expect(result.checked).toBeGreaterThanOrEqual(0);
    expect(result.archived).toBe(0);
    expect(result.archivedIds).toHaveLength(0);
  });

  it("is idempotent: running twice does not duplicate work", () => {
    const result1 = checkAndArchiveDonePlans("/shugo");
    const result2 = checkAndArchiveDonePlans("/shugo");
    expect(result1.checked).toBe(result2.checked);
    expect(result1.archived).toBe(result2.archived);
  });

  it("calls archiveIfDone for each active plan", async () => {
    checkAndArchiveDonePlans("/shugo");
    const mod = await import("../infrastructure/markdown-plan-engine.js") as any;
    expect(mod.__mockArchiveIfDone).toHaveBeenCalledWith("plan-1");
    expect(mod.__mockArchiveIfDone).toHaveBeenCalledWith("plan-3");
  });

  it("skips inactive plans (already in done/)", async () => {
    checkAndArchiveDonePlans("/shugo");
    const mod = await import("../infrastructure/markdown-plan-engine.js") as any;
    // plan-2 has isActive: false — should NOT be called
    expect(mod.__mockArchiveIfDone).not.toHaveBeenCalledWith("plan-2");
  });

  it("populates archivedIds when archiveIfDone returns true", async () => {
    const mod = await import("../infrastructure/markdown-plan-engine.js") as any;
    // Make mockArchiveIfDone return true for plan-3
    mod.__mockArchiveIfDone.mockImplementation((id: string) => id === "plan-3");

    const result = checkAndArchiveDonePlans("/shugo");
    expect(result.archived).toBe(1);
    expect(result.archivedIds).toContain("plan-3");
  });
});

// ── Step 2.9: shugo detect --auto doesn't error on unknown option ──────────

describe("Step 2.9: detect --auto option", () => {
  it("detectCommand accepts --auto option without Commander error", () => {
    // If Commander.js rejects --auto, this would throw an error
    // The fact that detectCommand is defined with .option("--auto", ...) means it's valid
    const opts = detectCommand.options.map((o) => o.long || o.short);
    expect(opts).toContain("--auto");
  });
});
