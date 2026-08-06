import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scheduledCheck } from "../commands/scheduled-check.js";
import { getEventBus } from "../infrastructure/event-bus.js";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("../infrastructure/event-bus.js", () => ({
  getEventBus: vi.fn(),
}));

vi.mock("../shared/logger.js", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe("scheduledCheck", () => {
  let bus: ReturnType<typeof getEventBus>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    bus = { publish: vi.fn(), subscribe: vi.fn(), removeAllListeners: vi.fn(), listenerCount: vi.fn(), subscribeOnce: vi.fn(), getHistory: vi.fn().mockReturnValue([]), enablePersistence: vi.fn(), enableDeadLetterQueue: vi.fn() };
    vi.mocked(getEventBus).mockReturnValue(bus as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("publishes drift event when many files are changed (>20)", async () => {
    const { execSync } = await import("node:child_process");
    const bigDiff = Array.from({ length: 26 }, (_, i) => ` file${i}.ts | 10 +++`).join("\n");
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (cmd.includes("git diff --stat")) return bigDiff;
      if (cmd.includes("git log -1")) return "1720000000";
      return "";
    });

    scheduledCheck("/tmp/project", "");

    expect(bus.publish).toHaveBeenCalledWith(
      "workdir.large_uncommitted_drift",
      expect.objectContaining({ filesChanged: 25 })
    );
  });

  it("publishes drift event when last commit is old (>120 min)", async () => {
    const { execSync } = await import("node:child_process");
    const oldCommitEpoch = String(Math.floor(Date.now() / 1000) - 200 * 60);
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (cmd.includes("git diff --stat")) return "";
      if (cmd.includes("git log -1")) return oldCommitEpoch;
      return "";
    });

    scheduledCheck("/tmp/project", "");

    expect(bus.publish).toHaveBeenCalledWith(
      "workdir.large_uncommitted_drift",
      expect.objectContaining({ minutesSinceLastCommit: expect.any(Number) })
    );
  });

  it("does NOT publish when drift is small (few files, recent commit)", async () => {
    const { execSync } = await import("node:child_process");
    const recentEpoch = String(Math.floor(Date.now() / 1000) - 10 * 60);
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (cmd.includes("git diff --stat")) return " file1.ts | 5 +++";
      if (cmd.includes("git log -1")) return recentEpoch;
      return "";
    });

    scheduledCheck("/tmp/project", "");

    expect(bus.publish).not.toHaveBeenCalled();
  });

  it("does NOT publish when there are no changes at all", async () => {
    const { execSync } = await import("node:child_process");
    const recentEpoch = String(Math.floor(Date.now() / 1000) - 5 * 60);
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (cmd.includes("git diff --stat")) return "";
      if (cmd.includes("git log -1")) return recentEpoch;
      return "";
    });

    scheduledCheck("/tmp/project", "");

    expect(bus.publish).not.toHaveBeenCalled();
  });
});
