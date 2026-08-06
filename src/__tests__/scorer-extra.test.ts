import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { calculateComplexityScore, writeComplexityReport } from "../application/scorer.js";
import type { ProjectAnalysis } from "../infrastructure/analyser.js";

let tempDir: string;
let shitennoDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-scorer-"));
  shitennoDir = join(tempDir, ".shitenno");
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

  // ── Static Metrics Coverage ──────────────────────────────────────────────

  it("counts packages at different thresholds", async () => {
    const report0 = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis({ packageCount: 0 }));
    const pkg0 = report0.staticMetrics.find((m) => m.metric === "packages");
    expect(pkg0?.score).toBe(0);

    const report3 = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis({ packageCount: 3 }));
    const pkg3 = report3.staticMetrics.find((m) => m.metric === "packages");
    expect(pkg3?.score).toBe(1);

    const report6 = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis({ packageCount: 6 }));
    const pkg6 = report6.staticMetrics.find((m) => m.metric === "packages");
    expect(pkg6?.score).toBe(2);
  });

  it("counts apps at different thresholds", async () => {
    const report0 = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis({ appCount: 0 }));
    const app0 = report0.staticMetrics.find((m) => m.metric === "apps");
    expect(app0?.score).toBe(0);

    const report2 = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis({ appCount: 2 }));
    const app2 = report2.staticMetrics.find((m) => m.metric === "apps");
    expect(app2?.score).toBe(2);

    const report4 = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis({ appCount: 4 }));
    const app4 = report4.staticMetrics.find((m) => m.metric === "apps");
    expect(app4?.score).toBe(3);
  });

  it("counts source files at different thresholds", async () => {
    const report0 = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis({ sourceFileCount: 0 }));
    const files0 = report0.staticMetrics.find((m) => m.metric === "files");
    expect(files0?.score).toBe(0);

    const report150 = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis({ sourceFileCount: 150 }));
    const files150 = report150.staticMetrics.find((m) => m.metric === "files");
    expect(files150?.score).toBe(1);

    const report300 = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis({ sourceFileCount: 300 }));
    const files300 = report300.staticMetrics.find((m) => m.metric === "files");
    expect(files300?.score).toBe(2);
  });

  it("counts dependencies at different thresholds", async () => {
    const report0 = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis({ dependencyCount: 0 }));
    const deps0 = report0.staticMetrics.find((m) => m.metric === "dependencies");
    expect(deps0?.score).toBe(0);

    const report50 = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis({ dependencyCount: 50 }));
    const deps50 = report50.staticMetrics.find((m) => m.metric === "dependencies");
    expect(deps50?.score).toBe(1);

    const report100 = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis({ dependencyCount: 100 }));
    const deps100 = report100.staticMetrics.find((m) => m.metric === "dependencies");
    expect(deps100?.score).toBe(2);
  });

  it("detects monorepo", async () => {
    const report = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis({ monorepo: true }));
    const mono = report.staticMetrics.find((m) => m.metric === "monorepo");
    expect(mono).toBeDefined();
    expect(mono?.score).toBe(1);
  });

  // ── Behavioral Metrics Coverage ──────────────────────────────────────────

  it("detects validate failures in history", async () => {
    const historyDir = join(shitennoDir, "docs", "history");
    mkdirSync(historyDir, { recursive: true });
    writeFileSync(join(historyDir, "session-001.md"), "# Session 001\nVALIDATE failed");
    writeFileSync(join(historyDir, "session-002.md"), "# Session 002\nVALIDATE failed");
    writeFileSync(join(historyDir, "session-003.md"), "# Session 003\nVALIDATE failed");

    const report = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis());
    const vf = report.behavioralMetrics.find((m) => m.signal === "validate-failures");
    expect(vf).toBeDefined();
    expect(vf?.score).toBe(3);
    expect(vf?.suggestion).toContain("upgrade");
  });

  it("detects single validate failure", async () => {
    const historyDir = join(shitennoDir, "docs", "history");
    mkdirSync(historyDir, { recursive: true });
    writeFileSync(join(historyDir, "session-001.md"), "# Session 001\nVALIDATE failed");

    const report = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis());
    const vf = report.behavioralMetrics.find((m) => m.signal === "validate-failures");
    expect(vf).toBeDefined();
    expect(vf?.score).toBe(1);
  });

  it("detects ADR count thresholds", async () => {
    const adrDir = join(shitennoDir, "docs", "adrs");
    mkdirSync(adrDir, { recursive: true });
    writeFileSync(join(adrDir, "ADR-001.md"), "# ADR-001");
    writeFileSync(join(adrDir, "ADR-002.md"), "# ADR-002");
    writeFileSync(join(adrDir, "ADR-003.md"), "# ADR-003");

    const report = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis());
    const adr = report.behavioralMetrics.find((m) => m.signal === "adr-count");
    expect(adr).toBeDefined();
    expect(adr?.score).toBe(3);
    expect(adr?.suggestion).toContain("governance/agents");
  });

  it("detects single ADR", async () => {
    const adrDir = join(shitennoDir, "docs", "adrs");
    mkdirSync(adrDir, { recursive: true });
    writeFileSync(join(adrDir, "ADR-001.md"), "# ADR-001");

    const report = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis());
    const adr = report.behavioralMetrics.find((m) => m.signal === "adr-count");
    expect(adr).toBeDefined();
    expect(adr?.score).toBe(2);
  });

  it("detects unclosed sessions", async () => {
    const ctxDir = join(shitennoDir, "governance", "context");
    mkdirSync(ctxDir, { recursive: true });
    writeFileSync(join(ctxDir, "context_buffer.yaml"), 'status: "in_progress"');

    const report = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis());
    const swc = report.behavioralMetrics.find((m) => m.signal === "sessions-without-close");
    expect(swc).toBeDefined();
    expect(swc?.score).toBeGreaterThanOrEqual(1);
  });

  it("detects agents in opencode.json", async () => {
    writeFileSync(join(tempDir, "opencode.json"), JSON.stringify({
      agent: { planner: {}, executor: {}, reviewer: {}, analyst: {} },
    }));

    const report = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis());
    const ac = report.behavioralMetrics.find((m) => m.signal === "agent-count");
    expect(ac).toBeDefined();
    expect(ac?.score).toBe(2);
  });

  it("detects skills", async () => {
    const skillsDir = join(shitennoDir, "docs", "skills");
    mkdirSync(skillsDir, { recursive: true });
    for (let i = 0; i < 6; i++) {
      writeFileSync(join(skillsDir, `skill-${i}.md`), `# Skill ${i}`);
    }

    const report = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis());
    const sc = report.behavioralMetrics.find((m) => m.signal === "skill-count");
    expect(sc).toBeDefined();
    expect(sc?.score).toBe(1);
  });

  // ── Scoring Logic ──────────────────────────────────────────────────────

  it("generates reasons from positive scores", async () => {
    const historyDir = join(shitennoDir, "docs", "history");
    mkdirSync(historyDir, { recursive: true });
    writeFileSync(join(historyDir, "session-001.md"), "# Session\nVALIDATE failed");
    writeFileSync(join(historyDir, "session-002.md"), "# Session\nVALIDATE failed");
    writeFileSync(join(historyDir, "session-003.md"), "# Session\nVALIDATE failed");

    const report = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis());
    expect(report.reasons.length).toBeGreaterThan(0);
  });

  it("generates suggestions from behavioral metrics", async () => {
    const adrDir = join(shitennoDir, "docs", "adrs");
    mkdirSync(adrDir, { recursive: true });
    writeFileSync(join(adrDir, "ADR-001.md"), "# ADR-001");
    writeFileSync(join(adrDir, "ADR-002.md"), "# ADR-002");
    writeFileSync(join(adrDir, "ADR-003.md"), "# ADR-003");

    const report = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis());
    expect(report.suggestions.length).toBeGreaterThan(0);
  });

  it("adds upgrade suggestion for pleno level", async () => {
    const analysis = makeAnalysis({
      packageCount: 4,
      appCount: 2,
      sourceFileCount: 200,
      dependencyCount: 80,
    });
    const report = await calculateComplexityScore(tempDir, shitennoDir, analysis);
    expect(report.level).toBe("pleno");
    expect(report.suggestions.some((s) => s.includes("upgrade"))).toBe(true);
  });

  it("adds upgrade suggestion for senior level", async () => {
    mkdirSync(join(shitennoDir, "docs", "adrs"), { recursive: true });
    for (let i = 0; i < 5; i++) {
      writeFileSync(join(shitennoDir, "docs", "adrs", `ADR-${i}.md`), `# ADR-${i}`);
    }

    const analysis = makeAnalysis({
      packageCount: 8,
      appCount: 4,
      sourceFileCount: 500,
      dependencyCount: 200,
      monorepo: true,
    });
    const report = await calculateComplexityScore(tempDir, shitennoDir, analysis);
    expect(report.level).toBe("senior");
    expect(report.suggestions.some((s) => s.includes("upgrade"))).toBe(true);
  });

  // ── Area Scoring (with shitenno/profile) ──────────────────────────────

  it("calculates area scores when shitenno/profile exists", async () => {
    const profileDir = join(tempDir, ".shitenno", "profile");
    mkdirSync(profileDir, { recursive: true });
    writeFileSync(
      join(profileDir, "project.config.ts"),
      `export default {
        projectName: "test",
        areas: ["src"],
        sensitiveKeywords: ["auth"],
        churnWindowDays: 90,
      }`
    );

    // Create src/ area with some files
    mkdirSync(join(tempDir, "src"), { recursive: true });
    writeFileSync(join(tempDir, "src", "index.ts"), 'console.log("hello");');

    const report = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis());
    expect(report.areaScores.length).toBeGreaterThan(0);
    expect(report.areaScores[0]?.area).toBe("src");
  });

  it("returns empty areaScores without shitenno/profile", async () => {
    const report = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis());
    expect(report.areaScores).toHaveLength(0);
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

  it("writes report with all required fields", async () => {
    mkdirSync(join(shitennoDir, "reports"), { recursive: true });
    const report = await calculateComplexityScore(tempDir, shitennoDir, makeAnalysis());
    const filename = writeComplexityReport(tempDir, shitennoDir, report);

    const filePath = join(shitennoDir, "reports", filename!);
    const content = JSON.parse(readFileSync(filePath, "utf-8"));

    expect(content).toHaveProperty("projectName");
    expect(content).toHaveProperty("computedAt");
    expect(content).toHaveProperty("score");
    expect(content).toHaveProperty("level");
    expect(content).toHaveProperty("staticScore");
    expect(content).toHaveProperty("behaviorScore");
    expect(content).toHaveProperty("staticMetrics");
    expect(content).toHaveProperty("behavioralMetrics");
    expect(content).toHaveProperty("areaScores");
    expect(content).toHaveProperty("reasons");
    expect(content).toHaveProperty("suggestions");
  });
});

