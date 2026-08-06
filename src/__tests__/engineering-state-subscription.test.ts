/**
 * engineering-state-subscription.test.ts — Tests for reactive Engineering State subscription
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEventBus, resetEventBus } from "../infrastructure/event-bus.js";
import { subscribeToEngineeringState } from "../engineering-state/index.js";

describe("subscribeToEngineeringState", () => {
  beforeEach(() => {
    resetEventBus();
  });

  afterEach(() => {
    resetEventBus();
  });

  it("returns getState and unsubscribe functions", () => {
    const { getState, unsubscribe } = subscribeToEngineeringState(
      "/tmp/project",
      "/tmp/project/shitenno"
    );

    expect(typeof getState).toBe("function");
    expect(typeof unsubscribe).toBe("function");

    unsubscribe();
  });

  it("getState returns initial state", () => {
    const { getState, unsubscribe } = subscribeToEngineeringState(
      "/tmp/project",
      "/tmp/project/shitenno"
    );

    const state = getState();
    expect(state).toBeDefined();
    expect(state.consolidatedAt).toBeDefined();

    unsubscribe();
  });

  it("subscribes to engineering_state.consolidated event", () => {
    const bus = getEventBus();
    const { unsubscribe } = subscribeToEngineeringState(
      "/tmp/project",
      "/tmp/project/shitenno"
    );

    expect(bus.listenerCount("engineering_state.consolidated")).toBeGreaterThanOrEqual(1);

    unsubscribe();
  });

  it("unsubscribe removes subscription", () => {
    const bus = getEventBus();
    const { unsubscribe } = subscribeToEngineeringState(
      "/tmp/project",
      "/tmp/project/shitenno"
    );

    const before = bus.listenerCount("engineering_state.consolidated");
    unsubscribe();
    const after = bus.listenerCount("engineering_state.consolidated");

    expect(after).toBeLessThan(before);
  });
});
