import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { calculateComplexityScore, writeComplexityReport } from "../application/scorer.js";
import type { ProjectAnalysis } from "../infrastructure/analyser.js";

let tempDir: string;
let shitennoDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-scorer-"));
  shitennoDir = join(tempDir, "shitenno");
  mkdirSync(shitennoDir, { recursive: true });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function makeAnalysis(overrides: Partial<ProjectAnalysis> = {}): ProjectAnalysis {
  return {
    rootDir: tempDir,
    hasGit: false,
    hasPackageJson: false,
    hasShitenno: false,
    stack: [],
    packageManager: "unknown",
    monorepo: false,
    packageCount: 0,
    appCount: 0,
    dependencyCount: 0,
    sourceFileCount: 0,
    hasTests: false,
    hasLinter: false,
    hasCI: false,
    hasTypeScript: false,
    totalCommits: 0,
    flatSourceFiles: 0,
    layeredDirs: 0,
    nodeApiImportsOutsideLayers: 0,
    portsConsumed: false,
    boundedContextCoverage: 0,
    contextBoundaryViolations: 0,
    ...overrides,
  };
}

// ── calculateComplexityScore ─────────────────────────────────────────────────

describe("calculateComplexityScore", () => {
  it("returns junior level for empty project", async () => {
    const report = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis());
    expect(report.level).toBe("junior");
    expect(report.score).toBe(0);
    expect(report.staticMetrics.length).toBeGreaterThan(0);
    expect(report.behavioralMetrics).toHaveLength(0);
    expect(report.areaScores).toHaveLength(0);
  });

  it("returns pleno level for medium complexity", async () => {
    const analysis = makeAnalysis({
      packageCount: 4,
      appCount: 2,
      sourceFileCount: 200,
      dependencyCount: 80,
    });
    const report = await calculateComplexityScore(tempDir, shitennoDir, analysis);
    expect(report.score).toBeGreaterThanOrEqual(5);
    expect(report.level).toBe("pleno");
  });

  it("returns senior level for high complexity", async () => {
    mkdirSync(join(shitennoDir, "docs", "adrs"), { recursive: true });
    mkdirSync(join(shitennoDir, "docs", "history"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "adrs", "ADR-001.md"), "# ADR-001");
    writeFileSync(join(shitennoDir, "docs", "adrs", "ADR-002.md"), "# ADR-002");
    writeFileSync(join(shitennoDir, "docs", "adrs", "ADR-003.md"), "# ADR-003");

    const analysis = makeAnalysis({
      packageCount: 6,
      appCount: 3,
      sourceFileCount: 400,
      dependencyCount: 120,
      monorepo: true,
    });
    const report = await calculateComplexityScore(tempDir, shitennoDir, analysis);
    expect(report.score).toBeGreaterThanOrEqual(10);
    expect(report.level).toBe("senior");
  });

  it("includes computedAt timestamp", async () => {
    const report = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis());
    expect(report.computedAt).toBeTruthy();
    expect(new Date(report.computedAt).getTime()).toBeGreaterThan(0);
  });

  it("populates staticMetrics with evidence", async () => {
    const report = await calculateComplexityScore(
      tempDir,
      shitennoDir,
      makeAnalysis({ packageCount: 1 })
    );
    expect(report.staticMetrics.length).toBeGreaterThan(0);
    for (const m of report.staticMetrics) {
      expect(m.evidence).toBeTruthy();
    }
  });
});

// ── writeComplexityReport ────────────────────────────────────────────────────

describe("writeComplexityReport", () => {
  it("returns null when reports/ doesn't exist", async () => {
    const report = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis());
    const result = writeComplexityReport(tempDir, shitennoDir, report);
    expect(result).toBeNull();
  });

  it("writes JSON report when reports/ exists", async () => {
    mkdirSync(join(shitennoDir, "reports"), { recursive: true });
    const report = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis());
    const filename = writeComplexityReport(tempDir, shitennoDir, report);

    expect(filename).toBeTruthy();
    expect(filename).toMatch(/^complexity-.*\.json$/);

    // Verify the file was written
    const reports = readdirSync(join(shitennoDir, "reports")).filter((f: string) =>
      f.startsWith("complexity-")
    );
    expect(reports.length).toBe(1);
  });

  it("increments session number on multiple writes", async () => {
    mkdirSync(join(shitennoDir, "reports"), { recursive: true });
    const report = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis());

    const f1 = writeComplexityReport(tempDir, shitennoDir, report);
    const f2 = writeComplexityReport(tempDir, shitennoDir, report);

    expect(f1).toContain("session1");
    expect(f2).toContain("session2");
  });
});
