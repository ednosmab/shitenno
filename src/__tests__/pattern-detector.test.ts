import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectPatterns, writePatternReport } from "../pattern-detector.js";

let tempDir: string;
let shitennoDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-pattern-"));
  shitennoDir = join(tempDir, "shitenno");
  mkdirSync(join(shitennoDir, "docs", "history"), { recursive: true });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("detectPatterns", () => {
  it("returns empty results for empty history", () => {
    const report = detectPatterns(tempDir, shitennoDir);
    expect(report.historyEntriesAnalyzed).toBe(0);
    expect(report.reportsAnalyzed).toBe(0);
    expect(report.patterns).toHaveLength(0);
    expect(report.candidateRules).toHaveLength(0);
  });

  it("detects recurring errors when 3+ history entries have violations in same area", () => {
    writeFileSync(
      join(shitennoDir, "docs", "history", "2025-06-20-sessao-1.md"),
      "# Session 1\nThe bug in src/services was fixed."
    );
    writeFileSync(
      join(shitennoDir, "docs", "history", "2025-06-21-sessao-1.md"),
      "# Session 2\nAnother erro in src/services area."
    );
    writeFileSync(
      join(shitennoDir, "docs", "history", "2025-06-22-sessao-1.md"),
      "# Session 3\nFalhou again in src/services, needs fix."
    );

    const report = detectPatterns(tempDir, shitennoDir);
    expect(report.historyEntriesAnalyzed).toBe(3);
    expect(report.patterns.length).toBeGreaterThanOrEqual(1);

    const recurring = report.patterns.find(
      (p) => p.type === "recurring_error"
    );
    expect(recurring).toBeDefined();
    expect(recurring!.affectedArea).toBe("src/services");
    expect(recurring!.occurrences).toBe(3);
  });

  it("detects reverted decisions when 2+ entries have revert/rollback", () => {
    writeFileSync(
      join(shitennoDir, "docs", "history", "2025-06-20-sessao-1.md"),
      "# Session 1\nReverted the database migration."
    );
    writeFileSync(
      join(shitennoDir, "docs", "history", "2025-06-21-sessao-1.md"),
      "# Session 2\nHad to rollback the API changes."
    );

    const report = detectPatterns(tempDir, shitennoDir);
    const reverted = report.patterns.find(
      (p) => p.type === "reverted_decision"
    );
    expect(reverted).toBeDefined();
    expect(reverted!.occurrences).toBe(2);
  });

  it("detects hot areas from reports", () => {
    mkdirSync(join(shitennoDir, "reports"), { recursive: true });
    writeFileSync(
      join(shitennoDir, "reports", "complexity-proj-2025-06-20-s1.json"),
      JSON.stringify({
        projectName: "proj",
        score: 8,
        level: "senior",
        areaScores: [
          { area: "src/services", score: 7, violations: 2, churn: 10 },
        ],
      })
    );
    writeFileSync(
      join(shitennoDir, "reports", "complexity-proj-2025-06-21-s1.json"),
      JSON.stringify({
        projectName: "proj",
        score: 9,
        level: "senior",
        areaScores: [
          { area: "src/services", score: 8, violations: 3, churn: 15 },
        ],
      })
    );

    const report = detectPatterns(tempDir, shitennoDir);
    expect(report.reportsAnalyzed).toBe(2);

    const hotArea = report.patterns.find((p) => p.type === "hot_area");
    expect(hotArea).toBeDefined();
    expect(hotArea!.affectedArea).toBe("src/services");
  });

  it("proposes rules for recurring errors", () => {
    for (let i = 0; i < 4; i++) {
      writeFileSync(
        join(shitennoDir, "docs", "history", `2025-06-${20 + i}-s1.md`),
        "# Session\nBug in src/services: erro, falhou, fix."
      );
    }

    const report = detectPatterns(tempDir, shitennoDir);
    expect(report.candidateRules.length).toBeGreaterThanOrEqual(1);

    const rule = report.candidateRules[0];
    expect(rule!.id).toMatch(/^RULE-\d{3}$/);
    expect(rule!.status).toBe("proposed");
    expect(rule!.target).toBe("FORBIDDEN_OPERATIONS");
  });

  it("generates a summary", () => {
    const report = detectPatterns(tempDir, shitennoDir);
    expect(report.summary).toBeTruthy();
    expect(report.summary).toContain("historico");
  });
});

describe("writePatternReport", () => {
  it("returns null when reports/ doesn't exist", () => {
    const report = detectPatterns(tempDir, shitennoDir);
    const result = writePatternReport(shitennoDir, report);
    expect(result).toBeNull();
  });

  it("writes pattern report when reports/ exists", () => {
    mkdirSync(join(shitennoDir, "reports"), { recursive: true });
    const report = detectPatterns(tempDir, shitennoDir);
    const filename = writePatternReport(shitennoDir, report);
    expect(filename).toMatch(/^patterns-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
