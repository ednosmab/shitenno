/**
 * engineering-state-access.test.ts — Tests for engineering state access
 *
 * Validates caching and single-point-of-access guarantee.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getEngineeringState, clearEngineeringStateCache } from "../engineering-state/index.js";
import { saveEngineeringState, type EngineeringState } from "../application/engineering-state.js";

describe("engineering-state-access", () => {
  let tmpDir: string;

  beforeEach(() => {
    clearEngineeringStateCache();
    tmpDir = join(tmpdir(), `shitenno-access-${Date.now()}`);
    mkdirSync(join(tmpDir, "shitenno"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("clearEngineeringStateCache resets cache", () => {
    clearEngineeringStateCache();
    expect(() => clearEngineeringStateCache()).not.toThrow();
  });

  it("getEngineeringState returns an object with expected properties", () => {
    const state = getEngineeringState(tmpDir, join(tmpDir, "shitenno"), true);
    expect(state).toBeDefined();
    expect(state).toHaveProperty("consolidatedAt");
    expect(state).toHaveProperty("healthScores");
    expect(state).toHaveProperty("entropy");
  });

  it("returns same reference when called twice without forceRefresh", () => {
    const state1 = getEngineeringState(tmpDir, join(tmpDir, "shitenno"), false);
    const state2 = getEngineeringState(tmpDir, join(tmpDir, "shitenno"), false);
    expect(state1).toBe(state2);
  });

  it("returns fresh state when forceRefresh=true", () => {
    const state1 = getEngineeringState(tmpDir, join(tmpDir, "shitenno"), false);
    clearEngineeringStateCache();
    const state2 = getEngineeringState(tmpDir, join(tmpDir, "shitenno"), true);
    expect(state1).not.toBe(state2);
  });
});

describe("engineering-state-access — cross-process cache", () => {
  let tmpDir: string;
  let shitennoDir: string;

  beforeEach(() => {
    clearEngineeringStateCache();
    tmpDir = join(tmpdir(), `shitenno-cross-${Date.now()}`);
    shitennoDir = join(tmpDir, "shitenno");
    mkdirSync(shitennoDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads from disk cache when governance/ has not changed", () => {
    // Simulate another process saving state to disk
    const mockState: EngineeringState = {
      consolidatedAt: new Date().toISOString(),
      lifecycle: "evolved",
      project: { name: "test", root: tmpDir, stack: [], hasGit: false, hasCI: false, hasTests: false, hasTypeScript: false, packageCount: 0, sourceFileCount: 0, monorepo: false },
      maturity: null,
      capabilities: ["core"],
      capabilityDrift: { detectedNotRegistered: [], registeredNotDetected: [] },
      knowledgeDebt: null,
      knowledgeGraph: null,
      assets: [],
      assetsByType: {} as Record<string, number>,
      activeRules: 0,
      activePolicies: 0,
      healthScores: { knowledgeDebt: 100, knowledgeGraph: 100, overall: 100 },
      entropy: { orphanedAssets: 0, staleAssets: 0, missingDependencies: 0, score: 0 },
      summary: "Test state from disk",
    };

    // Save to disk (simulating another process)
    saveEngineeringState(shitennoDir, mockState);

    // Clear in-memory cache
    clearEngineeringStateCache();

    // Should load from disk, not reconsolidate
    const state = getEngineeringState(tmpDir, shitennoDir, false);
    expect(state.summary).toBe("Test state from disk");
  });

  it("recalculates when governance/ file is modified after consolidation", () => {
    // Create governance dir with a file
    const govDir = join(shitennoDir, "governance");
    mkdirSync(govDir, { recursive: true });
    writeFileSync(join(govDir, "test.md"), "# Test", "utf-8");

    // Save state with old timestamp
    const oldState: EngineeringState = {
      consolidatedAt: new Date(Date.now() - 120_000).toISOString(), // 2 minutes ago
      lifecycle: "evolved",
      project: { name: "test", root: tmpDir, stack: [], hasGit: false, hasCI: false, hasTests: false, hasTypeScript: false, packageCount: 0, sourceFileCount: 0, monorepo: false },
      maturity: null,
      capabilities: ["core"],
      capabilityDrift: { detectedNotRegistered: [], registeredNotDetected: [] },
      knowledgeDebt: null,
      knowledgeGraph: null,
      assets: [],
      assetsByType: {} as Record<string, number>,
      activeRules: 0,
      activePolicies: 0,
      healthScores: { knowledgeDebt: 100, knowledgeGraph: 100, overall: 100 },
      entropy: { orphanedAssets: 0, staleAssets: 0, missingDependencies: 0, score: 0 },
      summary: "Old state from disk",
    };

    saveEngineeringState(shitennoDir, oldState);
    clearEngineeringStateCache();

    // Modify governance file (newer than consolidatedAt)
    writeFileSync(join(govDir, "test.md"), "# Updated", "utf-8");

    // Should recalculate, not use old disk state
    const state = getEngineeringState(tmpDir, shitennoDir, false);
    expect(state.summary).not.toBe("Old state from disk");
  });

  it("recalculates when governance/ file is modified less than 60s after consolidation (regression: TTL fast-path bug)", async () => {
    // Unlike the test above, this does NOT backdate consolidatedAt — it
    // reproduces the realistic case of editing a file immediately after
    // a consolidation happened (e.g. marking a plan Done right after
    // running a command). A TTL-based fast path previously reported
    // "fresh" here unconditionally for the first 60s, masking the change.
    const govDir = join(shitennoDir, "governance", "plans");
    mkdirSync(govDir, { recursive: true });
    writeFileSync(join(govDir, "test-plan.md"), "**Status:** In Progress", "utf-8");

    const state1 = getEngineeringState(tmpDir, shitennoDir, true);
    clearEngineeringStateCache();
    
    await new Promise(r => setTimeout(r, 10));

    writeFileSync(join(govDir, "test-plan.md"), "**Status:** Done", "utf-8");
    clearEngineeringStateCache();

    const state2 = getEngineeringState(tmpDir, shitennoDir, false);
    expect(state2.consolidatedAt).not.toBe(state1.consolidatedAt);
  });

  it("forceRefresh bypasses disk cache", () => {
    const mockState: EngineeringState = {
      consolidatedAt: new Date().toISOString(),
      lifecycle: "evolved",
      project: { name: "test", root: tmpDir, stack: [], hasGit: false, hasCI: false, hasTests: false, hasTypeScript: false, packageCount: 0, sourceFileCount: 0, monorepo: false },
      maturity: null,
      capabilities: ["core"],
      capabilityDrift: { detectedNotRegistered: [], registeredNotDetected: [] },
      knowledgeDebt: null,
      knowledgeGraph: null,
      assets: [],
      assetsByType: {} as Record<string, number>,
      activeRules: 0,
      activePolicies: 0,
      healthScores: { knowledgeDebt: 100, knowledgeGraph: 100, overall: 100 },
      entropy: { orphanedAssets: 0, staleAssets: 0, missingDependencies: 0, score: 0 },
      summary: "Disk state that should be bypassed",
    };

    saveEngineeringState(shitennoDir, mockState);
    clearEngineeringStateCache();

    // forceRefresh should ignore disk cache
    const state = getEngineeringState(tmpDir, shitennoDir, true);
    expect(state.summary).not.toBe("Disk state that should be bypassed");
  });
});
