/**
 * engineering-state-evolved.test.ts — Tests for Evolved Engineering State
 *
 * Validates incremental updates, capability lifecycle, and event sourcing.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  CapabilityLifecycleTracker,
  EventSourcedState,
  IncrementalConsolidator,
  type StateDelta,
} from "../engineering-state/index.js";
import type { EngineeringState, EngineeringAsset, AssetType } from "../application/engineering-state.js";
import type { ShitennoLifecycleState } from "../infrastructure/shitenno-state-machine.js";
import { resetEventBus } from "../infrastructure/event-bus.js";

// ── CapabilityLifecycleTracker Tests ───────────────────────────────────────

describe("CapabilityLifecycleTracker", () => {
  let tracker: CapabilityLifecycleTracker;

  beforeEach(() => {
    resetEventBus();
    tracker = new CapabilityLifecycleTracker();
  });

  it("starts with detected state", () => {
    expect(tracker.getState("quality")).toBe("detected");
  });

  it("transitions between valid states", () => {
    const result = tracker.transition("quality", "installed", "shugo upgrade");
    expect(result).toBeDefined();
    expect(result?.previous).toBe("detected");
    expect(result?.current).toBe("installed");
    expect(tracker.getState("quality")).toBe("installed");
  });

  it("records transition history", () => {
    tracker.transition("quality", "installed", "shugo upgrade");
    tracker.transition("quality", "configured", "shugo configure");
    tracker.transition("quality", "validated", "shugo validate");

    const history = tracker.getHistory("quality");
    expect(history).toHaveLength(3);
    expect(history[0]?.state).toBe("installed");
    expect(history[1]?.state).toBe("configured");
    expect(history[2]?.state).toBe("validated");
  });

  it("returns undefined for same-state transition", () => {
    const result = tracker.transition("quality", "detected", "shugo audit");
    expect(result).toBeUndefined();
  });

  it("validates transitions", () => {
    expect(tracker.canTransition("quality", "installed")).toBe(true);
    expect(tracker.canTransition("quality", "healthy")).toBe(false); // Skip installed
    expect(tracker.canTransition("quality", "removed")).toBe(true);
  });

  it("blocks invalid transitions", () => {
    tracker.transition("quality", "installed", "test");
    tracker.transition("quality", "configured", "test");
    tracker.transition("quality", "validated", "test");
    tracker.transition("quality", "healthy", "test");

    // Cannot go from healthy back to installed
    expect(tracker.canTransition("quality", "installed")).toBe(false);
    // Can deprecate from healthy
    expect(tracker.canTransition("quality", "deprecated")).toBe(true);
  });

  it("tracks multiple capabilities", () => {
    tracker.transition("quality", "installed", "test");
    tracker.transition("security", "configured", "test");

    expect(tracker.getState("quality")).toBe("installed");
    expect(tracker.getState("security")).toBe("configured");
  });

  it("getAll returns all states", () => {
    tracker.transition("quality", "installed", "test");
    tracker.transition("security", "healthy", "test");

    const all = tracker.getAll();
    expect(all.get("quality")).toBe("installed");
    expect(all.get("security")).toBe("healthy");
  });
});

// ── EventSourcedState Tests ────────────────────────────────────────────────

describe("EventSourcedState", () => {
  let tmpDir: string;
  let state: EventSourcedState;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `shitenno-state-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    state = new EventSourcedState(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("records events", () => {
    const event = state.record({
      type: "state_changed",
      entityPath: "capability/quality",
      previousState: "detected",
      newState: "installed",
      source: "shugo upgrade",
    });

    expect(event.id).toMatch(/^EVT-[A-Z0-9]+$/);
    expect(event.timestamp).toBeDefined();
    expect(state.getEvents()).toHaveLength(1);
  });

  it("gets events for specific entity", () => {
    state.record({
      type: "state_changed",
      entityPath: "capability/quality",
      previousState: "detected",
      newState: "installed",
      source: "test",
    });

    state.record({
      type: "state_changed",
      entityPath: "capability/security",
      previousState: "detected",
      newState: "installed",
      source: "test",
    });

    const qualityEvents = state.getEventsForEntity("capability/quality");
    expect(qualityEvents).toHaveLength(1);
  });

  it("gets events since timestamp", () => {
    const past = new Date(Date.now() - 60000).toISOString();
    state.record({
      type: "state_changed",
      entityPath: "test",
      newState: "installed",
      source: "test",
    });

    const recent = state.getEventsSince(past);
    expect(recent).toHaveLength(1);
  });

  it("replays events to rebuild state", () => {
    state.record({
      type: "state_changed",
      entityPath: "capability/quality",
      previousState: "detected",
      newState: "installed",
      source: "test",
    });

    state.record({
      type: "state_changed",
      entityPath: "capability/quality",
      previousState: "installed",
      newState: "healthy",
      source: "test",
    });

    const replayed = state.replay();
    expect(replayed.get("capability/quality")).toBe("healthy");
  });

  it("persists events to disk", () => {
    state.record({
      type: "state_changed",
      entityPath: "test",
      newState: "installed",
      source: "test",
    });

    // Create new instance to test loading
    const state2 = new EventSourcedState(tmpDir);
    expect(state2.getEvents()).toHaveLength(1);
  });
});

// ── IncrementalConsolidator Tests ──────────────────────────────────────────

describe("IncrementalConsolidator", () => {
  let consolidator: IncrementalConsolidator;

  beforeEach(() => {
    consolidator = new IncrementalConsolidator();
  });

  const makeState = (assets: EngineeringAsset[] = [], health = 75): EngineeringState => ({
    consolidatedAt: new Date().toISOString(),
    lifecycle: "governed" as ShitennoLifecycleState,
    project: {
      name: "test", root: "/tmp", stack: [], hasGit: true,
      hasCI: false, hasTests: true, hasTypeScript: true,
      packageCount: 0, sourceFileCount: 0, monorepo: false,
    },
    maturity: null,
    capabilities: [],
    capabilityDrift: { detectedNotRegistered: [], registeredNotDetected: [] },
    knowledgeDebt: null,
    knowledgeGraph: null,
    assets,
    assetsByType: {} as Record<AssetType, number>,
    activeRules: 0,
    activePolicies: 0,
    healthScores: { knowledgeDebt: 0, knowledgeGraph: 0, overall: health },
    entropy: { orphanedAssets: 0, staleAssets: 0, missingDependencies: 0, score: 0 },
    summary: "Test state",
  });

  it("computes delta with added assets", () => {
    const prev = makeState([]);
    const curr = makeState([
      { id: "a1", type: "adr", name: "A1", path: "a1.md", description: "", tags: [], status: "active", createdAt: "", updatedAt: "", contributesTo: [], dependencies: [] },
    ]);

    const delta = consolidator.computeDelta(prev, curr);
    expect(delta.assetsAdded).toHaveLength(1);
    expect(delta.assetsRemoved).toHaveLength(0);
  });

  it("computes delta with removed assets", () => {
    const asset: EngineeringAsset = {
      id: "a1", type: "adr", name: "A1", path: "a1.md", description: "", tags: [], status: "active", createdAt: "", updatedAt: "", contributesTo: [], dependencies: [],
    };
    const prev = makeState([asset]);
    const curr = makeState([]);

    const delta = consolidator.computeDelta(prev, curr);
    expect(delta.assetsAdded).toHaveLength(0);
    expect(delta.assetsRemoved).toHaveLength(1);
    expect(delta.assetsRemoved[0]).toBe("a1");
  });

  it("computes delta with health changes", () => {
    const prev = makeState([], 60);
    const curr = makeState([], 80);

    const delta = consolidator.computeDelta(prev, curr);
    expect(delta.healthChanges.previous).toBe(60);
    expect(delta.healthChanges.current).toBe(80);
    expect(delta.healthChanges.delta).toBe(20);
  });

  it("applies delta and increments version", () => {
    const state = makeState();
    const asset: EngineeringAsset = {
      id: "a1", type: "adr", name: "A1", path: "a1.md", description: "", tags: [], status: "active", createdAt: "", updatedAt: "", contributesTo: [], dependencies: [],
    };

    const delta: StateDelta = {
      timestamp: new Date().toISOString(),
      assetsAdded: [asset],
      assetsRemoved: [],
      dimensionsChanged: [],
      capabilitiesChanged: [],
      healthChanges: { previous: 75, current: 80, delta: 5 },
    };

    const result = consolidator.applyDelta(state, delta);
    expect(result.version).toBe(1);
    expect(result.state.assets).toHaveLength(1);
    expect(consolidator.getVersion()).toBe(1);
  });

  it("applies multiple deltas", () => {
    let state = makeState();

    for (let i = 0; i < 3; i++) {
      const delta: StateDelta = {
        timestamp: new Date().toISOString(),
        assetsAdded: [{ id: `a${i}`, type: "adr", name: `A${i}`, path: `a${i}.md`, description: "", tags: [], status: "active", createdAt: "", updatedAt: "", contributesTo: [], dependencies: [] }],
        assetsRemoved: [],
        dimensionsChanged: [],
        capabilitiesChanged: [],
        healthChanges: { previous: 75, current: 80, delta: 5 },
      };
      state = consolidator.applyDelta(state, delta).state;
    }

    expect(consolidator.getVersion()).toBe(3);
    expect(state.assets).toHaveLength(3);
  });

  it("tracks pending deltas", () => {
    const state = makeState();
    const delta: StateDelta = {
      timestamp: new Date().toISOString(),
      assetsAdded: [],
      assetsRemoved: [],
      dimensionsChanged: [],
      capabilitiesChanged: [],
      healthChanges: { previous: 75, current: 80, delta: 5 },
    };

    consolidator.applyDelta(state, delta);
    expect(consolidator.getPendingDeltas()).toHaveLength(1);

    consolidator.clearPendingDeltas();
    expect(consolidator.getPendingDeltas()).toHaveLength(0);
  });

  it("handles null previous state", () => {
    const curr = makeState([
      { id: "a1", type: "adr", name: "A1", path: "a1.md", description: "", tags: [], status: "active", createdAt: "", updatedAt: "", contributesTo: [], dependencies: [] },
    ]);

    const delta = consolidator.computeDelta(null, curr);
    expect(delta.assetsAdded).toHaveLength(1);
  });
});
