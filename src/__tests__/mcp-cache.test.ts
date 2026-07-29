import { describe, it, expect, beforeEach } from "vitest";
import { withCache, invalidateCache, clearCache, getCacheStats } from "../mcp-cache.js";

describe("mcp-cache", () => {
  beforeEach(() => {
    clearCache();
  });

  describe("withCache", () => {
    it("should cache handler result", async () => {
      let callCount = 0;
      const handler = async () => {
        callCount++;
        return { data: "test" };
      };
      
      const result1 = await withCache(handler, { key: "test1" });
      const result2 = await withCache(handler, { key: "test1" });
      
      expect(result1).toEqual({ data: "test" });
      expect(result2).toEqual({ data: "test" });
      expect(callCount).toBe(1); // Handler called only once
    });

    it("should cache different keys separately", async () => {
      let callCount = 0;
      const handler = async () => {
        callCount++;
        return { data: "test" };
      };
      
      await withCache(handler, { key: "key1" });
      await withCache(handler, { key: "key2" });
      
      expect(callCount).toBe(2); // Handler called twice
    });

    it("should refresh cache when data changes", async () => {
      let callCount = 0;
      let data = "v1";
      const handler = async () => {
        callCount++;
        return { data };
      };
      
      const result1 = await withCache(handler, { key: "test", ttlMs: 100 });
      expect(result1).toEqual({ data: "v1" });
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      data = "v2";
      const result2 = await withCache(handler, { key: "test", ttlMs: 100 });
      expect(result2).toEqual({ data: "v2" });
      expect(callCount).toBe(2);
    });

    it("should respect TTL", async () => {
      let callCount = 0;
      const handler = async () => {
        callCount++;
        return { data: "test" };
      };
      
      await withCache(handler, { key: "test", ttlMs: 100 });
      expect(callCount).toBe(1);
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      await withCache(handler, { key: "test", ttlMs: 100 });
      expect(callCount).toBe(2); // Handler called again
    });
  });

  describe("invalidateCache", () => {
    it("should invalidate cache by exact pattern", async () => {
      const handler = async () => ({ data: "test" });
      
      await withCache(handler, { key: "test1" });
      await withCache(handler, { key: "test2" });
      
      expect(getCacheStats().size).toBe(2);
      
      const invalidated = invalidateCache("test1");
      expect(invalidated).toBe(1);
      expect(getCacheStats().size).toBe(1);
    });

    it("should invalidate cache by regex pattern", async () => {
      const handler = async () => ({ data: "test" });
      
      await withCache(handler, { key: "briefing:abc" });
      await withCache(handler, { key: "briefing:def" });
      await withCache(handler, { key: "risk:xyz" });
      
      expect(getCacheStats().size).toBe(3);
      
      const invalidated = invalidateCache(/^briefing:/);
      expect(invalidated).toBe(2);
      expect(getCacheStats().size).toBe(1);
    });
  });

  describe("clearCache", () => {
    it("should clear all cache entries", async () => {
      const handler = async () => ({ data: "test" });
      
      await withCache(handler, { key: "test1" });
      await withCache(handler, { key: "test2" });
      
      expect(getCacheStats().size).toBe(2);
      
      clearCache();
      expect(getCacheStats().size).toBe(0);
    });
  });

  describe("getCacheStats", () => {
    it("should return correct stats", async () => {
      const handler = async () => ({ data: "test" });
      
      await withCache(handler, { key: "test1" });
      await withCache(handler, { key: "test2" });
      
      const stats = getCacheStats();
      expect(stats.size).toBe(2);
    });
  });
});
