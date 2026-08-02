/**
 * growth-profile.test.ts — Tests for Semantic Growth Profile
 *
 * Verifies growth capacity calculation, challenge level adaptation,
 * pattern detection, and persistence.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  loadSemanticGrowthProfile,
  saveSemanticGrowthProfile,
  recordSemanticPathChoice,
  getDomainChallengeLevel,
  getMostFrequentPattern,
  isDomainChallenging,
} from "../../semantic/growth-profile.js";
import type { SemanticGrowthProfile } from "../../semantic/growth-profile.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

const TEST_DIR = join(process.cwd(), ".shitenno-test-semantic-growth");

function makeDefaultProfile(): SemanticGrowthProfile {
  const now = new Date().toISOString();
  return {
    projectId: "test-project",
    createdAt: now,
    updatedAt: now,
    growthCapacity: 0.3,
    challengeLevel: 0.36,
    pathHistory: [],
    patterns: [{ type: "balanced", confidence: 0.3, description: "Default" }],
    semanticChoices: [],
    patternFrequency: {} as SemanticGrowthProfile["patternFrequency"],
    domainChallengeLevels: {},
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Semantic Growth Profile", () => {
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

  // ── Load / Save ────────────────────────────────────────────────────────

  describe("load and save", () => {
    it("returns default profile when none exists", () => {
      const profile = loadSemanticGrowthProfile(TEST_DIR);
      expect(profile.growthCapacity).toBe(0.3);
      expect(profile.challengeLevel).toBe(0.36);
      expect(profile.semanticChoices).toEqual([]);
    });

    it("saves and loads profile", () => {
      const profile = makeDefaultProfile();
      profile.growthCapacity = 0.7;
      saveSemanticGrowthProfile(TEST_DIR, profile);

      const loaded = loadSemanticGrowthProfile(TEST_DIR);
      expect(loaded.growthCapacity).toBe(0.7);
    });
  });

  // ── Record Choices ─────────────────────────────────────────────────────

  describe("recordSemanticPathChoice", () => {
    it("records a choice and updates profile", () => {
      const profile = recordSemanticPathChoice(TEST_DIR, {
        pathChosen: "challenging",
        patternType: "architectural_shift",
        domain: "persistence",
        context: { command: "test", recommendationType: "test", maturityScore: 50 },
      });

      expect(profile.semanticChoices.length).toBe(1);
      expect(profile.semanticChoices[0]?.pathChosen).toBe("challenging");
      expect(profile.semanticChoices[0]?.patternType).toBe("architectural_shift");
      expect(profile.semanticChoices[0]?.domain).toBe("persistence");
    });

    it("adapts growth capacity based on choices", () => {
      let profile = loadSemanticGrowthProfile(TEST_DIR);

      // Record 5 challenging choices
      for (let i = 0; i < 5; i++) {
        profile = recordSemanticPathChoice(TEST_DIR, {
          pathChosen: "challenging",
          patternType: "architectural_shift",
          domain: "persistence",
          context: { command: "test", recommendationType: "test", maturityScore: 50 },
        });
      }

      expect(profile.growthCapacity).toBeGreaterThan(0.3);
    });

    it("tracks domain-specific challenge levels", () => {
      let profile = loadSemanticGrowthProfile(TEST_DIR);

      // Record challenging choices for persistence
      for (let i = 0; i < 3; i++) {
        profile = recordSemanticPathChoice(TEST_DIR, {
          pathChosen: "challenging",
          patternType: "architectural_shift",
          domain: "persistence",
          context: { command: "test", recommendationType: "test", maturityScore: 50 },
        });
      }

      expect(profile.domainChallengeLevels["persistence"]).toBeGreaterThan(0.5);
    });

    it("tracks pattern frequency", () => {
      const profile = recordSemanticPathChoice(TEST_DIR, {
        pathChosen: "challenging",
        patternType: "security_degradation",
        domain: "security",
        context: { command: "test", recommendationType: "test", maturityScore: 50 },
      });

      expect(profile.patternFrequency["security_degradation"]).toBeGreaterThan(0);
    });
  });

  // ── Query Helpers ──────────────────────────────────────────────────────

  describe("query helpers", () => {
    it("getDomainChallengeLevel returns default for unknown domain", () => {
      const profile = makeDefaultProfile();
      const level = getDomainChallengeLevel(profile, "unknown");
      expect(level).toBe(profile.challengeLevel);
    });

    it("getDomainChallengeLevel returns domain-specific level", () => {
      const profile = makeDefaultProfile();
      profile.domainChallengeLevels["persistence"] = 0.8;
      const level = getDomainChallengeLevel(profile, "persistence");
      expect(level).toBe(0.8);
    });

    it("getMostFrequentPattern returns most common pattern", () => {
      const profile = makeDefaultProfile();
      profile.patternFrequency = {
        architectural_shift: 5,
        security_degradation: 2,
        tech_debt_accumulation: 1,
      } as SemanticGrowthProfile["patternFrequency"];

      const mostFrequent = getMostFrequentPattern(profile);
      expect(mostFrequent).toBe("architectural_shift");
    });

    it("isDomainChallenging returns true for high level", () => {
      const profile = makeDefaultProfile();
      profile.domainChallengeLevels["security"] = 0.7;
      expect(isDomainChallenging(profile, "security")).toBe(true);
    });

    it("isDomainChallenging returns false for low level", () => {
      const profile = makeDefaultProfile();
      profile.domainChallengeLevels["security"] = 0.4;
      expect(isDomainChallenging(profile, "security")).toBe(false);
    });
  });
});
