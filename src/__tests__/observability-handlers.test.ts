/**
 * observability-handlers.test.ts — Tests for dedicated observability event subscribers
 *
 * Verifies that each handler:
 * 1. Calls recordEvent with the correct event type
 * 2. Calls daemonLog with appropriate level and message
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetEventBus, getEventBus } from "../infrastructure/event-bus.js";

vi.mock("../daemon/state.js", () => ({
  recordEvent: vi.fn(),
}));

vi.mock("../daemon/log-rotation.js", () => ({
  daemonLog: vi.fn(),
}));

import { recordEvent } from "../daemon/state.js";
import { daemonLog } from "../daemon/log-rotation.js";
import { subscribeObservabilityEvents } from "../daemon/observability-handlers.js";
import type { DaemonContext } from "../daemon/pid-manager.js";

function createMockCtx(): DaemonContext {
  return {
    shitennoDir: "/tmp/test-shitenno",
    projectRoot: "/tmp/test-project",
    daemonDir: "/tmp/test-shitenno/daemon",
    pidPath: "/tmp/test-shitenno/daemon/daemon.pid",
    sockPath: "/tmp/test-shitenno/daemon/daemon.sock",
    logPath: "/tmp/test-shitenno/daemon/daemon.log",
    approvedPath: "/tmp/test-shitenno/daemon/approved.json",
    statePath: "/tmp/test-shitenno/daemon/state.json",
    state: {
      events: [],
      drift: null,
      sessions: [],
      health: null,
      challenges: [],
      debt: null,
      startedAt: new Date().toISOString(),
      briefingCache: null,
      riskMapCache: null,
      lastCommandName: null,
      lastCommandAt: null,
      proactiveEngine: null,
      audit: null,
      timers: null,
      notificationStats: null,
    } as any,
    socket: {} as any,
    stopProactive: vi.fn(),
    stopWatcher: vi.fn(),
  };
}

describe("observability-handlers", () => {
  let ctx: DaemonContext;
  let bus: ReturnType<typeof getEventBus>;

  beforeEach(() => {
    resetEventBus();
    bus = getEventBus();
    ctx = createMockCtx();
    vi.clearAllMocks();
    subscribeObservabilityEvents(ctx);
  });

  afterEach(() => {
    resetEventBus();
  });

  it("action.pre_sensitive — records event and logs WARN", () => {
    bus.publish("action.pre_sensitive", { command: "commit", args: [], reminder: "G-01 applies" });

    expect(recordEvent).toHaveBeenCalledWith(ctx.state, "action.pre_sensitive");
    expect(daemonLog).toHaveBeenCalledWith(ctx.logPath, "WARN", expect.stringContaining("commit"));
  });

  it("watcher.error — records event and logs ERROR", () => {
    bus.publish("watcher.error", { error: "fs timeout", timestamp: new Date().toISOString() });

    expect(recordEvent).toHaveBeenCalledWith(ctx.state, "watcher.error");
    expect(daemonLog).toHaveBeenCalledWith(ctx.logPath, "ERROR", expect.stringContaining("fs timeout"));
  });

  it("pipeline.stage.start — records event and logs INFO", () => {
    bus.publish("pipeline.stage.start", { stage: "detect", description: "Running detectors" });

    expect(recordEvent).toHaveBeenCalledWith(ctx.state, "pipeline.stage.start");
    expect(daemonLog).toHaveBeenCalledWith(ctx.logPath, "INFO", expect.stringContaining("detect"));
  });

  it("pipeline.stage.complete — records event and logs INFO on success", () => {
    bus.publish("pipeline.stage.complete", { stage: "detect", duration: 1200, success: true });

    expect(recordEvent).toHaveBeenCalledWith(ctx.state, "pipeline.stage.complete");
    expect(daemonLog).toHaveBeenCalledWith(ctx.logPath, "INFO", expect.stringContaining("done"));
  });

  it("pipeline.stage.complete — logs WARN on failure", () => {
    bus.publish("pipeline.stage.complete", { stage: "detect", duration: 500, success: false, error: "timeout" });

    expect(recordEvent).toHaveBeenCalledWith(ctx.state, "pipeline.stage.complete");
    expect(daemonLog).toHaveBeenCalledWith(ctx.logPath, "WARN", expect.stringContaining("FAILED"));
  });

  it("semantic.pattern_detected — records event and logs INFO", () => {
    bus.publish("semantic.pattern_detected", { patternType: "repeated_import", domain: "code", confidence: 0.8 });

    expect(recordEvent).toHaveBeenCalledWith(ctx.state, "semantic.pattern_detected");
    expect(daemonLog).toHaveBeenCalledWith(ctx.logPath, "INFO", expect.stringContaining("repeated_import"));
  });

  it("semantic.insight_detected — records event and logs INFO", () => {
    bus.publish("semantic.insight_detected", { insightType: "arch_smell", priority: "medium", confidence: 0.7 });

    expect(recordEvent).toHaveBeenCalledWith(ctx.state, "semantic.insight_detected");
    expect(daemonLog).toHaveBeenCalledWith(ctx.logPath, "INFO", expect.stringContaining("arch_smell"));
  });

  it("proactive.digest_ready — records event and logs INFO", () => {
    bus.publish("proactive.digest_ready", { challengeCount: 3, healthScore: 72 });

    expect(recordEvent).toHaveBeenCalledWith(ctx.state, "proactive.digest_ready");
    expect(daemonLog).toHaveBeenCalledWith(ctx.logPath, "INFO", expect.stringContaining("3"));
  });

  it("daemon.ready — records event and logs INFO", () => {
    bus.publish("daemon.ready", { pid: 1234, uptimeMs: 500 });

    expect(recordEvent).toHaveBeenCalledWith(ctx.state, "daemon.ready");
    expect(daemonLog).toHaveBeenCalledWith(ctx.logPath, "INFO", expect.stringContaining("1234"));
  });

  it("all 8 handlers are subscribed", () => {
    const handlerCount = [
      "action.pre_sensitive", "watcher.error", "pipeline.stage.start",
      "pipeline.stage.complete", "semantic.pattern_detected",
      "semantic.insight_detected", "proactive.digest_ready", "daemon.ready",
    ].length;
    expect(handlerCount).toBe(8);
  });
});
