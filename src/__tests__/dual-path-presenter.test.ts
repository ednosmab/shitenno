import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  formatDualPath,
  formatDualPathJson,
  formatGrowthProgress,
} from "../domain/types/dual-path-presenter.js";
import { loadGrowthProfile, } from "../infrastructure/growth-profile.js";
import type { EvolutionRecommendation } from "../application/auto-evolution.js";

let tempDir: string;
let shitennoDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-presenter-"));
  shitennoDir = join(tempDir, "shitenno");
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Dual Path Presenter", () => {
  const mockComfortable: EvolutionRecommendation = {
    id: "EVO-001",
    type: "capability_install",
    priority: "high",
    title: "Install Governance",
    description: "Add governance capability",
    expectedImpact: "Adds governance",
    action: "Run 'shugo upgrade --capability governance'",
    affectedArtifacts: [],
    dependencies: [],
    confidence: 0.8,
    evidence: [],
    feedbackAdjusted: false,
  };

  const mockChallenging: EvolutionRecommendation = {
    id: "CHL-001",
    type: "capability_install",
    priority: "high",
    title: "Master: Install Governance",
    description: "Instead of just installing, extract patterns",
    expectedImpact: "Adds governance + expands thinking",
    action: "Run 'shugo upgrade --capability governance' after reflecting",
    affectedArtifacts: [],
    dependencies: [],
    confidence: 0.7,
    evidence: [
      "Paradigm shift: Move from reactive to proactive",
      "Knowledge gap: Requires governance patterns",
    ],
    feedbackAdjusted: false,
  };

  describe("formatDualPath", () => {
    it("returns formatted string with both paths", () => {
      const profile = loadGrowthProfile(shitennoDir);
      const formatted = formatDualPath(mockComfortable, mockChallenging, profile);

      expect(formatted).toContain("PATH A: COMFORTABLE");
      expect(formatted).toContain("PATH B: CHALLENGING");
      expect(formatted).toContain("Install Governance");
      expect(formatted).toContain("Master: Install Governance");
    });

    it("includes paradigm shift when available", () => {
      const profile = loadGrowthProfile(shitennoDir);
      const formatted = formatDualPath(mockComfortable, mockChallenging, profile);

      expect(formatted).toContain("Paradigm Shift");
      expect(formatted).toContain("Move from reactive to proactive");
    });

    it("includes knowledge gap when available", () => {
      const profile = loadGrowthProfile(shitennoDir);
      const formatted = formatDualPath(mockComfortable, mockChallenging, profile);

      expect(formatted).toContain("Knowledge Gap");
      expect(formatted).toContain("Requires governance patterns");
    });

    it("includes growth progress", () => {
      const profile = loadGrowthProfile(shitennoDir);
      const formatted = formatDualPath(mockComfortable, mockChallenging, profile);

      expect(formatted).toContain("Growth Progress");
      expect(formatted).toContain("Capacity");
      expect(formatted).toContain("Challenge");
    });
  });

  describe("formatDualPathJson", () => {
    it("returns JSON-serializable object", () => {
      const profile = loadGrowthProfile(shitennoDir);
      const json = formatDualPathJson(mockComfortable, mockChallenging, profile);

      expect(json).toBeDefined();
      expect(json.comfortable).toBeDefined();
      expect(json.challenging).toBeDefined();
      expect(json.growthProfile).toBeDefined();
      expect(json.progress).toBeDefined();
    });

    it("includes comfortable path details", () => {
      const profile = loadGrowthProfile(shitennoDir);
      const json = formatDualPathJson(mockComfortable, mockChallenging, profile);

      expect(json.comfortable.id).toBe("EVO-001");
      expect(json.comfortable.title).toBe("Install Governance");
      expect(json.comfortable.pathType).toBe("comfortable");
    });

    it("includes challenging path details", () => {
      const profile = loadGrowthProfile(shitennoDir);
      const json = formatDualPathJson(mockComfortable, mockChallenging, profile);

      expect(json.challenging.id).toBe("CHL-001");
      expect(json.challenging.title).toBe("Master: Install Governance");
      expect(json.challenging.pathType).toBe("challenging");
    });

    it("includes paradigm shift when available", () => {
      const profile = loadGrowthProfile(shitennoDir);
      const json = formatDualPathJson(mockComfortable, mockChallenging, profile);

      expect(json.challenging.paradigmShift).toBe("Move from reactive to proactive");
    });

    it("includes knowledge gap when available", () => {
      const profile = loadGrowthProfile(shitennoDir);
      const json = formatDualPathJson(mockComfortable, mockChallenging, profile);

      expect(json.challenging.knowledgeGap).toBe("Requires governance patterns");
    });

    it("includes growth profile data", () => {
      const profile = loadGrowthProfile(shitennoDir);
      const json = formatDualPathJson(mockComfortable, mockChallenging, profile);

      expect(json.growthProfile.growthCapacity).toBe(0.3);
      expect(json.growthProfile.challengeLevel).toBe(0.36);
      expect(json.growthProfile.pattern).toBe("balanced");
    });

    it("calculates challenging ratio correctly", () => {
      const profile = loadGrowthProfile(shitennoDir);
      const json = formatDualPathJson(mockComfortable, mockChallenging, profile);

      expect(json.progress.totalChoices).toBe(0);
      expect(json.progress.challengingRatio).toBe(0);
    });
  });

  describe("formatGrowthProgress", () => {
    it("returns formatted progress string", () => {
      const profile = loadGrowthProfile(shitennoDir);
      const formatted = formatGrowthProgress(profile);

      expect(formatted).toContain("Growth Progress");
      expect(formatted).toContain("Capacity");
      expect(formatted).toContain("Challenge");
    });

    it("includes pattern description", () => {
      const profile = loadGrowthProfile(shitennoDir);
      const formatted = formatGrowthProgress(profile);

      expect(formatted).toContain("Pattern");
      expect(formatted).toContain("Default pattern");
    });

    it("includes choice statistics when history exists", () => {
      const profile = loadGrowthProfile(shitennoDir);
      profile.pathHistory = [
        {
          id: "test-1",
          timestamp: new Date().toISOString(),
          pathChosen: "challenging",
          context: {
            command: "evolve",
            recommendationType: "capability_install",
            maturityScore: 50,
          },
        },
        {
          id: "test-2",
          timestamp: new Date().toISOString(),
          pathChosen: "comfortable",
          context: {
            command: "evolve",
            recommendationType: "capability_install",
            maturityScore: 50,
          },
        },
      ];

      const formatted = formatGrowthProgress(profile);
      expect(formatted).toContain("Choices");
      expect(formatted).toContain("2 total");
    });
  });
});
