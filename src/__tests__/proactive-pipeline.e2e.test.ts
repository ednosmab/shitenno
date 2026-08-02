/**
 * proactive-pipeline.e2e.test.ts — E2E Test for Proactive Pipeline
 *
 * Tests the full pipeline: Event → Triggers → Challenge → Rate Limiting
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEventBus, resetEventBus } from "../event-bus.js";
import { initializeProactiveEngine, resetChallengeCooldowns } from "../prioritization/triggers.js";

describe("Proactive Pipeline E2E", () => {
  beforeEach(() => {
    resetEventBus();
    resetChallengeCooldowns();
  });

  afterEach(() => {
    resetEventBus();
    resetChallengeCooldowns();
  });

  it("full pipeline: health checked → challenge generated", () => {
    const bus = getEventBus();
    const challenges: Array<{ type: string; severity: string; description: string }> = [];

    // Subscribe to challenge events
    bus.subscribe("challenge.generated", (payload) => {
      challenges.push(payload as { type: string; severity: string; description: string });
    });

    // Initialize proactive engine
    const unsubscribe = initializeProactiveEngine("/tmp/project", "/tmp/project/shitenno");

    // Simulate health check with low score
    bus.publish("health.checked", { score: 35 });

    // Verify challenge was generated
    expect(challenges.length).toBe(1);
    expect(challenges[0]?.type).toBe("health_critical");
    expect(challenges[0]?.severity).toBe("high");
    expect(challenges[0]?.description).toContain("35");

    unsubscribe();
  });

  it("rate limiting prevents duplicate challenges", () => {
    const bus = getEventBus();
    const challenges: Array<{ type: string }> = [];

    bus.subscribe("challenge.generated", (payload) => {
      challenges.push(payload as { type: string });
    });

    const unsubscribe = initializeProactiveEngine("/tmp/project", "/tmp/project/shitenno");

    // Generate same challenge multiple times
    bus.publish("health.checked", { score: 30 });
    bus.publish("health.checked", { score: 25 });
    bus.publish("health.checked", { score: 20 });

    // Rate limiting should prevent all but the first
    expect(challenges.length).toBe(1);
    expect(challenges[0]?.type).toBe("health_critical");

    unsubscribe();
  });

  it("different challenge types are not rate-limited together", () => {
    const bus = getEventBus();
    const challenges: Array<{ type: string }> = [];

    bus.subscribe("challenge.generated", (payload) => {
      challenges.push(payload as { type: string });
    });

    const unsubscribe = initializeProactiveEngine("/tmp/project", "/tmp/project/shitenno");

    // Generate different challenge types
    bus.publish("health.checked", { score: 30 }); // health_critical
    bus.publish("knowledge_debt.detected", { gapCount: 20 }); // knowledge_gap

    // Both should be generated (different types)
    expect(challenges.length).toBe(2);
    expect(challenges.map(c => c?.type)).toContain("health_critical");
    expect(challenges.map(c => c?.type)).toContain("knowledge_gap");

    unsubscribe();
  });

  it("plan completion generates next_step challenge", () => {
    const bus = getEventBus();
    const challenges: Array<{ type: string; description: string }> = [];

    bus.subscribe("challenge.generated", (payload) => {
      challenges.push(payload as { type: string; description: string });
    });

    const unsubscribe = initializeProactiveEngine("/tmp/project", "/tmp/project/shitenno");

    // Simulate plan completion
    bus.publish("plan.status_changed", {
      planId: "my-feature",
      oldStatus: "in_progress",
      newStatus: "done",
    });

    expect(challenges.length).toBe(1);
    expect(challenges[0]?.type).toBe("next_step");
    expect(challenges[0]?.description).toContain("my-feature");

    unsubscribe();
  });

  it("maturity regression generates high severity challenge", () => {
    const bus = getEventBus();
    const challenges: Array<{ type: string; severity: string }> = [];

    bus.subscribe("challenge.generated", (payload) => {
      challenges.push(payload as { type: string; severity: string });
    });

    const unsubscribe = initializeProactiveEngine("/tmp/project", "/tmp/project/shitenno");

    // Simulate maturity regression
    bus.publish("maturity.changed", {
      previousLevel: "active",
      newLevel: "configured",
    });

    expect(challenges.length).toBe(1);
    expect(challenges[0]?.type).toBe("maturity_regression");
    expect(challenges[0]?.severity).toBe("high"); // Regression = high

    unsubscribe();
  });

  it("maturity progression generates low severity challenge", () => {
    const bus = getEventBus();
    const challenges: Array<{ type: string; severity: string }> = [];

    bus.subscribe("challenge.generated", (payload) => {
      challenges.push(payload as { type: string; severity: string });
    });

    const unsubscribe = initializeProactiveEngine("/tmp/project", "/tmp/project/shitenno");

    // Simulate maturity progression
    bus.publish("maturity.changed", {
      previousLevel: "installed",
      newLevel: "active",
    });

    expect(challenges.length).toBe(1);
    expect(challenges[0]?.type).toBe("maturity_regression");
    expect(challenges[0]?.severity).toBe("low"); // Progression = low

    unsubscribe();
  });

  it("unsubscribe prevents further challenges", () => {
    const bus = getEventBus();
    const challenges: Array<{ type: string }> = [];

    bus.subscribe("challenge.generated", (payload) => {
      challenges.push(payload as { type: string });
    });

    const unsubscribe = initializeProactiveEngine("/tmp/project", "/tmp/project/shitenno");

    // Generate a challenge
    bus.publish("health.checked", { score: 30 });
    expect(challenges.length).toBe(1);

    // Unsubscribe
    unsubscribe();

    // Try to generate another challenge
    bus.publish("health.checked", { score: 25 });

    // Should not generate because engine is unsubscribed
    expect(challenges.length).toBe(1);
  });
});
