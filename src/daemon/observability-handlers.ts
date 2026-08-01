/**
 * daemon/observability-handlers.ts — Dedicated subscribers for observability events
 *
 * Handles: action.pre_sensitive, watcher.error, daemon.ready,
 * pipeline.stage.start/complete, semantic.pattern/insight_detected,
 * proactive.digest_ready.
 */

import { getEventBus } from "../event-bus.js";
import { recordEvent } from "./state.js";
import { daemonLog } from "./log-rotation.js";
import type { DaemonContext } from "./pid-manager.js";

export function subscribeObservabilityEvents(ctx: DaemonContext): void {
  const bus = getEventBus();

  bus.subscribe("action.pre_sensitive", (payload) => {
    recordEvent(ctx.state, "action.pre_sensitive");
    const p = payload as { command?: string; reminder?: string } | undefined;
    daemonLog(ctx.logPath, "WARN", `Sensitive action: ${p?.command ?? "unknown"} — ${p?.reminder ?? ""}`);
  });

  bus.subscribe("watcher.error", (payload) => {
    recordEvent(ctx.state, "watcher.error");
    const p = payload as { error?: string } | undefined;
    daemonLog(ctx.logPath, "ERROR", `Watcher error: ${p?.error ?? "unknown"}`);
  });

  bus.subscribe("pipeline.stage.start", (payload) => {
    recordEvent(ctx.state, "pipeline.stage.start");
    const p = payload as { stage?: string; description?: string } | undefined;
    daemonLog(ctx.logPath, "INFO", `Pipeline stage starting: ${p?.stage ?? "unknown"}`);
  });

  bus.subscribe("pipeline.stage.complete", (payload) => {
    recordEvent(ctx.state, "pipeline.stage.complete");
    const p = payload as { stage?: string; duration?: number; success?: boolean; error?: string } | undefined;
    daemonLog(ctx.logPath, p?.success === false ? "WARN" : "INFO",
      `Pipeline stage ${p?.stage ?? "unknown"}: ${p?.success === false ? "FAILED" : "done"} (${p?.duration ?? 0}ms)`);
  });

  bus.subscribe("semantic.pattern_detected", (payload) => {
    recordEvent(ctx.state, "semantic.pattern_detected");
    const p = payload as { patternType?: string; domain?: string; confidence?: number } | undefined;
    daemonLog(ctx.logPath, "INFO", `Semantic pattern: ${p?.patternType ?? "unknown"} in ${p?.domain ?? "?"} (confidence: ${p?.confidence ?? "?"})`);
  });

  bus.subscribe("semantic.insight_detected", (payload) => {
    recordEvent(ctx.state, "semantic.insight_detected");
    const p = payload as { insightType?: string; priority?: string; confidence?: number } | undefined;
    daemonLog(ctx.logPath, "INFO", `Semantic insight: ${p?.insightType ?? "unknown"} (priority: ${p?.priority ?? "?"}, confidence: ${p?.confidence ?? "?"})`);
  });

  bus.subscribe("proactive.digest_ready", (payload) => {
    recordEvent(ctx.state, "proactive.digest_ready");
    const p = payload as { challengeCount?: number; healthScore?: number | null } | undefined;
    daemonLog(ctx.logPath, "INFO", `Digest ready — challenges: ${p?.challengeCount ?? 0}, health: ${p?.healthScore ?? "N/A"}`);
  });

  bus.subscribe("daemon.ready", (payload) => {
    recordEvent(ctx.state, "daemon.ready");
    const p = payload as { pid?: number; uptimeMs?: number } | undefined;
    daemonLog(ctx.logPath, "INFO", `Daemon ready — PID: ${p?.pid ?? "?"}, startup: ${p?.uptimeMs ?? 0}ms`);
  });
}
