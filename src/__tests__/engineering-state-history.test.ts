/**
 * engineering-state-history.test.ts — Tests for engineering state history
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  getSnapshotAt,
  listSnapshots,
  diffSnapshots,
} from "../engineering-state/index.js";
import type { EngineeringState } from "../application/engineering-state.js";

function createTmpDir(): string {
  const dir = join(tmpdir(), `test-history-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function createMockState(overrides: Partial<EngineeringState> = {}): EngineeringState {
  return {
    consolidatedAt: new Date().toISOString(),
    lifecycle: "governed" as const,
    project: {
      name: "test-project",
      root: "/tmp/project",
      stack: ["typescript"],
      hasGit: true,
      hasCI: false,
      hasTests: true,
      hasTypeScript: true,
      packageCount: 1,
      sourceFileCount: 10,
      monorepo: false,
    },
    maturity: null,
    capabilities: ["core"] as any,
    capabilityDrift: { detectedNotRegistered: [], registeredNotDetected: [] },
    knowledgeDebt: null,
    knowledgeGraph: null,
    assets: [],
    assetsByType: {} as any,
    activeRules: 0,
    activePolicies: 0,
    healthScores: { overall: 80, knowledgeDebt: 90, knowledgeGraph: 70 },
    entropy: { score: 20, orphanedAssets: 0, staleAssets: 0, missingDependencies: 0 },
    summary: "Test state",
    ...overrides,
  };
}

describe("engineering-state-history", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("getSnapshotAt", () => {
    it("returns null when no snapshots exist", () => {
      const result = getSnapshotAt(tmpDir, new Date().toISOString());
      expect(result).toBeNull();
    });

    it("returns null for non-existent directory", () => {
      const result = getSnapshotAt("/tmp/nonexistent", new Date().toISOString());
      expect(result).toBeNull();
    });
  });

  describe("listSnapshots", () => {
    it("returns empty array when no snapshots exist", () => {
      const result = listSnapshots(tmpDir);
      expect(result).toEqual([]);
    });

    it("returns empty array for non-existent directory", () => {
      const result = listSnapshots("/tmp/nonexistent");
      expect(result).toEqual([]);
    });
  });

  describe("diffSnapshots", () => {
    it("computes delta between two states", () => {
      const stateA = createMockState({
        healthScores: { overall: 70, knowledgeDebt: 80, knowledgeGraph: 60 },
        entropy: { score: 30, orphanedAssets: 0, staleAssets: 0, missingDependencies: 0 },
        assets: [{ id: "1", type: "adr", name: "ADR-1", path: "", description: "", tags: [], status: "active", createdAt: "", updatedAt: "", contributesTo: [], dependencies: [] }],
      });

      const stateB = createMockState({
        healthScores: { overall: 85, knowledgeDebt: 90, knowledgeGraph: 80 },
        entropy: { score: 15, orphanedAssets: 0, staleAssets: 0, missingDependencies: 0 },
        assets: [
          { id: "1", type: "adr", name: "ADR-1", path: "", description: "", tags: [], status: "active", createdAt: "", updatedAt: "", contributesTo: [], dependencies: [] },
          { id: "2", type: "skill", name: "Skill-1", path: "", description: "", tags: [], status: "active", createdAt: "", updatedAt: "", contributesTo: [], dependencies: [] },
        ],
      });

      const delta = diffSnapshots(stateA, stateB);

      expect(delta.healthScoreChange).toBe(15);
      expect(delta.entropyChange).toBe(-15);
      expect(delta.assetsAdded).toBe(1);
      expect(delta.assetsRemoved).toBe(0);
      expect(delta.capabilitiesChanged).toBe(false);
    });

    it("detects removed assets", () => {
      const stateA = createMockState({
        assets: [
          { id: "1", type: "adr", name: "ADR-1", path: "", description: "", tags: [], status: "active", createdAt: "", updatedAt: "", contributesTo: [], dependencies: [] },
          { id: "2", type: "skill", name: "Skill-1", path: "", description: "", tags: [], status: "active", createdAt: "", updatedAt: "", contributesTo: [], dependencies: [] },
        ],
      });

      const stateB = createMockState({
        assets: [{ id: "1", type: "adr", name: "ADR-1", path: "", description: "", tags: [], status: "active", createdAt: "", updatedAt: "", contributesTo: [], dependencies: [] }],
      });

      const delta = diffSnapshots(stateA, stateB);

      expect(delta.assetsAdded).toBe(0);
      expect(delta.assetsRemoved).toBe(1);
    });

    it("detects capability changes", () => {
      const stateA = createMockState({ capabilities: ["core"] });
      const stateB = createMockState({ capabilities: ["core", "governance"] });

      const delta = diffSnapshots(stateA, stateB);

      expect(delta.capabilitiesChanged).toBe(true);
    });
  });
});
