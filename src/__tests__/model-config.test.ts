/**
 * model-config.test.ts — Tests for model configuration
 *
 * Validates model registry, defaults, and answers integration.
 */

import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  registerModel,
  getModelConfig,
  getAllModels,
  getRecommendedContextLength,
  getPreferredOutputFormat,
  initializeDefaultModels,
  loadAnswers,
  initializeFromAnswers,
  type ModelConfig,
} from "../infrastructure/model-config.js";

describe("registerModel / getModelConfig", () => {
  it("registers and retrieves a model", () => {
    const config: ModelConfig = {
      modelId: "test-model",
      displayName: "Test Model",
      provider: "test",
      capabilities: {
        maxTokens: 4096,
        supportsStreaming: true,
        supportsTools: false,
        supportsImages: false,
        contextWindow: 8000,
      },
      recommendedContextLength: 4000,
      preferredOutputFormat: "json",
    };
    registerModel(config);
    expect(getModelConfig("test-model")).toEqual(config);
  });

  it("returns undefined for unknown model", () => {
    expect(getModelConfig("nonexistent")).toBeUndefined();
  });
});

describe("getAllModels", () => {
  it("returns all registered models", () => {
    initializeDefaultModels();
    const models = getAllModels();
    expect(models.length).toBeGreaterThanOrEqual(5);
  });
});

describe("getRecommendedContextLength", () => {
  it("returns default 4000 for unknown model", () => {
    expect(getRecommendedContextLength("unknown")).toBe(4000);
  });

  it("returns configured length for known model", () => {
    initializeDefaultModels();
    expect(getRecommendedContextLength("claude-3-opus")).toBe(8000);
  });
});

describe("getPreferredOutputFormat", () => {
  it("returns json as default", () => {
    expect(getPreferredOutputFormat("unknown")).toBe("json");
  });
});

describe("loadAnswers", () => {
  it("returns null when answers.json missing", () => {
    expect(loadAnswers("/nonexistent")).toBeNull();
  });

  it("parses valid answers.json", () => {
    const dir = join(tmpdir(), `shitenno-answers-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "answers.json"), JSON.stringify({ principalModel: "gpt-4" }), "utf-8");
    const answers = loadAnswers(dir);
    expect(answers).toEqual({ principalModel: "gpt-4" });
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns null for invalid JSON", () => {
    const dir = join(tmpdir(), `shitenno-answers-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "answers.json"), "invalid json", "utf-8");
    expect(loadAnswers(dir)).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("initializeFromAnswers", () => {
  it("does not throw when answers.json missing", () => {
    expect(() => initializeFromAnswers("/nonexistent")).not.toThrow();
  });
});
