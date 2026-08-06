/**
 * engineering-state-mutations.test.ts — Tests for state mutation governance
 *
 * Validates mutation validation, logging, and provenance tracking.
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
import { type EngineeringState } from "../application/engineering-state.js";

function makeValidState(): EngineeringState {
  return {
    consolidatedAt: new Date().toISOString(),
    lifecycle: "governed",
    project: {
      name: "test",
      root: "/tmp",
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
    capabilities: ["core"],
    capabilityDrift: { detectedNotRegistered: [], registeredNotDetected: [] },
    knowledgeDebt: null,
    knowledgeGraph: null,
    assets: [],
    assetsByType: {} as Record<string, number>,
    activeRules: 0,
    activePolicies: 0,
    healthScores: { knowledgeDebt: 0, knowledgeGraph: 0, overall: 75 },
    entropy: { orphanedAssets: 0, staleAssets: 0, missingDependencies: 0, score: 30 },
    summary: "Test state",
  };
}

function makeValidMutation(shitennoDir: string, overrides?: Partial<StateMutation>): StateMutation {
  return {
    shitennoDir,
    newState: makeValidState(),
    description: "Test mutation",
    ...overrides,
  };
}

function makeSource(): MutationSource {
  return { module: "test", trigger: "test-trigger" };
}

describe("proposeStateMutation", () => {
  let tmpDir: string;
  let shitennoDir: string;

  beforeEach(() => {
    clearMutationLog();
    tmpDir = join(tmpdir(), `shitenno-mutations-${Date.now()}`);
    shitennoDir = join(tmpDir, "shitenno");
    mkdirSync(shitennoDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("allows valid mutation", () => {
    const result = proposeStateMutation(makeValidMutation(shitennoDir), makeSource());
    expect(result.allowed).toBe(true);
    expect(result.timestamp).toBeDefined();
  });

  it("rejects mutation without consolidatedAt", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const mutation = makeValidMutation(shitennoDir);
    mutation.newState.consolidatedAt = "";
    const result = proposeStateMutation(mutation, makeSource());
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("consolidatedAt");
  });

  it("rejects mutation with health score out of range", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const mutation = makeValidMutation(shitennoDir);
    mutation.newState.healthScores.overall = 150;
    const result = proposeStateMutation(mutation, makeSource());
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Health score");
  });

  it("rejects mutation with entropy score out of range", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const mutation = makeValidMutation(shitennoDir);
    mutation.newState.entropy.score = -10;
    const result = proposeStateMutation(mutation, makeSource());
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Entropy score");
  });

  it("logs mutation in mutation log", () => {
    proposeStateMutation(makeValidMutation(shitennoDir), makeSource());
    const log = getMutationLog();
    expect(log.length).toBe(1);
    expect(log[0]?.allowed).toBe(true);
  });

  it("logs rejected mutation in mutation log", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const mutation = makeValidMutation(shitennoDir);
    mutation.newState.healthScores.overall = 200;
    proposeStateMutation(mutation, makeSource());
    const log = getMutationLog();
    expect(log.length).toBe(1);
    expect(log[0]?.allowed).toBe(false);
  });
});

describe("getMutationLog", () => {
  it("returns empty array initially", () => {
    clearMutationLog();
    expect(getMutationLog().length).toBe(0);
  });

  it("returns readonly array", () => {
    const log = getMutationLog();
    expect(Array.isArray(log)).toBe(true);
  });
});
