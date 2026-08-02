/**
 * dual-path-presenter.test.ts — Tests for Semantic Dual Path Presenter
 *
 * Verifies that detected patterns are correctly formatted into
 * dual path presentations with growth-aware adaptation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  createSemanticDualPath,
  formatSemanticDualPath,
  formatSemanticDualPathJson,
} from "../../semantic/dual-path-presenter.js";
import type { DetectedPattern } from "../../semantic/pattern-rules.js";
import type { SemanticGrowthProfile } from "../../semantic/growth-profile.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

const TEST_DIR = join(process.cwd(), ".shitenno-test-dual-path");

function makePattern(type: string, domain: string): DetectedPattern {
  return {
    id: `test-${type}-${Date.now()}`,
    type: type as DetectedPattern["type"],
    domain: domain as DetectedPattern["domain"],
    domains: [domain as DetectedPattern["domain"]],
    confidence: 0.8,
    description: `Test pattern: ${type} in ${domain}`,
    signals: ["file.created"],
    suggestedActions: ["Test action 1", "Test action 2"],
    detectedAt: new Date().toISOString(),
    windowSessions: 5,
    evidence: [],
  };
}

function makeProfile(): SemanticGrowthProfile {
  const now = new Date().toISOString();
  return {
    projectId: "test-project",
    createdAt: now,
    updatedAt: now,
    growthCapacity: 0.5,
    challengeLevel: 0.5,
    pathHistory: [],
    patterns: [{ type: "balanced", confidence: 0.5, description: "Balanced" }],
    semanticChoices: [],
    patternFrequency: {} as SemanticGrowthProfile["patternFrequency"],
    domainChallengeLevels: {},
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Semantic Dual Path Presenter", () => {
  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(join(TEST_DIR, "governance"), { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  // ── createSemanticDualPath ─────────────────────────────────────────────

  describe("createSemanticDualPath", () => {
    it("creates dual path from pattern", () => {
      const pattern = makePattern("architectural_shift", "persistence");
      const profile = makeProfile();

      const dualPath = createSemanticDualPath(pattern, profile);

      expect(dualPath.pattern).toBe(pattern);
      expect(dualPath.pathA).toBeDefined();
      expect(dualPath.pathB).toBeDefined();
      expect(dualPath.pathA.label).toBeDefined();
      expect(dualPath.pathB.label).toBeDefined();
      expect(dualPath.challengeLevel).toBe(0.5);
    });

    it("uses correct templates for each pattern type", () => {
      const types = [
        "architectural_shift",
        "scope_drift",
        "security_degradation",
        "tech_debt_accumulation",
        "capability_gap",
        "maturity_regression",
      ];

      for (const type of types) {
        const pattern = makePattern(type, "persistence");
        const profile = makeProfile();
        const dualPath = createSemanticDualPath(pattern, profile);

        expect(dualPath.pathA.label).toBeDefined();
        expect(dualPath.pathB.label).toBeDefined();
        expect(dualPath.pathA.effort).toBeDefined();
      }
    });

    it("adapts to domain challenge level", () => {
      const pattern = makePattern("architectural_shift", "persistence");
      const profile = makeProfile();
      profile.domainChallengeLevels["persistence"] = 0.8;

      const dualPath = createSemanticDualPath(pattern, profile);
      expect(dualPath.domainLevel).toBe(0.8);
    });
  });

  // ── formatSemanticDualPath ─────────────────────────────────────────────

  describe("formatSemanticDualPath", () => {
    it("formats dual path for display", () => {
      const pattern = makePattern("architectural_shift", "persistence");
      const profile = makeProfile();
      const dualPath = createSemanticDualPath(pattern, profile);

      const formatted = formatSemanticDualPath(dualPath);
      expect(formatted).toContain("COMFORTABLE");
      expect(formatted).toContain("CHALLENGING");
      expect(formatted).toContain("persistence");
      expect(formatted).toContain("architectural_shift");
    });
  });

  // ── formatSemanticDualPathJson ─────────────────────────────────────────

  describe("formatSemanticDualPathJson", () => {
    it("formats dual path as JSON", () => {
      const pattern = makePattern("security_degradation", "security");
      const profile = makeProfile();
      const dualPath = createSemanticDualPath(pattern, profile);

      const json = formatSemanticDualPathJson(dualPath);
      expect(json.pattern.type).toBe("security_degradation");
      expect(json.pattern.domain).toBe("security");
      expect(json.pathA.pathType).toBe("comfortable");
      expect(json.pathB.pathType).toBe("challenging");
      expect(json.adaptation.challengeLevel).toBe(0.5);
    });

    it("includes growth benefit in challenging path", () => {
      const pattern = makePattern("capability_gap", "governance");
      const profile = makeProfile();
      const dualPath = createSemanticDualPath(pattern, profile);

      const json = formatSemanticDualPathJson(dualPath);
      expect(json.pathB.growthBenefit).toBeDefined();
    });
  });
});
