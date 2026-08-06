import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  walkSourceFiles,
  countSourceFilesInDir,
  FileContentCache,
  detectShitennoProject,
} from "../infrastructure/utils.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ── walkSourceFiles ──────────────────────────────────────────────────────────

describe("walkSourceFiles", () => {
  it("finds .ts and .js files recursively", () => {
    writeFileSync(join(tempDir, "a.ts"), "export const x = 1;");
    mkdirSync(join(tempDir, "sub"), { recursive: true });
    writeFileSync(join(tempDir, "sub", "b.js"), "console.log(1)");
    writeFileSync(join(tempDir, "c.txt"), "ignored");

    const found: string[] = [];
    walkSourceFiles(tempDir, (fullPath) => found.push(fullPath));

    expect(found).toHaveLength(2);
    expect(found.some((f) => f.endsWith("a.ts"))).toBe(true);
    expect(found.some((f) => f.endsWith("b.js"))).toBe(true);
  });

  it("skips node_modules and .git", () => {
    mkdirSync(join(tempDir, "node_modules", "pkg"), { recursive: true });
    writeFileSync(join(tempDir, "node_modules", "pkg", "index.ts"), "");
    mkdirSync(join(tempDir, ".git"), { recursive: true });
    writeFileSync(join(tempDir, ".git", "config.ts"), "");
    writeFileSync(join(tempDir, "app.ts"), "ok");

    const found: string[] = [];
    walkSourceFiles(tempDir, (fullPath) => found.push(fullPath));

    expect(found).toHaveLength(1);
    expect(found[0]).toContain("app.ts");
  });

  it("with includeAll: true also finds .json and .yaml", () => {
    writeFileSync(join(tempDir, "config.json"), "{}");
    writeFileSync(join(tempDir, "data.yaml"), "key: val");
    writeFileSync(join(tempDir, "code.ts"), "x");

    const found: string[] = [];
    walkSourceFiles(tempDir, (fullPath) => found.push(fullPath), {
      includeAll: true,
    });

    expect(found).toHaveLength(3);
  });

  it("returns 0 for non-existent directory", () => {
    let count = 0;
    walkSourceFiles("/nonexistent", () => count++);
    expect(count).toBe(0);
  });
});

// ── countSourceFilesInDir ────────────────────────────────────────────────────

describe("countSourceFilesInDir", () => {
  it("counts source files", () => {
    writeFileSync(join(tempDir, "a.ts"), "");
    writeFileSync(join(tempDir, "b.tsx"), "");
    mkdirSync(join(tempDir, "sub"), { recursive: true });
    writeFileSync(join(tempDir, "sub", "c.js"), "");

    expect(countSourceFilesInDir(tempDir)).toBe(3);
  });

  it("returns 0 for non-existent directory", () => {
    expect(countSourceFilesInDir("/nonexistent")).toBe(0);
  });

  it("returns 0 for empty directory", () => {
    expect(countSourceFilesInDir(tempDir)).toBe(0);
  });
});

// ── FileContentCache ─────────────────────────────────────────────────────────

describe("FileContentCache", () => {
  it("caches file content after first read", () => {
    const filePath = join(tempDir, "test.ts");
    writeFileSync(filePath, "hello world");

    const cache = new FileContentCache();
    const content1 = cache.get(filePath);
    expect(content1).toBe("hello world");
    expect(cache.size).toBe(1);

    // Second read should use cache
    const content2 = cache.get(filePath);
    expect(content2).toBe("hello world");
    expect(cache.size).toBe(1); // still 1, not 2
  });

  it("returns null for non-existent files", () => {
    const cache = new FileContentCache();
    expect(cache.get("/nonexistent/file.ts")).toBeNull();
    expect(cache.size).toBe(0);
  });
});

// ── detectShitennoProject ───────────────────────────────────────────────────────

describe("detectShitennoProject", () => {
  it("detects project with opencode.json", () => {
    writeFileSync(join(tempDir, "opencode.json"), "{}");

    const result = detectShitennoProject(tempDir);
    expect(result).not.toBeNull();
    expect(result!.root).toBe(tempDir);
    expect(result!.shitennoDir).toBe(join(tempDir, ".shitenno"));
  });

  it("detects project with .shitenno/ directory", () => {
    mkdirSync(join(tempDir, ".shitenno"), { recursive: true });

    const result = detectShitennoProject(tempDir);
    expect(result).not.toBeNull();
    expect(result!.root).toBe(tempDir);
  });

  it("walks up to find parent with opencode.json", () => {
    writeFileSync(join(tempDir, "opencode.json"), "{}");
    const child = join(tempDir, "sub", "deep");
    mkdirSync(child, { recursive: true });

    const result = detectShitennoProject(child);
    expect(result).not.toBeNull();
    expect(result!.root).toBe(tempDir);
  });

  it("returns null for non-shitenno directory", () => {
    const result = detectShitennoProject("/tmp");
    expect(result).toBeNull();
  });
});
