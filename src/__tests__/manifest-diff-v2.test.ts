import { describe, it, expect } from "vitest";
import {
  diffManifestsV2,
  type Manifest,
} from "../infrastructure/manifest.js";



// ── diffManifestsV2 ─────────────────────────────────────────────────────────

describe("diffManifestsV2", () => {
  const base: Manifest = {
    cliVersion: "1.0.0",
    installedAt: "2026-07-08T00:00:00Z",
    templateHashes: { a: "hash1", b: "hash2", c: "hash3" },
    installedHashes: { a: "hash1", b: "hash2", c: "hash3" },
    capabilities: [],
    maturityScore: 0,
  };

  it("detects added files", () => {
    const newM: Manifest = {
      ...base,
      templateHashes: { a: "hash1", b: "hash2", c: "hash3", d: "hash4" },
      installedHashes: { a: "hash1", b: "hash2", c: "hash3" },
    };
    const diff = diffManifestsV2(base, newM);
    expect(diff.added).toEqual(["d"]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
    expect(diff.conflict).toEqual([]);
  });

  it("detects removed files", () => {
    const newM: Manifest = {
      ...base,
      templateHashes: { a: "hash1", b: "hash2" },
      installedHashes: { a: "hash1", b: "hash2" },
    };
    const diff = diffManifestsV2(base, newM);
    expect(diff.removed).toEqual(["c"]);
    expect(diff.added).toEqual([]);
  });

  it("detects changed files (safe to update)", () => {
    const newM: Manifest = {
      ...base,
      templateHashes: { a: "hash1", b: "NEW_HASH", c: "hash3" },
      installedHashes: { a: "hash1", b: "hash2", c: "hash3" }, // installed not customized
    };
    const diff = diffManifestsV2(base, newM);
    expect(diff.changed).toEqual(["b"]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.conflict).toEqual([]);
  });

  it("detects conflict (template changed + locally customized)", () => {
    const newM: Manifest = {
      ...base,
      templateHashes: { a: "hash1", b: "NEW_HASH", c: "hash3" },
      installedHashes: { a: "hash1", b: "LOCAL_CUSTOM", c: "hash3" }, // local customized
    };
    const diff = diffManifestsV2(base, newM);
    expect(diff.conflict).toEqual(["b"]);
    expect(diff.changed).toEqual([]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it("detects unchanged files", () => {
    const newM: Manifest = { ...base };
    const diff = diffManifestsV2(base, newM);
    expect(diff.unchanged).toEqual(["a", "b", "c"]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
    expect(diff.conflict).toEqual([]);
  });

  it("handles missing installedHashes (uses templateHashes as fallback)", () => {
    const oldM: Manifest = {
      cliVersion: "1.0.0",
      installedAt: "2026-07-08T00:00:00Z",
      templateHashes: { a: "hash1", b: "hash2" },
      capabilities: [],
      maturityScore: 0,
    };
    const newM: Manifest = {
      ...oldM,
      templateHashes: { a: "hash1", b: "NEW_HASH" },
      installedHashes: { a: "hash1", b: "hash2" }, // not customized
    };
    const diff = diffManifestsV2(oldM, newM);
    expect(diff.changed).toEqual(["b"]);
    expect(diff.conflict).toEqual([]);
  });

  it("handles undefined installedHashes in newManifest (no conflict detected)", () => {
    const oldM: Manifest = {
      cliVersion: "1.0.0",
      installedAt: "2026-07-08T00:00:00Z",
      templateHashes: { a: "hash1", b: "hash2" },
      installedHashes: { a: "hash1", b: "hash2" },
      capabilities: [],
      maturityScore: 0,
    };
    const newM: Manifest = {
      ...oldM,
      templateHashes: { a: "hash1", b: "NEW_HASH" },
      // installedHashes is undefined
    };
    const diff = diffManifestsV2(oldM, newM);
    // Cannot detect customization without installedHashes, so treat as safe change
    expect(diff.changed).toEqual(["b"]);
    expect(diff.conflict).toEqual([]);
  });
});