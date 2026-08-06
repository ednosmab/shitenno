/**
 * mcp-consolidation.test.ts — Tests for background engineering-state
 * consolidation scheduled by the MCP server.
 *
 * Ensures the heavy consolidation is scheduled off the critical path
 * (child process) so the MCP stdio handshake is never blocked by it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockSpawn = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

vi.mock("../shared/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { scheduleConsolidation } from "../interface/mcp/mcp-consolidation.js";

// ── Tests ───────────────────────────────────────────────────────────────────

describe("scheduleConsolidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("spawns a detached background process with project and shitenno dir", () => {
    const unref = vi.fn();
    const once = vi.fn();
    mockSpawn.mockReturnValue({ unref, once });

    scheduleConsolidation("/proj", "/proj/.shitenno");

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = mockSpawn.mock.calls[0] as [
      string,
      string[],
      { detached: boolean; stdio: string[]; env: Record<string, string> },
    ];
    expect(cmd).toBe(process.execPath);
    expect(args[args.length - 2]).toBe("/proj");
    expect(args[args.length - 1]).toBe("/proj/.shitenno");
    expect(opts.detached).toBe(true);
    expect(opts.stdio).toContain("ignore");
    expect(unref).toHaveBeenCalled();
  });

  it("does not throw when spawn fails", () => {
    mockSpawn.mockImplementation(() => {
      throw new Error("spawn ENOENT");
    });

    expect(() => scheduleConsolidation("/proj", "/proj/.shitenno")).not.toThrow();
  });

  it("does not spawn when project dir is missing", () => {
    scheduleConsolidation("", "");

    expect(mockSpawn).not.toHaveBeenCalled();
  });
});
