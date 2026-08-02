import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import {
  computeFileHash,
  readManifest,
  writeManifest,
  scanTemplateHashes,
  createManifest,
  diffManifests,
  updateManifest,
  type Manifest,
} from "../manifest.js";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  readdirSync: vi.fn(),
}));

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockReaddirSync = vi.mocked(readdirSync);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── computeFileHash ────────────────────────────────────────────────────────

describe("computeFileHash", () => {
  it("returns consistent hash for same content", () => {
    expect(computeFileHash("hello")).toBe(computeFileHash("hello"));
  });

  it("returns different hash for different content", () => {
    expect(computeFileHash("hello")).not.toBe(computeFileHash("world"));
  });

  it("returns 16 hex characters", () => {
    expect(computeFileHash("test")).toMatch(/^[0-9a-f]{16}$/);
  });
});

// ── readManifest ───────────────────────────────────────────────────────────

describe("readManifest", () => {
  it("reads valid manifest", () => {
    const manifest: Manifest = {
      cliVersion: "1.0.0",
      installedAt: "2026-07-08T00:00:00Z",
      templateHashes: { "file.txt": "abc123" },
      capabilities: ["core"],
      maturityScore: 75,
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest));

    expect(readManifest("/shugo")).toEqual(manifest);
  });

  it("returns null when file does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    expect(readManifest("/shugo")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("not json");
    expect(readManifest("/shugo")).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ cliVersion: "1.0.0" }));
    expect(readManifest("/shugo")).toBeNull();
  });
});

// ── writeManifest ──────────────────────────────────────────────────────────

describe("writeManifest", () => {
  it("writes manifest to manifest.json", () => {
    const manifest: Manifest = {
      cliVersion: "1.0.0",
      installedAt: "2026-07-08T00:00:00Z",
      templateHashes: {},
      capabilities: [],
      maturityScore: 0,
    };

    writeManifest("/shugo", manifest);

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      "/shugo/manifest.json",
      JSON.stringify(manifest, null, 2),
      "utf-8"
    );
  });
});

// ── diffManifests ──────────────────────────────────────────────────────────

describe("diffManifests", () => {
  const base: Manifest = {
    cliVersion: "1.0.0",
    installedAt: "2026-07-08T00:00:00Z",
    templateHashes: { a: "hash1", b: "hash2", c: "hash3" },
    capabilities: [],
    maturityScore: 0,
  };

  it("detects added files", () => {
    const newM: Manifest = {
      ...base,
      templateHashes: { a: "hash1", b: "hash2", c: "hash3", d: "hash4" },
    };
    const diff = diffManifests(base, newM);
    expect(diff.added).toEqual(["d"]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
  });

  it("detects removed files", () => {
    const newM: Manifest = {
      ...base,
      templateHashes: { a: "hash1", b: "hash2" },
    };
    const diff = diffManifests(base, newM);
    expect(diff.removed).toEqual(["c"]);
    expect(diff.added).toEqual([]);
  });

  it("detects changed files", () => {
    const newM: Manifest = {
      ...base,
      templateHashes: { a: "hash1", b: "NEW_HASH", c: "hash3" },
    };
    const diff = diffManifests(base, newM);
    expect(diff.changed).toEqual(["b"]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it("detects unchanged files", () => {
    const newM: Manifest = { ...base };
    const diff = diffManifests(base, newM);
    expect(diff.unchanged).toEqual(["a", "b", "c"]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
  });
});

// ── scanTemplateHashes ─────────────────────────────────────────────────────

describe("scanTemplateHashes", () => {
  it("returns empty object for empty directory", () => {
    mockReaddirSync.mockReturnValue([]);
    expect(scanTemplateHashes("/shugo")).toEqual({});
  });

  it("skips node_modules and .git", () => {
    mockReaddirSync.mockImplementation((dir: any) => {
      if (dir === "/shugo") {
        return [
          { name: "node_modules", isDirectory: () => true, isFile: () => false } as any,
          { name: ".git", isDirectory: () => true, isFile: () => false } as any,
          { name: "file.txt", isDirectory: () => false, isFile: () => true } as any,
        ];
      }
      return [];
    });
    mockReadFileSync.mockReturnValue("content");

    const hashes = scanTemplateHashes("/shugo");
    expect(hashes).toHaveProperty("file.txt");
    expect(Object.keys(hashes)).toHaveLength(1);
  });
});

// ── createManifest ─────────────────────────────────────────────────────────

describe("createManifest", () => {
  it("creates manifest with correct fields", () => {
    mockReaddirSync.mockReturnValue([]);
    const manifest = createManifest("1.2.3", "/shugo", ["core", "ai"], 80);

    expect(manifest.cliVersion).toBe("1.2.3");
    expect(manifest.capabilities).toEqual(["core", "ai"]);
    expect(manifest.maturityScore).toBe(80);
    expect(manifest.installedAt).toBeDefined();
    expect(manifest.templateHashes).toEqual({});
  });
});

// ── updateManifest ─────────────────────────────────────────────────────────

describe("updateManifest", () => {
  it("creates new manifest when no current exists", () => {
    mockReaddirSync.mockReturnValue([]);
    const manifest = updateManifest(null, { cliVersion: "2.0.0", shitennoDir: "/shugo", capabilities: ["core"], maturityScore: 70 });
    expect(manifest.cliVersion).toBe("2.0.0");
  });

  it("merges hashes from current manifest", () => {
    const current: Manifest = {
      cliVersion: "1.0.0",
      installedAt: "2026-07-08T00:00:00Z",
      templateHashes: { "old.txt": "hash1" },
      capabilities: ["core"],
      maturityScore: 60,
    };

    mockReaddirSync.mockReturnValue([
      { name: "new.txt", isDirectory: () => false, isFile: () => true } as any,
    ]);
    mockReadFileSync.mockReturnValue("new content");

    const updated = updateManifest(current, { cliVersion: "2.0.0", shitennoDir: "/shugo", capabilities: ["core", "ai"], maturityScore: 75 });

    expect(updated.cliVersion).toBe("2.0.0");
    expect(updated.templateHashes).toHaveProperty("old.txt", "hash1");
    expect(updated.templateHashes).toHaveProperty("new.txt");
    expect(updated.capabilities).toEqual(["core", "ai"]);
  });
});
