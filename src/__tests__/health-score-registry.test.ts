/**
 * health-score-registry.test.ts — Tests for unified health score system
 */

import { describe, it, expect } from "vitest";
import {
  getEngineeringRiskScore,
  getKnowledgeHealthScore,
} from "../domain/rules/health-score-registry.js";

describe("health-score-registry", () => {
  describe("getEngineeringRiskScore", () => {
    it("returns 100 for no findings", () => {
      const result = getEngineeringRiskScore([], 100);
      expect(result.score).toBe(100);
      expect(result.label).toBe("Engineering Risk");
      expect(result.type).toBe("engineering_risk");
    });

    it("returns lower score for more severe findings", () => {
      const fewFindings = [{ severity: "low" }];
      const manyFindings = [{ severity: "critical" }, { severity: "critical" }];

      const fewResult = getEngineeringRiskScore(fewFindings, 100);
      const manyResult = getEngineeringRiskScore(manyFindings, 100);

      expect(fewResult.score).toBeGreaterThan(manyResult.score);
    });

    it("penalizes critical findings but does not zero on small finding sets (sample = project scope)", () => {
      const result = getEngineeringRiskScore([{ severity: "critical" }], 100);
      expect(result.score).toBe(61);
    });

    it("uses project scope as sample — a critical finding in a large project keeps a healthy score", () => {
      const result = getEngineeringRiskScore([{ severity: "critical" }], 300);
      expect(result.score).toBe(85);
    });

    it("does not zero with a single low-severity finding", () => {
      const result = getEngineeringRiskScore([{ severity: "low" }], 100);
      expect(result.score).toBeGreaterThan(90);
    });
  });

  describe("getKnowledgeHealthScore", () => {
    it("returns 100 for perfect scores", () => {
      const result = getKnowledgeHealthScore(100, 100, 0);
      expect(result.score).toBe(100);
      expect(result.label).toBe("Knowledge Health");
      expect(result.type).toBe("knowledge_health");
    });

    it("returns lower score for worse inputs", () => {
      const goodResult = getKnowledgeHealthScore(90, 90, 10);
      const badResult = getKnowledgeHealthScore(50, 50, 50);

      expect(goodResult.score).toBeGreaterThan(badResult.score);
    });

    it("inverts entropy score (lower entropy = better)", () => {
      const lowEntropy = getKnowledgeHealthScore(100, 100, 0);
      const highEntropy = getKnowledgeHealthScore(100, 100, 100);

      expect(lowEntropy.score).toBeGreaterThan(highEntropy.score);
    });
  });
});
