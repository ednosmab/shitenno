/**
 * doc-engine.test.ts — Tests for Documentation Engine
 *
 * Validates doc generation, staleness detection, and metadata tracking.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { DocEngine, DocType } from "../infrastructure/doc-engine.js";
import type { EngineeringState } from "../application/engineering-state.js";

// ── Helpers ────────────────────────────────────────────────────────────────

const makeState = (overrides: Partial<EngineeringState> = {}): EngineeringState => ({
  consolidatedAt: new Date().toISOString(),
  lifecycle: "governed",
  project: {
    name: "test-project",
    root: "/tmp/test",
    stack: ["TypeScript", "Node.js"],
    hasGit: true,
    hasCI: false,
    hasTests: true,
    hasTypeScript: true,
    packageCount: 10,
    sourceFileCount: 50,
    monorepo: false,
  },
  maturity: null,
  capabilities: [],
  capabilityDrift: { detectedNotRegistered: [], registeredNotDetected: [] },
  knowledgeDebt: { totalGaps: 5, healthScore: 70, detectedAt: new Date().toISOString() },
  knowledgeGraph: { totalArtifacts: 10, totalRelations: 15, healthScore: 80 },
  assets: [
    {
      id: "adr-001",
      type: "adr",
      name: "Use TypeScript",
      path: "docs/adrs/ADR-001.md",
      description: "ADR for TypeScript",
      tags: ["typescript"],
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      contributesTo: ["architecture"],
      dependencies: [],
    },
  ],
  assetsByType: { adr: 1 } as Record<string, number>,
  activeRules: 5,
  activePolicies: 3,
  healthScores: { knowledgeDebt: 70, knowledgeGraph: 80, overall: 75 },
  entropy: { orphanedAssets: 2, staleAssets: 1, missingDependencies: 0, score: 15 },
  summary: "Project is in good shape",
  ...overrides,
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("DocEngine", () => {
  let tmpDir: string;
  let engine: DocEngine;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `shitenno-doc-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    engine = new DocEngine(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("generateAll", () => {
    it("generates all docs on first run", () => {
      const state = makeState();
      const result = engine.generateAll(state);

      expect(result.generated).toHaveLength(5);
      expect(result.upToDate).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
    });

    it("marks docs as up-to-date on second run", () => {
      const state = makeState();
      engine.generateAll(state);

      const result2 = engine.generateAll(state);
      expect(result2.generated).toHaveLength(0);
      expect(result2.upToDate).toHaveLength(5);
    });

    it("regenerates when state changes", () => {
      const state1 = makeState();
      engine.generateAll(state1);

      const state2 = makeState({ activeRules: 10 });
      const result = engine.generateAll(state2);
      expect(result.generated.length).toBeGreaterThan(0);
    });

    it("force regenerates all docs", () => {
      const state = makeState();
      engine.generateAll(state);

      const result = engine.generateAll(state, true);
      expect(result.generated).toHaveLength(5);
    });
  });

  describe("generateDoc", () => {
    it("generates system map", () => {
      const state = makeState();
      const meta = engine.generateDoc("system-map", state);

      expect(meta.type).toBe("system-map");
      expect(meta.path).toContain("SYSTEM_MAP.md");
      expect(existsSync(join(tmpDir, meta.path))).toBe(true);
    });

    it("generates asset index", () => {
      const state = makeState();
      const meta = engine.generateDoc("asset-index", state);

      expect(meta.type).toBe("asset-index");
      const content = readFileSync(join(tmpDir, meta.path), "utf-8");
      expect(content).toContain("Asset Index");
      expect(content).toContain("Use TypeScript");
    });

    it("generates health report", () => {
      const state = makeState();
      const meta = engine.generateDoc("health-report", state);

      expect(meta.type).toBe("health-report");
      const content = readFileSync(join(tmpDir, meta.path), "utf-8");
      expect(content).toContain("75");
    });

    it("generates capability report", () => {
      const state = makeState();
      const meta = engine.generateDoc("capability-report", state);

      expect(meta.type).toBe("capability-report");
    });

    it("generates architecture overview", () => {
      const state = makeState();
      const meta = engine.generateDoc("architecture-overview", state);

      expect(meta.type).toBe("architecture-overview");
      const content = readFileSync(join(tmpDir, meta.path), "utf-8");
      expect(content).toContain("cognitive cycle");
    });

    it("throws for unknown doc type", () => {
      const state = makeState();
      expect(() => engine.generateDoc("unknown" as DocType, state)).toThrow("Unknown doc type");
    });
  });

  describe("getStaleDocs", () => {
    it("returns empty when no docs generated", () => {
      const state = makeState();
      const stale = engine.getStaleDocs(state);
      expect(stale).toHaveLength(0);
    });

    it("detects stale docs when state changes", () => {
      const state1 = makeState();
      engine.generateAll(state1);

      const state2 = makeState({ activeRules: 10 });
      const stale = engine.getStaleDocs(state2);
      expect(stale.length).toBeGreaterThan(0);
    });

    it("returns empty when docs are up-to-date", () => {
      const state = makeState();
      engine.generateAll(state);
      const stale = engine.getStaleDocs(state);
      expect(stale).toHaveLength(0);
    });
  });

  describe("getAllMetadata", () => {
    it("returns empty when no docs generated", () => {
      expect(engine.getAllMetadata()).toHaveLength(0);
    });

    it("returns metadata for all generated docs", () => {
      const state = makeState();
      engine.generateAll(state);
      expect(engine.getAllMetadata()).toHaveLength(5);
    });
  });
});
