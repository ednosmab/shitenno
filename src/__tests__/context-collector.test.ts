import { describe, it, expect } from "vitest";
import { collectContext, type ContextDeps } from "../application/context-collector.js";
import type { ProjectFingerprint } from "../infrastructure/project-fingerprint.js";
import type { Briefing } from "../application/briefing.js";

// Mock briefing for testing
const mockBriefing: Briefing = {
  generatedAt: "2024-01-01T00:00:00Z",
  project: {
    domain: "web-app",
    scale: "small",
    stack: ["typescript"],
    maturityScore: 50,
  },
  risks: {
    overall: "low",
    criticalAreas: [],
    highAreas: [],
  },
  tests: {
    hasTests: true,
    areasWithoutTests: [],
  },
  contextRules: [],
  dynamicRules: [],
  patterns: {
    recurringErrors: [],
    hotAreas: [],
    detected: [],
  },
  reminders: [],
  recommendations: ["Add more tests"],
  tokenEconomy: {
    estimatedTokensSaved: 5000,
    cacheHit: false,
    contextRuleCount: 0,
    dynamicRuleCount: 0,
  },
};

// Mock dependencies
const mockDeps: ContextDeps = {
  loadFingerprint: () => null,
  saveFingerprint: () => {},
  isFingerprintStale: () => false,
  analyseProject: () => ({
    rootDir: "/project",
    hasGit: true,
    hasPackageJson: true,
    hasShitenno: false,
    stack: ["typescript"],
    packageManager: "npm",
    monorepo: false,
    packageCount: 1,
    appCount: 1,
    dependencyCount: 10,
    sourceFileCount: 10,
    hasTests: true,
    hasLinter: false,
    hasCI: false,
    hasTypeScript: true,
    totalCommits: 0,
    flatSourceFiles: 0,
    layeredDirs: 0,
    nodeApiImportsOutsideLayers: 0,
    portsConsumed: false,
  }),
  loadMaturityProfile: () => null,
  generateProjectFingerprint: () => ({
    hash: "abc123",
    detectedAt: "2024-01-01T00:00:00Z",
    domain: "web-app",
    scale: "small",
    stack: ["typescript"],
    tooling: {
      typescript: true,
      tests: true,
      ci: false,
      linter: false,
      monorepo: false,
    },
    version: 1,
  }),
  generateRiskMap: () => ({
    generatedAt: "2024-01-01T00:00:00Z",
    overallRisk: "low",
    overallScore: 20,
    areas: [],
    summary: "Low risk project",
  }),
  generateContextRules: () => [],
  generateDynamicRules: () => [],
  generateBriefing: () => mockBriefing,
  detectPatterns: () => ({
    detectedAt: "2024-01-01T00:00:00Z",
    historyEntriesAnalyzed: 0,
    reportsAnalyzed: 0,
    patterns: [],
    candidateRules: [],
    summary: "No patterns detected",
  }),
  getCached: () => null,   // disable cache reads in tests
  setCache: () => {},      // disable cache writes in tests
};

describe("context-collector", () => {
  describe("collectContext", () => {
    it("returns a complete ContextSnapshot", () => {
      const snapshot = collectContext("/project", "/project/shitenno", mockDeps);

      expect(snapshot).toBeDefined();
      expect(snapshot.collectedAt).toBeDefined();
      expect(snapshot.inputHash).toBeDefined();
      expect(snapshot.fingerprint).toBeDefined();
      expect(snapshot.riskMap).toBeDefined();
      expect(snapshot.contextRules).toBeDefined();
      expect(snapshot.dynamicRules).toBeDefined();
      expect(snapshot.briefing).toBeDefined();
    });

    it("generates input hash for cache invalidation", () => {
      const snapshot = collectContext("/project", "/project/shitenno", mockDeps);

      expect(snapshot.inputHash).toMatch(/^[a-f0-9]{16}$/);
    });

    it("uses injected dependencies", () => {
      let fingerprintSaved = false;
      const depsWithTracking: ContextDeps = {
        ...mockDeps,
        saveFingerprint: () => { fingerprintSaved = true; },
      };

      collectContext("/project", "/project/shitenno", depsWithTracking);
      expect(fingerprintSaved).toBe(true);
    });

    it("uses existing fingerprint when available", () => {
      const existingFingerprint: ProjectFingerprint = {
        hash: "existing123",
        detectedAt: "2024-01-01T00:00:00Z",
        domain: "api",
        scale: "medium",
        stack: ["node"],
        tooling: {
          typescript: true,
          tests: false,
          ci: false,
          linter: false,
          monorepo: false,
        },
        version: 1,
      };

      let fingerprintGenerated = false;
      const depsWithExisting: ContextDeps = {
        ...mockDeps,
        loadFingerprint: () => existingFingerprint,
        generateProjectFingerprint: () => {
          fingerprintGenerated = true;
          return existingFingerprint;
        },
      };

      const snapshot = collectContext("/project", "/project/shitenno", depsWithExisting);
      expect(snapshot.fingerprint.hash).toBe("existing123");
      expect(fingerprintGenerated).toBe(false);
    });
  });
});
