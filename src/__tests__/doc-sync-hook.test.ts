import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("../infrastructure/event-bus.js", () => ({
  getEventBus: vi.fn().mockReturnValue({
    subscribe: vi.fn().mockReturnValue(vi.fn()),
    publish: vi.fn(),
  }),
}));

vi.mock("../shared/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

// ── runDocSync ─────────────────────────────────────────────────────────────

describe("runDocSync", () => {
  it("returns failure when sync script not found", async () => {
    const { runDocSync } = await import("../infrastructure/doc-sync-hook.js");
    const { existsSync } = await import("node:fs");

    vi.mocked(existsSync).mockReturnValue(false);
    const result = runDocSync("/project");

    expect(result.success).toBe(false);
    expect(result.output).toContain("not found");
    expect(result.exitCode).toBe(1);
    expect(result.duration).toBe(0);
  });

  it("executes sync command and returns success", async () => {
    const { runDocSync } = await import("../infrastructure/doc-sync-hook.js");
    const { existsSync } = await import("node:fs");
    const { execSync } = await import("node:child_process");

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(execSync).mockReturnValue("synced");

    const result = runDocSync("/project");

    expect(result.success).toBe(true);
    expect(result.output).toBe("synced");
    expect(result.exitCode).toBe(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it("appends --quiet flag for silent mode", async () => {
    const { runDocSync } = await import("../infrastructure/doc-sync-hook.js");
    const { existsSync } = await import("node:fs");
    const { execSync } = await import("node:child_process");

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(execSync).mockReturnValue("");

    runDocSync("/project", "pnpm run sync:docs", "silent");

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining("--quiet"),
      expect.anything()
    );
  });

  it("appends --quiet flag for minimal mode", async () => {
    const { runDocSync } = await import("../infrastructure/doc-sync-hook.js");
    const { existsSync } = await import("node:fs");
    const { execSync } = await import("node:child_process");

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(execSync).mockReturnValue("");

    runDocSync("/project", "pnpm run sync:docs", "minimal");

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining("--quiet"),
      expect.anything()
    );
  });

  it("does not append flags for verbose mode", async () => {
    const { runDocSync } = await import("../infrastructure/doc-sync-hook.js");
    const { existsSync } = await import("node:fs");
    const { execSync } = await import("node:child_process");

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(execSync).mockReturnValue("");

    runDocSync("/project", "pnpm run sync:docs", "verbose");

    expect(execSync).toHaveBeenCalledWith(
      "pnpm run sync:docs",
      expect.anything()
    );
  });

  it("handles execSync failure", async () => {
    const { runDocSync } = await import("../infrastructure/doc-sync-hook.js");
    const { existsSync } = await import("node:fs");
    const { execSync } = await import("node:child_process");

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("command failed");
    });

    const result = runDocSync("/project");

    expect(result.success).toBe(false);
    expect(result.output).toContain("command failed");
  });
});

// ── registerDocSyncHook ────────────────────────────────────────────────────

describe("registerDocSyncHook", () => {
  it("returns unsubscribe function when auto-sync disabled", async () => {
    const { registerDocSyncHook } = await import("../infrastructure/doc-sync-hook.js");
    const { logger } = await import("../shared/logger.js");

    const unsub = registerDocSyncHook({ projectRoot: "/project", enableAutoSync: false });
    expect(typeof unsub).toBe("function");
    expect(vi.mocked(logger.info)).toHaveBeenCalled();
  });

  it("subscribes to docs.sync.triggered when enabled", async () => {
    const { registerDocSyncHook } = await import("../infrastructure/doc-sync-hook.js");
    const { getEventBus } = await import("../infrastructure/event-bus.js");

    const unsub = registerDocSyncHook({ projectRoot: "/project", enableAutoSync: true });
    expect(typeof unsub).toBe("function");
    expect(vi.mocked(getEventBus).mock.results[0]?.value.subscribe).toHaveBeenCalledWith(
      "docs.sync.triggered",
      expect.any(Function)
    );
  });

  it("uses custom sync command", async () => {
    const { registerDocSyncHook } = await import("../infrastructure/doc-sync-hook.js");
    const { getEventBus } = await import("../infrastructure/event-bus.js");

    registerDocSyncHook({
      projectRoot: "/project",
      enableAutoSync: true,
      syncCommand: "custom-cmd",
    });

    const bus = vi.mocked(getEventBus).mock.results[0]?.value;
    expect(bus?.subscribe).toHaveBeenCalled();
  });
});
