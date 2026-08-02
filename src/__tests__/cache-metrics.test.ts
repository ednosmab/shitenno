import { describe, it, expect, beforeEach } from "vitest";
import { recordHit, recordMiss, recordEviction, getCacheStats, getAllCacheStats, resetMetrics, resetAllMetrics, getPerformanceReport } from "../cache-metrics.js";

describe("cache-metrics", () => {
  beforeEach(() => {
    resetAllMetrics();
  });

  describe("recordHit", () => {
    it("should increment hit count", () => {
      recordHit("test-cache");
      recordHit("test-cache");
      
      const stats = getCacheStats("test-cache");
      expect(stats.hits).toBe(2);
      expect(stats.totalRequests).toBe(2);
    });
  });

  describe("recordMiss", () => {
    it("should increment miss count", () => {
      recordMiss("test-cache");
      recordMiss("test-cache");
      
      const stats = getCacheStats("test-cache");
      expect(stats.misses).toBe(2);
      expect(stats.totalRequests).toBe(2);
    });
  });

  describe("recordEviction", () => {
    it("should increment eviction count", () => {
      recordEviction("test-cache");
      recordEviction("test-cache");
      
      const stats = getCacheStats("test-cache");
      expect(stats.evictions).toBe(2);
    });
  });

  describe("getCacheStats", () => {
    it("should calculate hit rate correctly", () => {
      recordHit("test-cache");
      recordHit("test-cache");
      recordMiss("test-cache");
      
      const stats = getCacheStats("test-cache");
      expect(stats.hitRate).toBeCloseTo(0.6667, 4);
      expect(stats.missRate).toBeCloseTo(0.3333, 4);
    });

    it("should return zero stats for unknown cache", () => {
      const stats = getCacheStats("unknown-cache");
      expect(stats.hitRate).toBe(0);
      expect(stats.missRate).toBe(0);
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe("getAllCacheStats", () => {
    it("should return stats for all caches", () => {
      recordHit("cache1");
      recordMiss("cache2");
      
      const allStats = getAllCacheStats();
      expect(Object.keys(allStats)).toContain("cache1");
      expect(Object.keys(allStats)).toContain("cache2");
    });
  });

  describe("resetMetrics", () => {
    it("should reset metrics for specific cache", () => {
      recordHit("test-cache");
      recordHit("test-cache");
      
      resetMetrics("test-cache");
      
      const stats = getCacheStats("test-cache");
      expect(stats.hits).toBe(0);
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe("resetAllMetrics", () => {
    it("should reset all metrics", () => {
      recordHit("cache1");
      recordMiss("cache2");
      
      resetAllMetrics();
      
      const allStats = getAllCacheStats();
      expect(Object.keys(allStats)).toHaveLength(0);
    });
  });

  describe("getPerformanceReport", () => {
    it("should generate performance report", () => {
      recordHit("test-cache");
      recordHit("test-cache");
      recordMiss("test-cache");
      
      const report = getPerformanceReport();
      expect(report).toContain("Cache Performance Report:");
      expect(report).toContain("test-cache:");
      expect(report).toContain("Hit Rate: 66.7%");
      expect(report).toContain("Total Requests: 3");
    });

    it("should return empty report when no caches", () => {
      const report = getPerformanceReport();
      expect(report).toContain("Cache Performance Report:");
      expect(report).not.toContain("Hit Rate:");
    });
  });
});
