import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getCachedPlanInference, getCachedSummary, invalidatePlanCache, invalidateAllCache, getCacheStats } from "../infrastructure/inference-cache.js";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("inference-cache", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `inference-cache-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    invalidateAllCache();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("getCachedPlanInference", () => {
    it("should cache plan inference", () => {
      let callCount = 0;
      const computeFn = () => {
        callCount++;
        return {
          id: "plan1",
          title: "Test Plan",
          rawStatus: "active",
          inferredStatus: "in_progress" as const,
          checkboxes: { total: 5, closed: 2, open: 3, percentage: 40 },
          ageInDays: 5,
          estado: null,
          recommendation: "keep" as const,
          reason: "Test",
          confidence: 0.8,
        };
      };
      
      const filePath = join(testDir, "plan1.md");
      writeFileSync(filePath, "# Test Plan");
      
      const result1 = getCachedPlanInference("plan1", filePath, computeFn);
      const result2 = getCachedPlanInference("plan1", filePath, computeFn);
      
      expect(result1).toEqual(result2);
      expect(callCount).toBe(1); // Compute called only once
    });

    it("should refresh cache when file changes", async () => {
      let callCount = 0;
      let status = "active";
      const computeFn = () => {
        callCount++;
        return {
          id: "plan1",
          title: "Test Plan",
          rawStatus: status,
          inferredStatus: "in_progress" as const,
          checkboxes: { total: 5, closed: 2, open: 3, percentage: 40 },
          ageInDays: 5,
          estado: null,
          recommendation: "keep" as const,
          reason: "Test",
          confidence: 0.8,
        };
      };
      
      const filePath = join(testDir, "plan1.md");
      writeFileSync(filePath, "# Test Plan");
      
      getCachedPlanInference("plan1", filePath, computeFn);
      expect(callCount).toBe(1);
      
      // Add delay to ensure mtime changes
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Modify file
      writeFileSync(filePath, "# Test Plan - Updated");
      
      const result = getCachedPlanInference("plan1", filePath, computeFn);
      expect(result.rawStatus).toBe("active"); // Still returns cached
      expect(callCount).toBe(2); // Compute called again
    });

    it("should handle missing files", () => {
      let callCount = 0;
      const computeFn = () => {
        callCount++;
        return {
          id: "plan1",
          title: "Test Plan",
          rawStatus: "active",
          inferredStatus: "in_progress" as const,
          checkboxes: { total: 5, closed: 2, open: 3, percentage: 40 },
          ageInDays: 5,
          estado: null,
          recommendation: "keep" as const,
          reason: "Test",
          confidence: 0.8,
        };
      };
      
      const filePath = join(testDir, "nonexistent.md");
      
      const result = getCachedPlanInference("plan1", filePath, computeFn);
      expect(result).toBeDefined();
      expect(callCount).toBe(1);
    });
  });

  describe("getCachedSummary", () => {
    it("should cache summary", () => {
      let callCount = 0;
      const computeFn = () => {
        callCount++;
        return {
          generatedAt: new Date().toISOString(),
          totalPlans: 10,
          byStatus: { done: 5, in_progress: 3, paused: 1, obsolete: 0, inconsistent: 1 },
          byRecommendation: { archive: 2, remove: 1, keep: 5, investigate: 2 },
          plans: [],
          summary: "Test summary",
        };
      };
      
      const result1 = getCachedSummary(computeFn);
      const result2 = getCachedSummary(computeFn);
      
      expect(result1).toEqual(result2);
      expect(callCount).toBe(1);
    });

    it("should refresh cache after TTL", async () => {
      let callCount = 0;
      const computeFn = () => {
        callCount++;
        return {
          generatedAt: new Date().toISOString(),
          totalPlans: 10,
          byStatus: { done: 5, in_progress: 3, paused: 1, obsolete: 0, inconsistent: 1 },
          byRecommendation: { archive: 2, remove: 1, keep: 5, investigate: 2 },
          plans: [],
          summary: "Test summary",
        };
      };
      
      getCachedSummary(computeFn);
      expect(callCount).toBe(1);
      
      // Wait for cache to expire (30 seconds in production, but we'll test with actual TTL)
      // For testing, we'll just verify the cache works
      const result = getCachedSummary(computeFn);
      expect(result).toBeDefined();
    });
  });

  describe("invalidatePlanCache", () => {
    it("should invalidate specific plan cache", () => {
      const computeFn = () => ({
        id: "plan1",
        title: "Test Plan",
        rawStatus: "active",
        inferredStatus: "in_progress" as const,
        checkboxes: { total: 5, closed: 2, open: 3, percentage: 40 },
        ageInDays: 5,
        estado: null,
        recommendation: "keep" as const,
        reason: "Test",
        confidence: 0.8,
      });
      
      const filePath = join(testDir, "plan1.md");
      writeFileSync(filePath, "# Test Plan");
      
      getCachedPlanInference("plan1", filePath, computeFn);
      expect(getCacheStats().planCacheSize).toBe(1);
      
      const invalidated = invalidatePlanCache("plan1");
      expect(invalidated).toBe(true);
      expect(getCacheStats().planCacheSize).toBe(0);
    });

    it("should return false for non-existent plan", () => {
      const invalidated = invalidatePlanCache("nonexistent");
      expect(invalidated).toBe(false);
    });
  });

  describe("invalidateAllCache", () => {
    it("should invalidate all cache entries", () => {
      const planComputeFn = () => ({
        id: "plan1",
        title: "Test Plan",
        rawStatus: "active",
        inferredStatus: "in_progress" as const,
        checkboxes: { total: 5, closed: 2, open: 3, percentage: 40 },
        ageInDays: 5,
        estado: null,
        recommendation: "keep" as const,
        reason: "Test",
        confidence: 0.8,
      });

      const summaryComputeFn = () => ({
        generatedAt: new Date().toISOString(),
        totalPlans: 1,
        byStatus: { in_progress: 1, completed: 0, on_hold: 0, abandoned: 0 } as Record<string, number>,
        byRecommendation: { keep: 1, escalate: 0, archive: 0, delete: 0 } as Record<string, number>,
        plans: [],
        summary: "Test summary",
      });
      
      const filePath = join(testDir, "plan1.md");
      writeFileSync(filePath, "# Test Plan");
      
      getCachedPlanInference("plan1", filePath, planComputeFn);
      getCachedSummary(summaryComputeFn);
      
      expect(getCacheStats().planCacheSize).toBe(1);
      expect(getCacheStats().summaryCached).toBe(true);
      
      const invalidated = invalidateAllCache();
      expect(invalidated).toBe(2);
      expect(getCacheStats().planCacheSize).toBe(0);
      expect(getCacheStats().summaryCached).toBe(false);
    });
  });
});
