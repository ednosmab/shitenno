import { describe, it, expect } from "vitest";
import { recordHit, recordMiss, recordEviction, getCacheStats } from "../shared/cache-metrics.js";

describe("cache-metrics", () => {
  describe("recordHit", () => {
    it("should increment hit count", () => {
      recordHit("hit-cache");
      recordHit("hit-cache");
      
      const stats = getCacheStats("hit-cache");
      expect(stats.hits).toBe(2);
      expect(stats.totalRequests).toBe(2);
    });
  });

  describe("recordMiss", () => {
    it("should increment miss count", () => {
      recordMiss("miss-cache");
      recordMiss("miss-cache");
      
      const stats = getCacheStats("miss-cache");
      expect(stats.misses).toBe(2);
      expect(stats.totalRequests).toBe(2);
    });
  });

  describe("recordEviction", () => {
    it("should increment eviction count", () => {
      recordEviction("eviction-cache");
      recordEviction("eviction-cache");
      
      const stats = getCacheStats("eviction-cache");
      expect(stats.evictions).toBe(2);
    });
  });

  describe("getCacheStats", () => {
    it("should calculate hit rate correctly", () => {
      recordHit("rate-cache");
      recordHit("rate-cache");
      recordMiss("rate-cache");
      
      const stats = getCacheStats("rate-cache");
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
});
