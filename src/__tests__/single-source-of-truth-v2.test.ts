/**
 * single-source-of-truth-v2.test.ts — Tests for single source of truth (Phase 4)
 */

import { describe, it, expect } from "vitest";
import { consolidateEngineeringState } from "../application/engineering-state.js";

describe("Single Source of Truth (Phase 4)", () => {
  it("consolidateEngineeringState returns a valid state", () => {
    const state = consolidateEngineeringState("/tmp/project", "/tmp/project/shitenno");
    expect(state).toBeDefined();
    expect(state.consolidatedAt).toBeDefined();
    expect(state.lifecycle).toBeDefined();
    expect(state.project).toBeDefined();
    expect(Array.isArray(state.capabilities)).toBe(true);
    expect(Array.isArray(state.assets)).toBe(true);
  });

  it("engineering state has health scores", () => {
    const state = consolidateEngineeringState("/tmp/project", "/tmp/project/shitenno");
    expect(state.healthScores).toBeDefined();
    expect(typeof state.healthScores.overall).toBe("number");
    expect(typeof state.healthScores.knowledgeDebt).toBe("number");
    expect(typeof state.healthScores.knowledgeGraph).toBe("number");
  });

  it("engineering state has entropy", () => {
    const state = consolidateEngineeringState("/tmp/project", "/tmp/project/shitenno");
    expect(state.entropy).toBeDefined();
    expect(typeof state.entropy.score).toBe("number");
    expect(typeof state.entropy.orphanedAssets).toBe("number");
    expect(typeof state.entropy.staleAssets).toBe("number");
    expect(typeof state.entropy.missingDependencies).toBe("number");
  });
});
