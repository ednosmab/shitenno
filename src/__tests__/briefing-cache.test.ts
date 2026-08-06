import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isCacheValid, computeInputHash, setCachedBriefing, readCache } from "../infrastructure/briefing-cache.js";
import type { CacheEntry } from "../infrastructure/briefing-cache.js";

describe("briefing-cache", () => {
  describe("computeInputHash", () => {
    it("returns a string hash", () => {
      const hash = computeInputHash({
        fingerprintHash: "abc123",
        riskMapHash: "2024-01-01",
        contextRuleCount: 5,
        dynamicRuleCount: 2,
        maturityScore: 65,
      });
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(16);
    });

    it("returns same hash for same inputs", () => {
      const inputs = {
        fingerprintHash: "abc123",
        riskMapHash: "2024-01-01",
        contextRuleCount: 5,
        dynamicRuleCount: 2,
        maturityScore: 65,
      };
      const hash1 = computeInputHash(inputs);
      const hash2 = computeInputHash(inputs);
      expect(hash1).toBe(hash2);
    });

    it("returns different hash for different inputs", () => {
      const hash1 = computeInputHash({
        fingerprintHash: "abc123",
        riskMapHash: "2024-01-01",
        contextRuleCount: 5,
        dynamicRuleCount: 2,
        maturityScore: 65,
      });
      const hash2 = computeInputHash({
        fingerprintHash: "xyz789",
        riskMapHash: "2024-01-01",
        contextRuleCount: 5,
        dynamicRuleCount: 2,
        maturityScore: 65,
      });
      expect(hash1).not.toBe(hash2);
    });

    it("returns different hash when maturityScore changes", () => {
      const hash1 = computeInputHash({
        fingerprintHash: "abc123",
        riskMapHash: "2024-01-01",
        contextRuleCount: 5,
        dynamicRuleCount: 2,
        maturityScore: 65,
      });
      const hash2 = computeInputHash({
        fingerprintHash: "abc123",
        riskMapHash: "2024-01-01",
        contextRuleCount: 5,
        dynamicRuleCount: 2,
        maturityScore: 70,
      });
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("isCacheValid", () => {
    it("returns true when hashes match", () => {
      const entry: CacheEntry = {
        inputHash: "abc123",
        computedAt: "2024-01-01T00:00:00Z",
        briefing: {} as never,
      };
      expect(isCacheValid(entry, "abc123")).toBe(true);
    });

    it("returns false when hashes don't match", () => {
      const entry: CacheEntry = {
        inputHash: "abc123",
        computedAt: "2024-01-01T00:00:00Z",
        briefing: {} as never,
      };
      expect(isCacheValid(entry, "xyz789")).toBe(false);
    });

    it("returns false for empty hash", () => {
      const entry: CacheEntry = {
        inputHash: "abc123",
        computedAt: "2024-01-01T00:00:00Z",
        briefing: {} as never,
      };
      expect(isCacheValid(entry, "")).toBe(false);
    });
  });

  describe("setCachedBriefing round-trip", () => {
    it("writes a cache entry that readCache can read back", () => {
      const shitennoDir = mkdtempSync(join(tmpdir(), "shitenno-cache-test-"));
      const briefing = {
        generatedAt: "2026-08-05T00:00:00.000Z",
        project: { domain: "test", scale: "small", stack: ["typescript"], maturityScore: 50 },
      } as never;

      setCachedBriefing(shitennoDir, briefing, "hash-rt");

      const cache = readCache(shitennoDir);
      expect(cache?.entry?.inputHash).toBe("hash-rt");
      expect(cache?.entry?.computedAt).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
    });
  });
});
