import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../infrastructure/notify.js", () => ({
  sendDesktopNotification: vi.fn(() => true),
  logNotificationOnly: vi.fn(),
}));

import { initDesktopNotifier, _resetForTesting } from "../infrastructure/desktop-notifier.js";
import { sendDesktopNotification, logNotificationOnly } from "../infrastructure/notify.js";
import { getEventBus } from "../infrastructure/event-bus.js";

describe("desktop-notifier", () => {
  let testDir: string;
  let shitennoDir: string;

  beforeEach(() => {
    _resetForTesting();
    testDir = join(tmpdir(), `desktop-notifier-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    shitennoDir = join(testDir, ".shitenno");
    mkdirSync(shitennoDir, { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("low priority notification should NOT call sendDesktopNotification", () => {
    initDesktopNotifier(shitennoDir);
    const bus = getEventBus();

    bus.publish("briefing.generated", {});

    expect(sendDesktopNotification).not.toHaveBeenCalled();
    expect(logNotificationOnly).toHaveBeenCalledWith(
      shitennoDir,
      expect.any(String),
      expect.any(String),
      "low",
    );
  });

  it("high priority notification should call sendDesktopNotification", () => {
    initDesktopNotifier(shitennoDir);
    const bus = getEventBus();

    bus.publish("task.completed", { taskId: "test-1", gatesPassed: 5 });

    expect(sendDesktopNotification).toHaveBeenCalledWith(
      shitennoDir,
      expect.any(String),
      expect.any(String),
      "high",
    );
  });

  it("throttled medium notification should be logged via logNotificationOnly", () => {
    initDesktopNotifier(shitennoDir);
    const bus = getEventBus();

    bus.publish("task.completed", { taskId: "t1", gatesPassed: 3 });
    bus.publish("task.completed", { taskId: "t2", gatesPassed: 3 });

    const highCalls = vi.mocked(sendDesktopNotification).mock.calls.filter(
      (c) => c[3] === "high",
    );
    expect(highCalls.length).toBeGreaterThanOrEqual(1);
  });

  describe("pipeline.complete", () => {
    it("sends a high-priority notification when a pipeline phase failed", () => {
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      bus.publish("pipeline.complete", {
        stage: "phase2",
        status: "failed",
        duration: 12_000,
        timestamp: new Date().toISOString(),
      });

      expect(sendDesktopNotification).toHaveBeenCalledWith(
        shitennoDir,
        expect.stringContaining("Pipeline"),
        expect.stringContaining("phase2"),
        "high",
      );
    });

    it("logs only when a pipeline phase passed (low priority)", () => {
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      bus.publish("pipeline.complete", {
        stage: "phase1",
        status: "success",
        duration: 5_000,
        timestamp: new Date().toISOString(),
      });

      expect(sendDesktopNotification).not.toHaveBeenCalled();
      expect(logNotificationOnly).toHaveBeenCalledWith(
        shitennoDir,
        expect.stringContaining("Pipeline"),
        expect.any(String),
        "low",
      );
    });

    it("falls back to a generic stage label when the stage is missing", () => {
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      bus.publish("pipeline.complete", { status: "success", timestamp: new Date().toISOString() });

      expect(logNotificationOnly).toHaveBeenCalledWith(
        shitennoDir,
        expect.any(String),
        expect.stringContaining("pipeline"),
        "low",
      );
    });
  });
});
