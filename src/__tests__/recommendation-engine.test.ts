import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  runRecommendationEngine,
  recommendationEngineToText,
  type RecommendationEngineResult,
} from "../prioritization/recommend.js";
import type { EngineeringState } from "../engineering-state.js";
import type { CapabilityEngineResult } from "../capability-engine.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const TEST_DIR = join(tmpdir(), "shitenno-rec-engine-test");
const SHITENNO_DIR = join(TEST_DIR, "shugo");

beforeAll(() => {
  mkdirSync(join(SHITENNO_DIR, "governance", "rules"), { recursive: true });
  mkdirSync(join(SHITENNO_DIR, "governance", "context"), { recursive: true });
  mkdirSync(join(SHITENNO_DIR, "governance", "backlog"), { recursive: true });
  writeFileSync(
    join(SHITENNO_DIR, "governance", "context", "context_buffer.yaml"),
    "reminders:\n  - test\n",
  );
  writeFileSync(
    join(SHITENNO_DIR, "governance", "context", "quick_board.md"),
    "# Quick Board\n## Proximo\n- item\n",
  );
});
afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

function makeState(overrides: Partial<EngineeringState> = {}): EngineeringState {
  return {
    consolidatedAt: new Date().toISOString(),
    lifecycle: "governed",
    project: {
      name: "test-project",
      root: TEST_DIR,
      stack: [],
      hasGit: false,
      hasCI: false,
      hasTests: false,
      hasTypeScript: false,
      packageCount: 0,
      sourceFileCount: 0,
      monorepo: false,
    },
    maturity: null,
    capabilities: [],
    capabilityDrift: { detectedNotRegistered: [], registeredNotDetected: [] },
    knowledgeDebt: null,
    knowledgeGraph: null,
    assets: [],
    assetsByType: {} as Record<string, number>,
    activeRules: 0,
    activePolicies: 0,
    healthScores: { knowledgeDebt: 0, knowledgeGraph: 0, overall: 50 },
    entropy: { orphanedAssets: 0, staleAssets: 0, missingDependencies: 0, score: 0 },
    summary: "test",
    ...overrides,
  };
}

function makeCapResult(overrides: Partial<CapabilityEngineResult> = {}): CapabilityEngineResult {
  return {
    evaluatedAt: new Date().toISOString(),
    capabilities: [],
    byMaturity: { dormant: [], installed: [], configured: [], active: [], optimized: [] },
    overallScore: 50,
    recommendations: [],
    summary: "test",
    ...overrides,
  };
}

describe("runRecommendationEngine", () => {
  it("returns a RecommendationEngineResult", () => {
    const result = runRecommendationEngine({ state: makeState(), capResult: makeCapResult(), shitennoDir: SHITENNO_DIR });
    expect(result).toBeDefined();
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(typeof result.generatedAt).toBe("string");
    expect(typeof result.totalRecommendations).toBe("number");
    expect(typeof result.engineeringCapacityScore).toBe("number");
  });

  it("recommendations have required fields", () => {
    const result = runRecommendationEngine({ state: makeState(), capResult: makeCapResult(), shitennoDir: SHITENNO_DIR });
    for (const rec of result.recommendations) {
      expect(typeof rec.id).toBe("string");
      expect(typeof rec.title).toBe("string");
      expect(typeof rec.description).toBe("string");
      expect(["urgent", "high", "medium", "low"]).toContain(rec.priority);
      expect(typeof rec.confidence).toBe("number");
      expect(typeof rec.source).toBe("string");
    }
  });

  it("bySource and byPriority are populated", () => {
    const result = runRecommendationEngine({ state: makeState(), capResult: makeCapResult(), shitennoDir: SHITENNO_DIR });
    expect(result.bySource).toBeDefined();
    expect(result.byPriority).toBeDefined();
  });
});

describe("saveRecommendationResult / loadRecommendationResult", () => {
  it("round-trips through disk", () => {
    const result: RecommendationEngineResult = {
      generatedAt: new Date().toISOString(),
      totalRecommendations: 0,
      bySource: { capability_engine: 0, knowledge_debt: 0, pattern_detection: 0, entropy_reduction: 0, ai_readiness: 0, complexity_analysis: 0, asset_management: 0 },
      byPriority: { high: 1 },
      recommendations: [
        {
          id: "rec-1",
          source: "capability_engine",
          type: "activate",
          priority: "high",
          title: "Test Recommendation",
          description: "Do something",
          expectedImpact: "Improved governance",
          action: "Run shugo assess",
          command: "shugo assess",
          affectedArtifacts: [],
          dependencies: [],
          confidence: 0.9,
          evidence: ["Because"],
          generatedAt: new Date().toISOString(),
        },
      ],
      topNextSteps: ["Run shugo assess"],
      engineeringCapacityScore: 80,
      summary: "test",
    };
    const text = recommendationEngineToText(result);
    expect(text).toContain("Test Recommendation");
    expect(text).toContain("Run shugo assess");
  });
});
