/**
 * reasoner.test.ts — Tests for Semantic Reasoning Engine
 *
 * Verifies that the reasoner generates correct insights from
 * patterns, journal entries, and subsystem evidence.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ChangeJournal, resetChangeJournal } from "../../semantic/change-journal.js";
import { getSemanticReasoner, resetSemanticReasoner, generateInsights } from "../../semantic/reasoner.js";
import type { DetectedPattern } from "../../semantic/pattern-rules.js";
import type { SemanticClassification } from "../../semantic/taxonomy.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

const TEST_DIR = join(process.cwd(), ".shitenno-test-reasoner");

function makeClassification(domain: string, subdomain: string): SemanticClassification {
  return {
    domain: domain as SemanticClassification["domain"],
    subdomain,
    confidence: 0.8,
    evidence: ["test"],
    signals: ["file.created"],
  };
}

function makePattern(type: string, domain: string, confidence = 0.8): DetectedPattern {
  return {
    id: `test-${type}-${Date.now()}`,
    type: type as DetectedPattern["type"],
    domain: domain as DetectedPattern["domain"],
    domains: [domain as DetectedPattern["domain"]],
    confidence,
    description: `Test: ${type} in ${domain}`,
    signals: ["file.created"],
    suggestedActions: ["Action 1"],
    detectedAt: new Date().toISOString(),
    windowSessions: 5,
    evidence: [],
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Semantic Reasoner", () => {
  beforeEach(() => {
    resetChangeJournal();
    resetSemanticReasoner();
    if (!existsSync(TEST_DIR)) {
      mkdirSync(join(TEST_DIR, "governance"), { recursive: true });
    }
  });

  afterEach(() => {
    resetChangeJournal();
    resetSemanticReasoner();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("generateInsights", () => {
    it("generates architecture evolution insight from patterns", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");
      journal.add(makeClassification("persistence", "database-driver"), 1, [], ["file.created"]);
      journal.add(makeClassification("persistence", "schema-migration"), 1, [], ["file.created"]);

      const patterns = [makePattern("architectural_shift", "persistence")];
      const insights = generateInsights(TEST_DIR, TEST_DIR, patterns, journal);

      expect(insights.length).toBeGreaterThan(0);
      const archInsight = insights.find((i) => i.type === "architecture_evolution");
      expect(archInsight).toBeDefined();
      expect(archInsight?.domains).toContain("persistence");
    });

    it("generates security posture insight from security patterns", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");
      journal.add(makeClassification("security", "security-library"), 1, [], ["dependency.added"]);

      const patterns = [makePattern("security_degradation", "security")];
      const insights = generateInsights(TEST_DIR, TEST_DIR, patterns, journal);

      expect(insights.length).toBeGreaterThan(0);
      const secInsight = insights.find((i) => i.type === "security_posture_change");
      expect(secInsight).toBeDefined();
    });

    it("generates scope expansion insight from drift patterns", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");

      const patterns = [makePattern("scope_drift", "frontend")];
      const insights = generateInsights(TEST_DIR, TEST_DIR, patterns, journal);

      const scopeInsight = insights.find((i) => i.type === "scope_expansion");
      expect(scopeInsight).toBeDefined();
    });

    it("generates governance gap insight from capability gaps", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");

      const patterns = [makePattern("capability_gap", "testing")];
      const insights = generateInsights(TEST_DIR, TEST_DIR, patterns, journal);

      const govInsight = insights.find((i) => i.type === "governance_gap");
      expect(govInsight).toBeDefined();
    });

    it("sorts insights by priority", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");

      const patterns = [
        makePattern("architectural_shift", "persistence"),
        makePattern("security_degradation", "security"),
      ];
      const insights = generateInsights(TEST_DIR, TEST_DIR, patterns, journal);

      if (insights.length >= 2) {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        for (let i = 1; i < insights.length; i++) {
          const prev = priorityOrder[insights[i - 1]!.priority];
          const curr = priorityOrder[insights[i]!.priority];
          expect(prev).toBeLessThanOrEqual(curr);
        }
      }
    });
  });

  describe("collectEvidence", () => {
    it("collects evidence from journal entries", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");
      journal.add(makeClassification("persistence", "database-driver"), 1, [], ["file.created"]);
      journal.add(makeClassification("security", "security-library"), 1, [], ["dependency.added"]);

      const patterns: DetectedPattern[] = [];
      const reasoner = getSemanticReasoner({ shitennoDir: TEST_DIR, projectRoot: TEST_DIR, patterns, journal });
      const insights = reasoner.reason();

      expect(insights).toBeDefined();
      expect(Array.isArray(insights)).toBe(true);
    });
  });
});
