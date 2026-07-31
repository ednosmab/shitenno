import { describe, it, expect } from "vitest";
import { withCache } from "../mcp-cache.js";
import { getCachedPlanInference } from "../inference-cache.js";
import { sendDesktopNotification } from "../notify.js";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Performance Benchmarks", () => {
  describe("MCP Cache Performance", () => {
    it("should demonstrate cache speedup", async () => {
      let computeCount = 0;
      const computeFn = async () => {
        computeCount++;
        // Simulate expensive computation
        await new Promise(resolve => setTimeout(resolve, 10));
        return { data: "result" };
      };
      
      // First call - should compute
      const start1 = Date.now();
      await withCache(computeFn, { key: "perf-test" });
      const duration1 = Date.now() - start1;
      
      // Second call - should use cache
      const start2 = Date.now();
      await withCache(computeFn, { key: "perf-test" });
      const duration2 = Date.now() - start2;
      
      expect(computeCount).toBe(1);
      expect(duration2).toBeLessThan(duration1);
    });
  });

  describe("Inference Cache Performance", () => {
    it("should demonstrate cache speedup", () => {
      let computeCount = 0;
      const computeFn = () => {
        computeCount++;
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
      
      const filePath = "/tmp/test-plan.md";
      
      // First call - should compute
      const start1 = Date.now();
      getCachedPlanInference("plan1", filePath, computeFn);
      const duration1 = Date.now() - start1;
      
      // Second call - should use cache
      const start2 = Date.now();
      getCachedPlanInference("plan1", filePath, computeFn);
      const duration2 = Date.now() - start2;
      
      expect(computeCount).toBe(1);
      expect(duration2).toBeLessThanOrEqual(duration1 + 2);
    });
  });

  describe("Notification Deduplication Performance", () => {
    it("should demonstrate deduplication speedup", () => {
      const testDir = join(tmpdir(), `notify-perf-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
      const shitennoDir = join(testDir, ".shitenno");
      mkdirSync(shitennoDir, { recursive: true });
      
      try {
        // First notification - should send
        const start1 = Date.now();
        sendDesktopNotification(shitennoDir, "Perf Test", "Message", "medium");
        const duration1 = Date.now() - start1;
        
        // Second notification - should be deduplicated
        const start2 = Date.now();
        sendDesktopNotification(shitennoDir, "Perf Test", "Message", "medium");
        const duration2 = Date.now() - start2;
        
        expect(duration2).toBeLessThan(duration1);
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });
  });
});
