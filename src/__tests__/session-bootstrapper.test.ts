import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadEssentialContext, loadOptionalContext, getTokenStats, clearCache } from "../session-bootstrapper.js";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("session-bootstrapper", () => {
  let testDir: string;
  let shitennoDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `bootstrapper-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    shitennoDir = join(testDir, ".shitenno");
    mkdirSync(shitennoDir, { recursive: true });
    clearCache();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("loadEssentialContext", () => {
    it("should load essential files", () => {
      // Create test files
      const docsDir = join(shitennoDir, "docs");
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(join(docsDir, "AGENTS.md"), "# Test AGENTS.md");
      
      const contextDir = join(shitennoDir, "governance", "context");
      mkdirSync(contextDir, { recursive: true });
      writeFileSync(join(contextDir, "context_buffer.yaml"), "test: value");
      
      const result = loadEssentialContext(shitennoDir);
      
      expect(result.essential["docs/AGENTS.md"]).toBe("# Test AGENTS.md");
      expect(result.essential["governance/context/context_buffer.yaml"]).toBe("test: value");
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.budgetRemaining).toBeGreaterThan(0);
    });

    it("should handle missing files gracefully", () => {
      const result = loadEssentialContext(shitennoDir);
      
      expect(result.essential).toEqual({});
      expect(result.tokensUsed).toBe(0);
    });

    it("should estimate tokens correctly", () => {
      const docsDir = join(shitennoDir, "docs");
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(join(docsDir, "AGENTS.md"), "A".repeat(1000)); // 1000 chars ≈ 250 tokens
      
      const result = loadEssentialContext(shitennoDir);
      
      expect(result.tokensUsed).toBe(250); // 1000/4 = 250
    });
  });

  describe("loadOptionalContext", () => {
    it("should load optional files on demand", () => {
      const docsDir = join(shitennoDir, "docs");
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(join(docsDir, "opencode-context.md"), "# OpenCode Context");
      
      const result = loadOptionalContext(shitennoDir, ["opencode-context"]);
      
      expect(result["opencode-context"]).toBe("# OpenCode Context");
    });

    it("should handle missing optional files", () => {
      const result = loadOptionalContext(shitennoDir, ["opencode-context"]);
      
      expect(result).toEqual({});
    });

    it("should skip unknown keys", () => {
      const result = loadOptionalContext(shitennoDir, ["unknown-key" as any]);
      
      expect(result).toEqual({});
    });
  });

  describe("getTokenStats", () => {
    it("should return zero stats when cache is empty", () => {
      const stats = getTokenStats();
      
      expect(stats.cachedFiles).toBe(0);
      expect(stats.estimatedTokens).toBe(0);
    });

    it("should track cached files", () => {
      const docsDir = join(shitennoDir, "docs");
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(join(docsDir, "AGENTS.md"), "# Test");
      
      loadEssentialContext(shitennoDir);
      const stats = getTokenStats();
      
      expect(stats.cachedFiles).toBe(1);
      expect(stats.estimatedTokens).toBeGreaterThan(0);
    });
  });

  describe("clearCache", () => {
    it("should clear all cached files", () => {
      const docsDir = join(shitennoDir, "docs");
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(join(docsDir, "AGENTS.md"), "# Test");
      
      loadEssentialContext(shitennoDir);
      expect(getTokenStats().cachedFiles).toBe(1);
      
      clearCache();
      expect(getTokenStats().cachedFiles).toBe(0);
    });
  });
});
