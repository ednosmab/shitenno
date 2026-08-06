import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analyseProject } from "../infrastructure/analyser.js";
import { calculateComplexityScore } from "../application/scorer.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-edge-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Edge Cases", () => {
  it("handles empty project gracefully", () => {
    const analysis = analyseProject(tempDir);
    expect(analysis.sourceFileCount).toBe(0);
    expect(analysis.packageCount).toBe(0);
    expect(analysis.appCount).toBe(0);
    expect(analysis.dependencyCount).toBe(0);
    expect(analysis.stack).toEqual([]);
  });

  it("handles non-existent directory", () => {
    const analysis = analyseProject("/tmp/nonexistent-dir-12345");
    expect(analysis.sourceFileCount).toBe(0);
    expect(analysis.hasGit).toBe(false);
    expect(analysis.hasPackageJson).toBe(false);
  });

  it("handles project with no shitenno", async () => {
    const analysis = analyseProject(tempDir);
    const report = await calculateComplexityScore(
      tempDir,
      join(tempDir, "shitenno"),
      analysis
    );
    expect(report.score).toBe(0);
    expect(report.areaScores).toHaveLength(0);
    expect(report.level).toBe("junior");
  });

  it("handles project with 1000+ files within time limit", async () => {
    const bulkDir = join(tempDir, "src");
    mkdirSync(bulkDir, { recursive: true });

    for (let i = 0; i < 1200; i++) {
      writeFileSync(join(bulkDir, `file-${i}.ts`), `export const x${i} = ${i};`);
    }

    const analysis = analyseProject(tempDir);
    expect(analysis.sourceFileCount).toBeGreaterThanOrEqual(1200);

    const start = Date.now();
    const report = await calculateComplexityScore(
      tempDir,
      join(tempDir, "shitenno"),
      analysis
    );
    const elapsed = Date.now() - start;

    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(elapsed).toBeLessThan(10000);
  });

  it("handles project with deeply nested directories", () => {
    const deepDir = join(tempDir, "src", "a", "b", "c", "d", "e", "f");
    mkdirSync(deepDir, { recursive: true });
    writeFileSync(join(deepDir, "deep.ts"), "export const deep = true;");

    const analysis = analyseProject(tempDir);
    expect(analysis.sourceFileCount).toBe(1);
  });

  it("handles project with only config files", () => {
    writeFileSync(join(tempDir, "tsconfig.json"), "{}");
    writeFileSync(join(tempDir, ".eslintrc.js"), "module.exports = {}");
    writeFileSync(join(tempDir, "vitest.config.ts"), "export default {}");

    const analysis = analyseProject(tempDir);
    expect(analysis.hasTypeScript).toBe(true);
    expect(analysis.hasLinter).toBe(true);
    expect(analysis.sourceFileCount).toBeGreaterThanOrEqual(0);
  });

  it("handles monorepo detection correctly", () => {
    writeFileSync(join(tempDir, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'");

    const analysis = analyseProject(tempDir);
    expect(analysis.monorepo).toBe(true);
  });

  it("handles large dependency count", () => {
    const deps: Record<string, string> = {};
    for (let i = 0; i < 150; i++) {
      deps[`dep-${i}`] = "^1.0.0";
    }
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ dependencies: deps }, null, 2)
    );

    const analysis = analyseProject(tempDir);
    expect(analysis.dependencyCount).toBe(150);
  });
});
