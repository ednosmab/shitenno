/**
 * event-topology.test.ts — Tests for event topology
 *
 * Verifies that critical events have functional subscribers.
 * This is a simplified version of Phase F.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetEventBus, getEventBus } from "../event-bus.js";

describe("event-topology", () => {
  let bus: ReturnType<typeof getEventBus>;

  beforeEach(() => {
    resetEventBus();
    bus = getEventBus();
  });

  afterEach(() => {
    resetEventBus();
  });

  describe("session.start", () => {
    it("can be published and received", () => {
      let received = false;
      let payload: any = null;

      bus.subscribe("session.start", (p: any) => {
        received = true;
        payload = p;
      });

      bus.publish("session.start", {
        sessionId: "test-session",
        timestamp: new Date().toISOString(),
      });

      expect(received).toBe(true);
      expect(payload.sessionId).toBe("test-session");
    });
  });

  describe("session.end", () => {
    it("can be published and received", () => {
      let received = false;
      let payload: any = null;

      bus.subscribe("session.end", (p: any) => {
        received = true;
        payload = p;
      });

      bus.publish("session.end", {
        sessionId: "test-session",
        duration: 12345,
        tasksCompleted: 3,
        timestamp: new Date().toISOString(),
      });

      expect(received).toBe(true);
      expect(payload.sessionId).toBe("test-session");
      expect(payload.duration).toBe(12345);
    });
  });

  describe("plan.archived", () => {
    it("can be published and received", () => {
      let received = false;
      let payload: any = null;

      bus.subscribe("plan.archived", (p: any) => {
        received = true;
        payload = p;
      });

      bus.publish("plan.archived", {
        planPath: "/tmp/plan.md",
        outcome: "success",
        tasksCompleted: 5,
        timestamp: new Date().toISOString(),
      });

      expect(received).toBe(true);
      expect(payload.planPath).toBe("/tmp/plan.md");
      expect(payload.outcome).toBe("success");
    });
  });

  describe("state.mutated", () => {
    it("can be published and received", () => {
      let received = false;
      let payload: any = null;

      bus.subscribe("state.mutated", (p: any) => {
        received = true;
        payload = p;
      });

      bus.publish("state.mutated", {
        source: "test",
        trigger: "manual",
        description: "Test mutation",
        timestamp: new Date().toISOString(),
      });

      expect(received).toBe(true);
      expect(payload.source).toBe("test");
    });
  });

  describe("challenge.generated", () => {
    it("can be published and received", () => {
      let received = false;
      let payload: any = null;

      bus.subscribe("challenge.generated", (p: any) => {
        received = true;
        payload = p;
      });

      bus.publish("challenge.generated", {
        type: "entropy_reduction",
        severity: "high",
        description: "Test challenge",
        timestamp: new Date().toISOString(),
      });

      expect(received).toBe(true);
      expect(payload.type).toBe("entropy_reduction");
    });
  });

  describe("pipeline.started removal", () => {
    it("is not in the event type union", () => {
      // If pipeline.started were re-added, this compile-time check would fail
      type EventType = ReturnType<typeof getEventBus>["publish"] extends (event: infer E, ...args: any[]) => any ? E : never;
      type IsPipelineStartedRemoved = "pipeline.started" extends EventType ? true : false;
      const check: IsPipelineStartedRemoved = false as false;
      expect(check).toBe(false);
    });
  });

  describe("action.pre_sensitive", () => {
    it("can be published and received", () => {
      let received = false;
      let payload: any = null;

      bus.subscribe("action.pre_sensitive", (p: any) => {
        received = true;
        payload = p;
      });

      bus.publish("action.pre_sensitive", {
        command: "commit",
        args: ["-m", "test"],
        reminder: "MANDATORY RULES",
      });

      expect(received).toBe(true);
      expect(payload.command).toBe("commit");
    });
  });

  describe("observability events", () => {
    const events: Array<{ name: string; payload: Record<string, unknown> }> = [
      { name: "watcher.error", payload: { error: "fs timeout", timestamp: new Date().toISOString() } },
      { name: "daemon.ready", payload: { pid: 1234, uptimeMs: 500 } },
      { name: "pipeline.stage.start", payload: { stage: "detect", description: "Running detectors" } },
      { name: "pipeline.stage.complete", payload: { stage: "detect", duration: 1200, success: true } },
      { name: "semantic.pattern_detected", payload: { patternType: "repeated_import", domain: "code", confidence: 0.8 } },
      { name: "semantic.insight_detected", payload: { insightType: "arch_smell", priority: "medium", confidence: 0.7 } },
      { name: "proactive.digest_ready", payload: { challengeCount: 3, healthScore: 72 } },
    ];

    for (const { name, payload } of events) {
      it(`${name} can be published and received`, () => {
        let received = false;
        let receivedPayload: any = null;

        bus.subscribe(name as any, (p: any) => {
          received = true;
          receivedPayload = p;
        });

        bus.publish(name as any, payload);

        expect(received).toBe(true);
        expect(receivedPayload).toEqual(payload);
      });
    }
  });
});
