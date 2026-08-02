/**
 * correlator.test.ts — Tests for Semantic Correlation Engine
 *
 * Verifies that cross-system correlations are correctly detected
 * from journal entries and subsystem data.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ChangeJournal, resetChangeJournal } from "../../semantic/change-journal.js";
import { getSemanticCorrelator, resetSemanticCorrelator, detectCorrelations } from "../../semantic/correlator.js";
import type { SemanticClassification } from "../../semantic/taxonomy.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

const TEST_DIR = join(process.cwd(), ".shitenno-test-correlator");

function makeClassification(domain: string, subdomain: string): SemanticClassification {
  return {
    domain: domain as SemanticClassification["domain"],
    subdomain,
    confidence: 0.8,
    evidence: ["test"],
    signals: ["file.created"],
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Semantic Correlator", () => {
  beforeEach(() => {
    resetChangeJournal();
    resetSemanticCorrelator();
    if (!existsSync(TEST_DIR)) {
      mkdirSync(join(TEST_DIR, "governance"), { recursive: true });
    }
  });

  afterEach(() => {
    resetChangeJournal();
    resetSemanticCorrelator();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("detectCorrelations", () => {
    it("returns empty array with no data", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");
      const correlations = detectCorrelations(TEST_DIR, TEST_DIR, journal);
      expect(correlations).toEqual([]);
    });

    it("detects risk-maturity divergence when files exist", () => {
      // Create risk map and maturity profile with divergent scores
      writeFileSync(
        join(TEST_DIR, "governance", "risk-map.json"),
        JSON.stringify({ overallRisk: "high", overallScore: 75 })
      );
      writeFileSync(
        join(TEST_DIR, "governance", "maturity-profile.json"),
        JSON.stringify({ overallScore: 65 })
      );

      const journal = new ChangeJournal(TEST_DIR, "session-1");
      const correlations = detectCorrelations(TEST_DIR, TEST_DIR, journal);

      const divergence = correlations.find((c) => c.type === "risk_maturity_divergence");
      expect(divergence).toBeDefined();
      expect(divergence?.strength).toMatch(/moderate|strong/);
    });

    it("detects health-knowledge mismatch when files exist", () => {
      writeFileSync(
        join(TEST_DIR, "governance", "health-score.json"),
        JSON.stringify({ score: 80 })
      );
      writeFileSync(
        join(TEST_DIR, "governance", "knowledge-debt.json"),
        JSON.stringify({ totalGaps: 15 })
      );

      const journal = new ChangeJournal(TEST_DIR, "session-1");
      const correlations = detectCorrelations(TEST_DIR, TEST_DIR, journal);

      const mismatch = correlations.find((c) => c.type === "health_knowledge_mismatch");
      expect(mismatch).toBeDefined();
      expect(mismatch?.description).toContain("15");
    });

    it("detects domain isolation with single-occurrence domains", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");

      // Add 10+ entries with some isolated domains (only 1 entry each)
      for (let i = 0; i < 5; i++) {
        journal.add(makeClassification("persistence", "database-driver"), 1, [], ["file.created"]);
      }
      for (let i = 0; i < 3; i++) {
        journal.add(makeClassification("testing", "test-file"), 1, [], ["file.created"]);
      }
      // Single isolated domains
      journal.add(makeClassification("security", "security-library"), 1, [], ["dependency.added"]);
      journal.add(makeClassification("frontend", "ui-component"), 1, [], ["file.created"]);

      const correlations = detectCorrelations(TEST_DIR, TEST_DIR, journal);

      const isolation = correlations.find((c) => c.type === "domain_isolation");
      expect(isolation).toBeDefined();
    });

    it("correlator class works", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");
      const correlator = getSemanticCorrelator({ shitennoDir: TEST_DIR, projectRoot: TEST_DIR, journal });
      const correlations = correlator.correlate();
      expect(Array.isArray(correlations)).toBe(true);
    });
  });
});
