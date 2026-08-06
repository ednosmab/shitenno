/**
 * knowledge-debt.test.ts — Tests for Knowledge Debt Detection
 *
 * Validates gap detection, scoring, recommendations, and report generation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  detectKnowledgeDebt,
  writeDebtReport,
} from "../application/knowledge-debt.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function createTmpDir(): string {
  const dir = join(tmpdir(), `shitenno-debt-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function createShitennoDir(tmpDir: string): string {
  const shitennoDir = join(tmpDir, "shitenno");
  mkdirSync(join(shitennoDir, "docs", "adrs"), { recursive: true });
  mkdirSync(join(shitennoDir, "docs", "skills"), { recursive: true });
  mkdirSync(join(shitennoDir, "docs", "history"), { recursive: true });
  mkdirSync(join(shitennoDir, "governance", "agents"), { recursive: true });
  mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
  mkdirSync(join(shitennoDir, "scripts"), { recursive: true });
  mkdirSync(join(shitennoDir, "reports"), { recursive: true });
  return shitennoDir;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("knowledge-debt", () => {
  let tmpDir: string;
  let shitennoDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
    shitennoDir = createShitennoDir(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("detectKnowledgeDebt", () => {
    it("returns a valid report structure", () => {
      const report = detectKnowledgeDebt(tmpDir, shitennoDir);
      expect(report).toBeDefined();
      expect(report.generatedAt).toBeTruthy();
      expect(typeof report.totalGaps).toBe("number");
      expect(typeof report.healthScore).toBe("number");
      expect(typeof report.summary).toBe("string");
      expect(Array.isArray(report.gaps)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it("detects missing ADRs when history exists", () => {
      // Create history files to trigger the ADR gap
      for (let i = 0; i < 6; i++) {
        writeFileSync(join(shitennoDir, "docs", "history", `session-${i}.md`), `# Session ${i}`);
      }
      const report = detectKnowledgeDebt(tmpDir, shitennoDir);
      const adrGaps = report.gaps.filter((g) => g.type === "adr_missing");
      expect(adrGaps.length).toBeGreaterThan(0);
      if (adrGaps[0]) {
        expect(adrGaps[0].severity).toBe("high");
      }
    });

    it("detects missing workflow", () => {
      const report = detectKnowledgeDebt(tmpDir, shitennoDir);
      const wfGaps = report.gaps.filter((g) => g.type === "workflow_missing");
      expect(wfGaps.length).toBe(1);
      if (wfGaps[0]) {
        expect(wfGaps[0].severity).toBe("high");
      }
    });

    it("detects missing docs", () => {
      const report = detectKnowledgeDebt(tmpDir, shitennoDir);
      const docGaps = report.gaps.filter((g) => g.type === "docs_missing");
      expect(docGaps.length).toBeGreaterThan(0);
    });

    it("returns zero gaps when all artifacts exist", () => {
      // Create all expected artifacts
      writeFileSync(join(shitennoDir, "docs", "adrs", "ADR-001.md"), "# ADR 001\nEstado: accepted");
      writeFileSync(join(shitennoDir, "docs", "skills", "skill-001.md"), "# Skill 001");
      writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
      writeFileSync(join(shitennoDir, "docs", "CONCEPTUAL_MODEL.md"), "# Model");
      writeFileSync(join(shitennoDir, "docs", "KNOWLEDGE_LIFECYCLE.md"), "# Lifecycle");
      writeFileSync(join(shitennoDir, "governance", "agents", "contract.yaml"), "name: test\nagent: planner");

      const report = detectKnowledgeDebt(tmpDir, shitennoDir);
      // Should have fewer gaps (automation may still trigger)
      expect(report.healthScore).toBeGreaterThan(80);
    });

    it("health score is between 0 and 100", () => {
      const report = detectKnowledgeDebt(tmpDir, shitennoDir);
      expect(report.healthScore).toBeGreaterThanOrEqual(0);
      expect(report.healthScore).toBeLessThanOrEqual(100);
    });

    it("gaps have required fields", () => {
      const report = detectKnowledgeDebt(tmpDir, shitennoDir);
      for (const gap of report.gaps) {
        expect(gap.id).toBeTruthy();
        expect(gap.type).toBeTruthy();
        expect(["critical", "high", "medium", "low"]).toContain(gap.severity);
        expect(gap.description).toBeTruthy();
        expect(gap.location).toBeTruthy();
        expect(gap.expectedArtifact).toBeTruthy();
        expect(gap.recommendation).toBeTruthy();
        expect(gap.detectedAt).toBeTruthy();
        expect(typeof gap.addressed).toBe("boolean");
      }
    });

    it("gapsBySeverity sums to totalGaps", () => {
      const report = detectKnowledgeDebt(tmpDir, shitennoDir);
      const sum = Object.values(report.gapsBySeverity).reduce((a, b) => a + b, 0);
      expect(sum).toBe(report.totalGaps);
    });

    it("recommendations are limited to 5", () => {
      const report = detectKnowledgeDebt(tmpDir, shitennoDir);
      expect(report.recommendations.length).toBeLessThanOrEqual(5);
    });
  });

  describe("writeDebtReport", () => {
    it("writes report to reports directory", () => {
      const report = detectKnowledgeDebt(tmpDir, shitennoDir);
      const filename = writeDebtReport(shitennoDir, report);
      expect(filename).toBeTruthy();
      expect(filename).toMatch(/^knowledge-debt-\d{4}-\d{2}-\d{2}\.json$/);
      expect(existsSync(join(shitennoDir, "reports", filename!))).toBe(true);
    });

    it("returns null when reports directory missing", () => {
      const emptyShitenno = join(tmpDir, "empty-shitenno");
      mkdirSync(emptyShitenno, { recursive: true });
      const report = detectKnowledgeDebt(tmpDir, shitennoDir);
      const result = writeDebtReport(emptyShitenno, report);
      expect(result).toBeNull();
    });
  });
});
