import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { generateDynamicRules } from "../infrastructure/dynamic-rules.js";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockExecSync = vi.mocked(execSync);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── generateDynamicRules ───────────────────────────────────────────────────

describe("generateDynamicRules", () => {
  it("returns empty array when no git history and no history dir", () => {
    mockExecSync.mockImplementation(() => { throw new Error("no git"); });
    mockExistsSync.mockReturnValue(false);

    const rules = generateDynamicRules("/project", "/shugo");
    expect(rules).toEqual([]);
  });

  it("detects force pushes from git log", () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("force push") || cmd.includes("forced push") || cmd.includes("\\+\\+")) return "5\n";
      if (cmd.includes("revert")) return "0\n";
      if (cmd.includes("hotfix")) return "0\n";
      return "0\n";
    });
    mockExistsSync.mockReturnValue(false);

    const rules = generateDynamicRules("/project", "/shugo");
    const forcePushRule = rules.find((r) => r.id === "git-force-push");
    expect(forcePushRule).toBeDefined();
    expect(forcePushRule!.incidentCount).toBe(5);
    expect(forcePushRule!.severity).toBe("high");
  });

  it("detects reverts from git log", () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("force push") || cmd.includes("forced push") || cmd.includes("\\+\\+")) return "0\n";
      if (cmd.includes("revert")) return "4\n";
      if (cmd.includes("hotfix")) return "0\n";
      return "0\n";
    });
    mockExistsSync.mockReturnValue(false);

    const rules = generateDynamicRules("/project", "/shugo");
    const revertRule = rules.find((r) => r.id === "git-reverts");
    expect(revertRule).toBeDefined();
    expect(revertRule!.incidentCount).toBe(4);
    expect(revertRule!.severity).toBe("medium");
  });

  it("does not create revert rule when count <= 2", () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("revert")) return "2\n";
      return "0\n";
    });
    mockExistsSync.mockReturnValue(false);

    const rules = generateDynamicRules("/project", "/shugo");
    expect(rules.find((r) => r.id === "git-reverts")).toBeUndefined();
  });

  it("detects hotfixes from git log", () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("force push") || cmd.includes("forced push") || cmd.includes("\\+\\+")) return "0\n";
      if (cmd.includes("revert")) return "0\n";
      if (cmd.includes("hotfix")) return "5\n";
      return "0\n";
    });
    mockExistsSync.mockReturnValue(false);

    const rules = generateDynamicRules("/project", "/shugo");
    const hotfixRule = rules.find((r) => r.id === "git-hotfixes");
    expect(hotfixRule).toBeDefined();
    expect(hotfixRule!.incidentCount).toBe(5);
  });

  it("sorts rules by severity (critical > high > medium > low)", () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes("force push") || cmd.includes("forced push") || cmd.includes("\\+\\+")) return "10\n";
      if (cmd.includes("revert")) return "5\n";
      if (cmd.includes("hotfix")) return "5\n";
      return "0\n";
    });
    mockExistsSync.mockReturnValue(false);

    const rules = generateDynamicRules("/project", "/shugo");
    const severities = rules.map((r) => r.severity);
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    for (let i = 1; i < severities.length; i++) {
      expect(order[severities[i]!]).toBeGreaterThanOrEqual(order[severities[i - 1]!]);
    }
  });

  it("deduplicates rules by id", () => {
    mockExecSync.mockImplementation(() => "5\n");
    mockExistsSync.mockReturnValue(false);

    const rules = generateDynamicRules("/project", "/shugo");
    const ids = rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("detects incidents from history files", () => {
    mockExecSync.mockImplementation(() => { throw new Error("no git"); });
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["session1.md", "session2.md"] as any);
    mockReadFileSync.mockReturnValue("src/auth.ts has erro and bug and falhou");

    const rules = generateDynamicRules("/project", "/shugo");
    expect(rules.some((r) => r.source === "history-analysis")).toBe(true);
  });

  it("returns empty when history dir has no incident keywords", () => {
    mockExecSync.mockImplementation(() => { throw new Error("no git"); });
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["session1.md"] as any);
    mockReadFileSync.mockReturnValue("everything is fine");

    const rules = generateDynamicRules("/project", "/shugo");
    expect(rules).toEqual([]);
  });
});
