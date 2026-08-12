import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  generateChallengingAlternative,
  calculateKnowledgeGap,
} from "../application/challenge-generator.js";
import { loadGrowthProfile, } from "../infrastructure/growth-profile.js";
import type { EvolutionRecommendation } from "../application/auto-evolution.js";
import type { ShitennoState } from "../application/state-manager.js";

let tempDir: string;
let shitennoDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-challenge-"));
  shitennoDir = join(tempDir, "shitenno");
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Challenge Generator", () => {

  const mockRecommendation: EvolutionRecommendation = {
    id: "EVO-001",
    type: "capability_install",
    priority: "high",
    title: "Install Governance",
    description: "Add governance capability to your project",
    expectedImpact: "Adds governance to your project",
    action: "Run 'shugo upgrade --capability governance'",
    command: "shugo upgrade --capability governance",
    affectedArtifacts: ["shitenno/governance"],
    dependencies: [],
    confidence: 0.8,
    evidence: ["Maturity profile recommends this capability"],
    feedbackAdjusted: false,
  };

  const mockState: ShitennoState = {
    knowledge: {
      adrs: [],
      skills: [],
      contracts: [],
      governanceDocs: [],
      scripts: [],
      runbooks: [],
    },
    project: {
      maturity: { overallScore: 50, dimensions: {}, computedAt: "" },
      installedCapabilities: ["core"],
      recommendedCapabilities: ["governance"],
      knowledgeDebt: null,
      complexity: null,
      projectInfo: {
        name: "test",
        stack: [],
        hasGit: true,
        hasCI: false,
        hasTests: false,
        hasTypeScript: false,
        packageCount: 0,
        sourceFileCount: 10,
      },
    },
    memory: {
      sessionId: null,
      branch: null,
      operationType: null,
      currentTask: { id: null, type: null, description: null, status: null },
      quickBoard: { emCurso: null, parado: [], proximo: [] },
      reminders: [],
      nextSteps: [],
      blockers: [],
      documentsLoaded: [],
    },
    consolidatedAt: new Date().toISOString(),
  };

  describe("generateChallengingAlternative", () => {
    it("generates a challenging alternative for a comfortable recommendation", () => {
      const profile = loadGrowthProfile(shitennoDir);
      const challenging = generateChallengingAlternative(mockRecommendation, profile);

      expect(challenging).toBeDefined();
      expect(challenging.id).toContain("CHL");
      expect(challenging.title).toContain("Master");
      expect(challenging.id).not.toBe(mockRecommendation.id);
    });

    it("preserves the recommendation type", () => {
      const profile = loadGrowthProfile(shitennoDir);
      const challenging = generateChallengingAlternative(mockRecommendation, profile);

      expect(challenging.type).toBe(mockRecommendation.type);
    });

    it("adjusts confidence based on growth capacity", () => {
      const profile = loadGrowthProfile(shitennoDir);
      profile.growthCapacity = 0.8;

      const challenging = generateChallengingAlternative(mockRecommendation, profile);
      expect(challenging.confidence).toBeGreaterThan(0.3);
    });

    it("includes paradigm shift in evidence", () => {
      const profile = loadGrowthProfile(shitennoDir);
      const challenging = generateChallengingAlternative(mockRecommendation, profile);

      const hasParadigmShift = challenging.evidence.some((e) =>
        e.includes("Paradigm shift")
      );
      expect(hasParadigmShift).toBe(true);
    });

    it("includes knowledge gap when state is provided", () => {
      const profile = loadGrowthProfile(shitennoDir);
      const challenging = generateChallengingAlternative(mockRecommendation, profile, mockState);

      const hasKnowledgeGap = challenging.evidence.some((e) =>
        e.includes("Knowledge gap")
      );
      expect(hasKnowledgeGap).toBe(true);
    });
  });

  describe("calculateKnowledgeGap", () => {
    it("identifies missing knowledge for capability install", () => {
      const gap = calculateKnowledgeGap(mockRecommendation, mockState);

      expect(gap).toBeDefined();
      expect(gap.requiredKnowledge).toContain("Install Governance patterns");
      expect(gap.severity).toBeDefined();
    });

    it("identifies existing knowledge", () => {
      const stateWithKnowledge: ShitennoState = {
        ...mockState,
        knowledge: {
          ...mockState.knowledge,
          adrs: [{ id: "ADR-001", title: "Test", status: "accepted", path: "" }],
        },
      };

      const gap = calculateKnowledgeGap(
        { ...mockRecommendation, type: "knowledge_creation" },
        stateWithKnowledge
      );

      expect(gap.currentKnowledge).toContain("ADR creation");
    });

    it("returns correct severity levels", () => {
      const gap = calculateKnowledgeGap(mockRecommendation, mockState);
      expect(["low", "medium", "high"]).toContain(gap.severity);
    });
  });
});
