/**
 * reactive-state.test.ts — Tests for reactive Engineering State initialization
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEventBus, resetEventBus } from "../infrastructure/event-bus.js";
import { initializeEngineeringState } from "../application/engineering-state.js";

describe("initializeEngineeringState", () => {
  beforeEach(() => {
    resetEventBus();
  });

  afterEach(() => {
    resetEventBus();
  });

  it("returns an unsubscribe function", () => {
    const unsubscribe = initializeEngineeringState("/tmp/project", "/tmp/project/shitenno");
    expect(typeof unsubscribe).toBe("function");
    unsubscribe();
  });

  it("subscribes to maturity.changed event", () => {
    const bus = getEventBus();
    const unsubscribe = initializeEngineeringState("/tmp/project", "/tmp/project/shitenno");

    expect(bus.listenerCount("maturity.changed")).toBeGreaterThanOrEqual(1);

    unsubscribe();
  });

  it("subscribes to debt.detected event", () => {
    const bus = getEventBus();
    const unsubscribe = initializeEngineeringState("/tmp/project", "/tmp/project/shitenno");

    expect(bus.listenerCount("debt.detected")).toBeGreaterThanOrEqual(1);

    unsubscribe();
  });

  it("subscribes to knowledge.analyzed event", () => {
    const bus = getEventBus();
    const unsubscribe = initializeEngineeringState("/tmp/project", "/tmp/project/shitenno");

    expect(bus.listenerCount("knowledge.analyzed")).toBeGreaterThanOrEqual(1);

    unsubscribe();
  });

  it("subscribes to lifecycle.state_changed event", () => {
    const bus = getEventBus();
    const unsubscribe = initializeEngineeringState("/tmp/project", "/tmp/project/shitenno");

    expect(bus.listenerCount("lifecycle.state_changed")).toBeGreaterThanOrEqual(1);

    unsubscribe();
  });

  it("subscribes to asset.created event", () => {
    const bus = getEventBus();
    const unsubscribe = initializeEngineeringState("/tmp/project", "/tmp/project/shitenno");

    expect(bus.listenerCount("asset.created")).toBeGreaterThanOrEqual(1);

    unsubscribe();
  });

  it("subscribes to asset.updated event", () => {
    const bus = getEventBus();
    const unsubscribe = initializeEngineeringState("/tmp/project", "/tmp/project/shitenno");

    expect(bus.listenerCount("asset.updated")).toBeGreaterThanOrEqual(1);

    unsubscribe();
  });

  it("subscribes to asset.archived event", () => {
    const bus = getEventBus();
    const unsubscribe = initializeEngineeringState("/tmp/project", "/tmp/project/shitenno");

    expect(bus.listenerCount("asset.archived")).toBeGreaterThanOrEqual(1);

    unsubscribe();
  });

  it("unsubscribe removes all subscriptions", () => {
    const bus = getEventBus();
    const unsubscribe = initializeEngineeringState("/tmp/project", "/tmp/project/shitenno");

    const beforeMaturity = bus.listenerCount("maturity.changed");
    const beforeDebt = bus.listenerCount("debt.detected");

    unsubscribe();

    expect(bus.listenerCount("maturity.changed")).toBeLessThan(beforeMaturity);
    expect(bus.listenerCount("debt.detected")).toBeLessThan(beforeDebt);
  });
});
