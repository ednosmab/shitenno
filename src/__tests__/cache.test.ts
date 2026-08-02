import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { computeKeyChecksums, getCached, setCache, invalidateCache, ShitennoCache } from "../cache.js";

let tempDir: string;
let shitennoDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-cache-test-"));
  shitennoDir = join(tempDir, ".shitenno");
  mkdirSync(shitennoDir, { recursive: true });
  // Create a minimal package.json so computeKeyChecksums can hash it
  writeFileSync(join(tempDir, "package.json"), JSON.stringify({ name: "test" }));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ── computeKeyChecksums ─────────────────────────────────────────────────────

describe("computeKeyChecksums", () => {
  it("returns a checksums object with expected keys", () => {
    const checksums = computeKeyChecksums(tempDir, shitennoDir);
    expect(checksums).toHaveProperty(".shitenno/");
    expect(checksums).toHaveProperty("package.json");
  });

  it("returns 'missing' for non-existent shitenno/", () => {
    const missingDir = join(tempDir, "nonexistent");
    const checksums = computeKeyChecksums(tempDir, missingDir);
    expect(checksums[".shitenno/"]).toBe("missing");
  });

  it("returns consistent checksums for same content", () => {
    const c1 = computeKeyChecksums(tempDir, shitennoDir);
    const c2 = computeKeyChecksums(tempDir, shitennoDir);
    expect(c1).toEqual(c2);
  });

  it("changes checksum when shitenno/ content changes", () => {
    const c1 = computeKeyChecksums(tempDir, shitennoDir);
    writeFileSync(join(shitennoDir, "new-file.md"), "# New file");
    const c2 = computeKeyChecksums(tempDir, shitennoDir);
    expect(c1[".shitenno/"]).not.toBe(c2[".shitenno/"]);
  });
});

// ── setCache / getCached ────────────────────────────────────────────────────

describe("setCache and getCached", () => {
  it("stores and retrieves a cache entry", () => {
    const checksums = computeKeyChecksums(tempDir, shitennoDir);
    const data = { score: 85, level: "pleno" };

    setCache({ projectRoot: tempDir, shitennoDir: shitennoDir, key: "complexity", data, checksums });
    const result = getCached<typeof data>({ projectRoot: tempDir, key: "complexity", computeChecksumsFn: () =>
      computeKeyChecksums(tempDir, shitennoDir)
    });

    expect(result).toEqual(data);
  });

  it("returns null on cache miss (no cache file)", () => {
    const result = getCached({ projectRoot: tempDir, key: "complexity", computeChecksumsFn: () =>
      computeKeyChecksums(tempDir, shitennoDir)
    });
    expect(result).toBeNull();
  });

  it("returns null when checksums changed", () => {
    const checksums = computeKeyChecksums(tempDir, shitennoDir);
    setCache({ projectRoot: tempDir, shitennoDir: shitennoDir, key: "complexity", data: { score: 85 }, checksums });

    // Change the shitenno/ content
    writeFileSync(join(shitennoDir, "changed.md"), "changed");

    const result = getCached({ projectRoot: tempDir, key: "complexity", computeChecksumsFn: () =>
      computeKeyChecksums(tempDir, shitennoDir)
    });
    expect(result).toBeNull();
  });

  it("returns null for different cache key", () => {
    const checksums = computeKeyChecksums(tempDir, shitennoDir);
    setCache({ projectRoot: tempDir, shitennoDir: shitennoDir, key: "complexity", data: { score: 85 }, checksums });

    const result = getCached({ projectRoot: tempDir, key: "health", computeChecksumsFn: () =>
      computeKeyChecksums(tempDir, shitennoDir)
    });
    expect(result).toBeNull();
  });

  it("overwrites existing entry for same key", () => {
    const checksums = computeKeyChecksums(tempDir, shitennoDir);
    setCache({ projectRoot: tempDir, shitennoDir: shitennoDir, key: "complexity", data: { score: 50 }, checksums });
    setCache({ projectRoot: tempDir, shitennoDir: shitennoDir, key: "complexity", data: { score: 90 }, checksums });

    const result = getCached({ projectRoot: tempDir, key: "complexity", computeChecksumsFn: () =>
      computeKeyChecksums(tempDir, shitennoDir)
    });
    expect(result).toEqual({ score: 90 });
  });

  it("stores multiple keys independently", () => {
    const checksums = computeKeyChecksums(tempDir, shitennoDir);
    setCache({ projectRoot: tempDir, shitennoDir: shitennoDir, key: "complexity", data: { score: 85 }, checksums });
    setCache({ projectRoot: tempDir, shitennoDir: shitennoDir, key: "patterns", data: { patterns: [] }, checksums });
    setCache({ projectRoot: tempDir, shitennoDir: shitennoDir, key: "health", data: { healthScore: 90 }, checksums });

    expect(getCached({ projectRoot: tempDir, key: "complexity", computeChecksumsFn: () => computeKeyChecksums(tempDir, shitennoDir) })).toEqual({ score: 85 });
    expect(getCached({ projectRoot: tempDir, key: "patterns", computeChecksumsFn: () => computeKeyChecksums(tempDir, shitennoDir) })).toEqual({ patterns: [] });
    expect(getCached({ projectRoot: tempDir, key: "health", computeChecksumsFn: () => computeKeyChecksums(tempDir, shitennoDir) })).toEqual({ healthScore: 90 });
  });

  it("writes a valid cache file to disk", () => {
    const checksums = computeKeyChecksums(tempDir, shitennoDir);
    setCache({ projectRoot: tempDir, shitennoDir: shitennoDir, key: "complexity", data: { score: 85 }, checksums });

    const cachePath = join(tempDir, ".shitenno-cache.json");
    expect(existsSync(cachePath)).toBe(true);

    const raw = JSON.parse(readFileSync(cachePath, "utf-8")) as ShitennoCache;
    expect(raw.version).toBe(1);
    expect(raw.complexity).toBeDefined();
  });
});

// ── invalidateCache ─────────────────────────────────────────────────────────

describe("invalidateCache", () => {
  it("removes entire cache file when no key specified", () => {
    const checksums = computeKeyChecksums(tempDir, shitennoDir);
    setCache({ projectRoot: tempDir, shitennoDir: shitennoDir, key: "complexity", data: { score: 85 }, checksums });
    expect(existsSync(join(tempDir, ".shitenno-cache.json"))).toBe(true);

    invalidateCache({ projectRoot: tempDir });
    expect(existsSync(join(tempDir, ".shitenno-cache.json"))).toBe(false);
  });

  it("removes only the specified key", () => {
    const checksums = computeKeyChecksums(tempDir, shitennoDir);
    setCache({ projectRoot: tempDir, shitennoDir: shitennoDir, key: "complexity", data: { score: 85 }, checksums });
    setCache({ projectRoot: tempDir, shitennoDir: shitennoDir, key: "health", data: { score: 90 }, checksums });

    invalidateCache({ projectRoot: tempDir, key: "complexity" });

    expect(getCached({ projectRoot: tempDir, key: "complexity", computeChecksumsFn: () => computeKeyChecksums(tempDir, shitennoDir) })).toBeNull();
    expect(getCached({ projectRoot: tempDir, key: "health", computeChecksumsFn: () => computeKeyChecksums(tempDir, shitennoDir) })).toEqual({ score: 90 });
  });

  it("does nothing when no cache exists", () => {
    // Should not throw
    invalidateCache({ projectRoot: tempDir });
    expect(existsSync(join(tempDir, ".shitenno-cache.json"))).toBe(false);
  });

  it("does nothing when key does not exist in cache", () => {
    const checksums = computeKeyChecksums(tempDir, shitennoDir);
    setCache({ projectRoot: tempDir, shitennoDir: shitennoDir, key: "complexity", data: { score: 85 }, checksums });

    // Invalidate a key that was never set
    invalidateCache({ projectRoot: tempDir, key: "health" });

    // Complexity should still be there
    expect(getCached({ projectRoot: tempDir, key: "complexity", computeChecksumsFn: () => computeKeyChecksums(tempDir, shitennoDir) })).toEqual({ score: 85 });
  });
});

// ── Corrupted cache ─────────────────────────────────────────────────────────

describe("corrupted cache handling", () => {
  it("returns null for corrupted JSON", () => {
    writeFileSync(join(tempDir, ".shitenno-cache.json"), "not valid json {{{");
    const result = getCached({ projectRoot: tempDir, key: "complexity", computeChecksumsFn: () =>
      computeKeyChecksums(tempDir, shitennoDir)
    });
    expect(result).toBeNull();
  });

  it("returns null for wrong version", () => {
    writeFileSync(
      join(tempDir, ".shitenno-cache.json"),
      JSON.stringify({ version: 99, projectRoot: tempDir })
    );
    const result = getCached({ projectRoot: tempDir, key: "complexity", computeChecksumsFn: () =>
      computeKeyChecksums(tempDir, shitennoDir)
    });
    expect(result).toBeNull();
  });
});
