/**
 * ai-interface.test.ts — Tests for AI interface (context command + model config)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { executeContextCommand } from "../commands/context.js";
import {
  registerModel,
  getModelConfig,
  getAllModels,
  getRecommendedContextLength,
  getPreferredOutputFormat,
  type ModelConfig,
} from "../infrastructure/model-config.js";

function createTmpDir(): string {
  const dir = join(tmpdir(), `test-ai-interface-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function createMockEngineeringState(shitennoDir: string): void {
  const state = {
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
  };

  writeFileSync(join(shitennoDir, "engineering-state.json"), JSON.stringify(state, null, 2));
}

describe("ai-interface", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("model-config", () => {
    it("registers and retrieves model", () => {
      const config: ModelConfig = {
        modelId: "test-model",
        displayName: "Test Model",
        provider: "test",
        capabilities: {
          maxTokens: 4096,
          supportsStreaming: true,
          supportsTools: true,
          supportsImages: false,
          contextWindow: 32000,
        },
        recommendedContextLength: 4000,
        preferredOutputFormat: "json",
      };

      registerModel(config);

      const retrieved = getModelConfig("test-model");
      expect(retrieved).toBeDefined();
      expect(retrieved?.displayName).toBe("Test Model");
    });

    it("returns all registered models", () => {
      const models = getAllModels();
      expect(models.length).toBeGreaterThan(0);
    });

    it("returns default context length for unknown model", () => {
      const length = getRecommendedContextLength("unknown-model");
      expect(length).toBe(4000);
    });

    it("returns default output format for unknown model", () => {
      const format = getPreferredOutputFormat("unknown-model");
      expect(format).toBe("json");
    });
  });

  describe("context command", () => {
    it("generates context from engineering state", async () => {
      const projectDir = join(tmpDir, "test-project");
      const shitennoDir = join(projectDir, ".shitenno");
      mkdirSync(shitennoDir, { recursive: true });
      createMockEngineeringState(shitennoDir);

      const capturedOutput = { output: "" };
      const outputSpy = vi.spyOn(process.stdout, "write").mockImplementation((msg: string | Uint8Array) => {
        capturedOutput.output += msg;
        return true;
      });

      const originalCwd = process.cwd;
      process.cwd = () => projectDir;

      try {
        await executeContextCommand({ json: false });

        expect(capturedOutput.output).toContain("Project Context");
        expect(capturedOutput.output).toContain("test-project");
        expect(capturedOutput.output).toContain("Engineering State");
      } finally {
        outputSpy.mockRestore();
        process.cwd = originalCwd;
      }
    });

    it("outputs JSON when requested", async () => {
      const projectDir = join(tmpDir, "test-project");
      const shitennoDir = join(projectDir, ".shitenno");
      mkdirSync(shitennoDir, { recursive: true });
      createMockEngineeringState(shitennoDir);

      const capturedOutput = { output: "" };
      const outputSpy = vi.spyOn(process.stdout, "write").mockImplementation((msg: string | Uint8Array) => {
        capturedOutput.output += msg;
        return true;
      });

      const originalCwd = process.cwd;
      process.cwd = () => projectDir;

      try {
        await executeContextCommand({ json: true });

        const parsed = JSON.parse(capturedOutput.output);
        expect(parsed.version).toBe("1.0.0");
        expect(parsed.project.name).toBe("test-project");
      } finally {
        outputSpy.mockRestore();
        process.cwd = originalCwd;
      }
    });
  });
});
