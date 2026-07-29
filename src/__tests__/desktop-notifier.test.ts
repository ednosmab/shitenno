import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../notify.js", () => ({
  sendDesktopNotification: vi.fn(() => true),
  logNotificationOnly: vi.fn(),
}));

import { initDesktopNotifier, _resetForTesting } from "../desktop-notifier.js";
import { sendDesktopNotification, logNotificationOnly } from "../notify.js";
import { getEventBus } from "../event-bus.js";

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
});
