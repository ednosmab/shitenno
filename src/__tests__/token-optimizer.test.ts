import { describe, it, expect } from "vitest";
import { suggestDepth, generateOptimizationHints, compressedSummary, differentialBriefing, type Briefing } from "../domain/rules/token-optimizer.js";

function makeBriefing(overrides?: Partial<Briefing>): Briefing {
  return {
    generatedAt: "2024-01-01T00:00:00Z",
    project: { domain: "web-app", scale: "medium", stack: ["react"], maturityScore: 65 },
    risks: { overall: "medium", criticalAreas: [], highAreas: ["src/payments"] },
    tests: { hasTests: true, areasWithoutTests: ["src/utils"] },
    patterns: { recurringErrors: [], hotAreas: [], detected: [] },
    contextRules: [{ id: "r1", rule: "Test rule", rationale: "", priority: 1, area: "src/", basedOn: "risk-map" }],
    dynamicRules: [],
    recommendations: ["Fix tests"],
    tokenEconomy: { estimatedTokensSaved: 8400, cacheHit: false, contextRuleCount: 1, dynamicRuleCount: 0 },
    reminders: [],
    ...overrides,
  };
}

describe("token-optimizer", () => {
  describe("suggestDepth", () => {
    it("returns full for critical risk", () => {
      expect(suggestDepth("critical", true, 2)).toBe("full");
    });

    it("returns standard for high risk", () => {
      expect(suggestDepth("high", false, 4)).toBe("standard");
    });

    it("returns minimal for low risk", () => {
      expect(suggestDepth("low", false, 1)).toBe("minimal");
    });

    it("returns full when critical areas exist", () => {
      expect(suggestDepth("medium", true, 0)).toBe("full");
    });
  });

  describe("generateOptimizationHints", () => {
    it("returns hints with depth and token estimates", () => {
      const briefing = makeBriefing();
      const hints = generateOptimizationHints(briefing);

      expect(hints.suggestedDepth).toBeDefined();
      expect(hints.tokenEstimates).toHaveProperty("minimal");
      expect(hints.tokenEstimates).toHaveProperty("standard");
      expect(hints.tokenEstimates).toHaveProperty("full");
      expect(hints.tokenEstimates.minimal).toBeLessThan(hints.tokenEstimates.full);
    });

    it("skips sections for minimal depth", () => {
      const briefing = makeBriefing({
        risks: { overall: "low", criticalAreas: [], highAreas: [] },
      });
      const hints = generateOptimizationHints(briefing);
      expect(hints.suggestedDepth).toBe("minimal");
      expect(hints.skipSections).toContain("dynamicRules");
    });
  });

  describe("compressedSummary", () => {
    it("returns a compact string", () => {
      const briefing = makeBriefing();
      const summary = compressedSummary(briefing);
      expect(summary).toContain("web-app:medium");
      expect(summary).toContain("risk=medium");
      expect(summary).toContain("notest=1");
    });

    it("includes critical areas when present", () => {
      const briefing = makeBriefing({
        risks: { overall: "critical", criticalAreas: ["src/auth"], highAreas: [] },
      });
      const summary = compressedSummary(briefing);
      expect(summary).toContain("critical=src/auth");
    });
  });

  describe("differentialBriefing", () => {
    it("returns full summary when no old briefing", () => {
      const briefing = makeBriefing();
      const diff = differentialBriefing(null, briefing);
      expect(diff).toContain("web-app:medium");
    });

    it("returns no-changes when identical", () => {
      const briefing = makeBriefing();
      const diff = differentialBriefing(briefing, briefing);
      expect(diff).toBe("no-changes");
    });

    it("detects risk level change", () => {
      const old = makeBriefing({ risks: { overall: "low", criticalAreas: [], highAreas: [] } });
      const new_ = makeBriefing({ risks: { overall: "high", criticalAreas: [], highAreas: [] } });
      const diff = differentialBriefing(old, new_);
      expect(diff).toContain("risk:low→high");
    });

    it("detects new critical area", () => {
      const old = makeBriefing({ risks: { overall: "low", criticalAreas: [], highAreas: [] } });
      const new_ = makeBriefing({ risks: { overall: "critical", criticalAreas: ["src/auth"], highAreas: [] } });
      const diff = differentialBriefing(old, new_);
      expect(diff).toContain("+critical:src/auth");
    });
  });
});
