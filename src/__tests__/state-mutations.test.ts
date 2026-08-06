/**
 * state-mutations.test.ts — Tests for mutation governance
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  proposeStateMutation,
  getMutationLog,
  clearMutationLog,
  type StateMutation,
  type MutationSource,
} from "../engineering-state/index.js";
import { resetEventBus, getEventBus } from "../infrastructure/event-bus.js";
import type { EngineeringState } from "../application/engineering-state.js";

function createTmpDir(): string {
  const dir = join(tmpdir(), `test-mutations-${Date.now()}`);
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

describe("engineering-state-mutations", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
    resetEventBus();
    clearMutationLog();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    resetEventBus();
  });

  describe("proposeStateMutation", () => {
    it("applies valid mutation", () => {
      const mutation: StateMutation = {
        shitennoDir: tmpDir,
        newState: createMockState(),
        description: "Test mutation",
      };

      const source: MutationSource = { module: "test", trigger: "manual" };

      const result = proposeStateMutation(mutation, source);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.timestamp).toBeDefined();
    });

    it("rejects mutation without new state", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const mutation: StateMutation = {
        shitennoDir: tmpDir,
        newState: undefined as unknown as EngineeringState,
        description: "Invalid mutation",
      };

      const source: MutationSource = { module: "test", trigger: "manual" };

      const result = proposeStateMutation(mutation, source);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("New state is required");
    });

    it("rejects mutation with invalid health score", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const mutation: StateMutation = {
        shitennoDir: tmpDir,
        newState: createMockState({
          healthScores: { overall: 150, knowledgeDebt: 90, knowledgeGraph: 70 },
        }),
        description: "Invalid health score",
      };

      const source: MutationSource = { module: "test", trigger: "manual" };

      const result = proposeStateMutation(mutation, source);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Health score must be between 0 and 100");
    });

    it("rejects mutation with invalid entropy score", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const mutation: StateMutation = {
        shitennoDir: tmpDir,
        newState: createMockState({
          entropy: { score: -10, orphanedAssets: 0, staleAssets: 0, missingDependencies: 0 },
        }),
        description: "Invalid entropy score",
      };

      const source: MutationSource = { module: "test", trigger: "manual" };

      const result = proposeStateMutation(mutation, source);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Entropy score must be between 0 and 100");
    });

    it("logs mutation", () => {
      const mutation: StateMutation = {
        shitennoDir: tmpDir,
        newState: createMockState(),
        description: "Logged mutation",
      };

      const source: MutationSource = { module: "test", trigger: "manual" };

      proposeStateMutation(mutation, source);

      const log = getMutationLog();
      expect(log.length).toBe(1);
      const firstLog = log[0];
      expect(firstLog).toBeDefined();
      expect(firstLog!.allowed).toBe(true);
      expect(firstLog!.mutation.description).toBe("Logged mutation");
    });

    it("publishes state.mutated event", () => {
      const bus = getEventBus();
      let eventReceived = false;

      bus.subscribe("state.mutated", () => {
        eventReceived = true;
      });

      const mutation: StateMutation = {
        shitennoDir: tmpDir,
        newState: createMockState(),
        description: "Event mutation",
      };

      const source: MutationSource = { module: "test", trigger: "manual" };

      proposeStateMutation(mutation, source);

      expect(eventReceived).toBe(true);
    });
  });

  describe("clearMutationLog", () => {
    it("clears the mutation log", () => {
      const mutation: StateMutation = {
        shitennoDir: tmpDir,
        newState: createMockState(),
        description: "To be cleared",
      };

      const source: MutationSource = { module: "test", trigger: "manual" };

      proposeStateMutation(mutation, source);
      expect(getMutationLog().length).toBe(1);

      clearMutationLog();
      expect(getMutationLog().length).toBe(0);
    });
  });
});
