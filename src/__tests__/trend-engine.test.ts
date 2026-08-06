/**
 * trend-engine.test.ts — Tests for trend prediction engine
 */

import { describe, it, expect } from "vitest";
import {
  buildTrendSnapshots,
  analyseTrends,
  generatePredictions,
  generateForecast,
  type TrendSnapshot,
} from "../domain/rules/trend-engine.js";
import type { EngineeringState } from "../application/engineering-state.js";

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

describe("trend-engine", () => {
  describe("buildTrendSnapshots", () => {
    it("converts engineering states to trend snapshots", () => {
      const states = [
        createMockState({ consolidatedAt: "2026-01-01T00:00:00Z" }),
        createMockState({ consolidatedAt: "2026-01-02T00:00:00Z" }),
      ];

      const snapshots = buildTrendSnapshots(states);

      expect(snapshots.length).toBe(2);
      const firstSnapshot = snapshots[0];
      const secondSnapshot = snapshots[1];
      expect(firstSnapshot).toBeDefined();
      expect(firstSnapshot!.timestamp).toBe("2026-01-01T00:00:00Z");
      expect(secondSnapshot).toBeDefined();
      expect(secondSnapshot!.timestamp).toBe("2026-01-02T00:00:00Z");
    });
  });

  describe("analyseTrends", () => {
    it("returns empty array for insufficient data", () => {
      const snapshots: TrendSnapshot[] = [
        { timestamp: "2026-01-01", healthScore: 80, entropyScore: 20, maturityScore: 70, assetCount: 10 },
      ];

      const trends = analyseTrends(snapshots);

      expect(trends.length).toBe(0);
    });

    it("detects improving trend", () => {
      const snapshots: TrendSnapshot[] = [
        { timestamp: "2026-01-01", healthScore: 70, entropyScore: 30, maturityScore: 60, assetCount: 10 },
        { timestamp: "2026-01-02", healthScore: 80, entropyScore: 20, maturityScore: 70, assetCount: 15 },
      ];

      const trends = analyseTrends(snapshots);

      expect(trends.length).toBe(4);
      const healthTrend = trends.find((t) => t.metric === "health");
      expect(healthTrend).toBeDefined();
      expect(healthTrend!.direction).toBe("improving");
      const entropyTrend = trends.find((t) => t.metric === "entropy");
      expect(entropyTrend).toBeDefined();
      expect(entropyTrend!.direction).toBe("degrading");
    });

    it("detects stable trend", () => {
      const snapshots: TrendSnapshot[] = [
        { timestamp: "2026-01-01", healthScore: 80, entropyScore: 20, maturityScore: 70, assetCount: 10 },
        { timestamp: "2026-01-02", healthScore: 80.3, entropyScore: 20.3, maturityScore: 70.3, assetCount: 10 },
      ];

      const trends = analyseTrends(snapshots);

      const healthTrend = trends.find((t) => t.metric === "health");
      expect(healthTrend).toBeDefined();
      expect(healthTrend!.direction).toBe("stable");
    });
  });

  describe("generatePredictions", () => {
    it("generates short and medium predictions", () => {
      const current: TrendSnapshot = {
        timestamp: "2026-01-02",
        healthScore: 80,
        entropyScore: 20,
        maturityScore: 70,
        assetCount: 15,
      };

      const trends = [
        { metric: "health", direction: "improving" as const, rate: 5 },
      ];

      const predictions = generatePredictions(current, trends);

      expect(predictions.length).toBe(2);
      const shortPrediction = predictions[0];
      const mediumPrediction = predictions[1];
      expect(shortPrediction).toBeDefined();
      expect(shortPrediction!.timeframe).toBe("short");
      expect(mediumPrediction).toBeDefined();
      expect(mediumPrediction!.timeframe).toBe("medium");
      expect(shortPrediction!.predictedValue).toBe(105);
      expect(mediumPrediction!.predictedValue).toBe(180);
    });
  });

  describe("generateForecast", () => {
    it("returns null for insufficient data", () => {
      const states = [createMockState()];

      const forecast = generateForecast(states);

      expect(forecast).toBeNull();
    });

    it("generates full forecast with sufficient data", () => {
      const states = [
        createMockState({ consolidatedAt: "2026-01-01T00:00:00Z" }),
        createMockState({ consolidatedAt: "2026-01-02T00:00:00Z" }),
        createMockState({ consolidatedAt: "2026-01-03T00:00:00Z" }),
      ];

      const forecast = generateForecast(states);

      expect(forecast).not.toBeNull();
      expect(forecast!.current).toBeDefined();
      expect(forecast!.trends.length).toBe(4);
      expect(forecast!.predictions.length).toBeGreaterThan(0);
      expect(forecast!.confidence).toBeGreaterThan(0);
    });
  });
});
