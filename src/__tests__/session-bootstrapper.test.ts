import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadSessionContext, loadEssentialContext, loadOptionalContext, getTokenStats, clearCache } from "../session-bootstrapper.js";
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

  describe("loadSessionContext", () => {
    it("should load minimal profile with only essential files", () => {
      const docsDir = join(shitennoDir, "docs");
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(join(docsDir, "AGENTS.md"), "# Test AGENTS.md");
      
      const contextDir = join(shitennoDir, "governance", "context");
      mkdirSync(contextDir, { recursive: true });
      writeFileSync(join(contextDir, "context_buffer.yaml"), "test: value");
      
      const result = loadSessionContext(shitennoDir, "minimal");
      
      expect(result.profile).toBe("minimal");
      expect(result.essential["docs/AGENTS.md"]).toBe("# Test AGENTS.md");
      expect(result.essential["governance/context/context_buffer.yaml"]).toBe("test: value");
      expect(result.optional).toEqual({});
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.budgetRemaining).toBeGreaterThan(0);
    });

    it("should load lite profile with essential + optional files", () => {
      const docsDir = join(shitennoDir, "docs");
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(join(docsDir, "AGENTS.md"), "# Test AGENTS.md");
      writeFileSync(join(docsDir, "opencode-context.md"), "# OpenCode Context");
      
      const contextDir = join(shitennoDir, "governance", "context");
      mkdirSync(contextDir, { recursive: true });
      writeFileSync(join(contextDir, "context_buffer.yaml"), "test: value");
      
      const govDir = join(shitennoDir, "governance");
      writeFileSync(join(govDir, "MANDATORY_CONTEXT.md"), "# Mandatory");
      
      const result = loadSessionContext(shitennoDir, "lite");
      
      expect(result.profile).toBe("lite");
      expect(result.essential["docs/AGENTS.md"]).toBe("# Test AGENTS.md");
      expect(result.optional["opencode-context"]).toBe("# OpenCode Context");
      expect(result.optional["mandatory-context"]).toBe("# Mandatory");
    });

    it("should load full profile with all files", () => {
      const docsDir = join(shitennoDir, "docs");
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(join(docsDir, "AGENTS.md"), "# Test AGENTS.md");
      writeFileSync(join(docsDir, "opencode-context.md"), "# OpenCode Context");
      
      const contextDir = join(shitennoDir, "governance", "context");
      mkdirSync(contextDir, { recursive: true });
      writeFileSync(join(contextDir, "context_buffer.yaml"), "test: value");
      
      const govDir = join(shitennoDir, "governance");
      writeFileSync(join(govDir, "MANDATORY_CONTEXT.md"), "# Mandatory");
      writeFileSync(join(govDir, "skill-manifest.yaml"), "skills: []");
      writeFileSync(join(govDir, "rule-manifest.yaml"), "rules: []");
      
      const agentsDir = join(govDir, "agents");
      mkdirSync(agentsDir, { recursive: true });
      writeFileSync(join(agentsDir, "test.yaml"), "agent: test");
      
      const result = loadSessionContext(shitennoDir, "full");
      
      expect(result.profile).toBe("full");
      expect(result.optional["skill-manifest"]).toBe("skills: []");
      expect(result.optional["rule-manifest"]).toBe("rules: []");
      expect(result.optional["agent-contracts:test.yaml"]).toBe("agent: test");
    });

    it("should default to lite profile", () => {
      const result = loadSessionContext(shitennoDir);
      expect(result.profile).toBe("lite");
    });
  });

  describe("loadEssentialContext", () => {
    it("should load essential files", () => {
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
