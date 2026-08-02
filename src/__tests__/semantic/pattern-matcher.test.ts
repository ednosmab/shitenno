/**
 * pattern-matcher.test.ts — Tests for Semantic Pattern Detection
 *
 * Verifies that pattern rules correctly detect architectural shifts,
 * scope drift, security degradation, and other semantic patterns.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ChangeJournal, resetChangeJournal } from "../../semantic/change-journal.js";
import { getPatternMatcher, resetPatternMatcher, detectPatterns } from "../../semantic/pattern-matcher.js";
import { getPatternRule, getPatternTypes } from "../../semantic/pattern-rules.js";
import { getEventBus, resetEventBus } from "../../event-bus.js";
import type { SemanticClassification } from "../../semantic/taxonomy.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

const TEST_DIR = join(process.cwd(), ".shitenno-test-pattern-matcher");

function makeClassification(domain: string, subdomain: string, confidence = 0.8): SemanticClassification {
  return {
    domain: domain as SemanticClassification["domain"],
    subdomain,
    confidence,
    evidence: ["test evidence"],
    signals: ["file.created"],
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Pattern Matcher", () => {
  beforeEach(() => {
    resetChangeJournal();
    resetPatternMatcher();
    resetEventBus();
    if (!existsSync(TEST_DIR)) {
      mkdirSync(join(TEST_DIR, "governance"), { recursive: true });
    }
  });

  afterEach(() => {
    resetChangeJournal();
    resetPatternMatcher();
    resetEventBus();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  // ── Pattern Rules ──────────────────────────────────────────────────────

  describe("pattern rules", () => {
    it("has all expected pattern types", () => {
      const types = getPatternTypes();
      expect(types).toContain("architectural_shift");
      expect(types).toContain("scope_drift");
      expect(types).toContain("security_degradation");
      expect(types).toContain("tech_debt_accumulation");
      expect(types).toContain("capability_gap");
      expect(types).toContain("maturity_regression");
    });

    it("can retrieve rules by type", () => {
      const rule = getPatternRule("architectural_shift");
      expect(rule).toBeDefined();
      expect(rule?.type).toBe("architectural_shift");
      expect(rule?.name).toBeDefined();
      expect(rule?.description).toBeDefined();
    });
  });

  // ── Architectural Shift ────────────────────────────────────────────────

  describe("architectural_shift detection", () => {
    it("detects architectural shift with 3+ signals in same domain", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");

      // Add 3 persistence signals
      journal.add(makeClassification("persistence", "database-driver"), 1, [], ["dependency.added"]);
      journal.add(makeClassification("persistence", "schema-migration"), 1, [], ["file.created"]);
      journal.add(makeClassification("persistence", "connection-config"), 1, [], ["config.changed"]);

      const matcher = getPatternMatcher(journal, 5);
      const patterns = matcher.detect();

      const shift = patterns.find((p) => p.type === "architectural_shift");
      expect(shift).toBeDefined();
      expect(shift?.domain).toBe("persistence");
      expect(shift?.confidence).toBeGreaterThan(0);
      expect(shift?.suggestedActions.length).toBeGreaterThan(0);
    });

    it("does not detect shift with fewer than 3 signals", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");

      journal.add(makeClassification("persistence", "database-driver"), 1, [], ["dependency.added"]);
      journal.add(makeClassification("persistence", "schema-migration"), 1, [], ["file.created"]);

      const matcher = getPatternMatcher(journal, 5);
      const patterns = matcher.detect();

      const shift = patterns.find((p) => p.type === "architectural_shift");
      expect(shift).toBeUndefined();
    });
  });

  // ── Security Degradation ───────────────────────────────────────────────

  describe("security_degradation detection", () => {
    it("detects security changes without tests", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");

      // Add security signals but no testing signals
      journal.add(makeClassification("security", "security-library"), 1, [], ["dependency.added"]);
      journal.add(makeClassification("security", "secret-config"), 1, [], ["config.changed"]);

      const matcher = getPatternMatcher(journal, 5);
      const patterns = matcher.detect();

      const degradation = patterns.find((p) => p.type === "security_degradation");
      expect(degradation).toBeDefined();
      expect(degradation?.domain).toBe("security");
    });

    it("does not detect degradation when tests exist", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");

      // Add security signals AND testing signals
      journal.add(makeClassification("security", "security-library"), 1, [], ["dependency.added"]);
      journal.add(makeClassification("testing", "test-file"), 1, [], ["file.created"]);

      const matcher = getPatternMatcher(journal, 5);
      const patterns = matcher.detect();

      const degradation = patterns.find((p) => p.type === "security_degradation");
      expect(degradation).toBeUndefined();
    });
  });

  // ── Tech Debt Accumulation ─────────────────────────────────────────────

  describe("tech_debt_accumulation detection", () => {
    it("detects changes without quality improvements", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");

      // Add many non-testing, non-documentation changes
      for (let i = 0; i < 6; i++) {
        journal.add(makeClassification("persistence", "database-driver"), 1, [], ["file.created"]);
      }
      // Only 1 quality improvement
      journal.add(makeClassification("testing", "test-file"), 1, [], ["file.created"]);

      const matcher = getPatternMatcher(journal, 5);
      const patterns = matcher.detect();

      const debt = patterns.find((p) => p.type === "tech_debt_accumulation");
      expect(debt).toBeDefined();
    });
  });

  // ── Detection History ──────────────────────────────────────────────────

  describe("detection history", () => {
    it("records detection runs", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");
      journal.add(makeClassification("persistence", "database-driver"), 1, [], ["file.created"]);

      const matcher = getPatternMatcher(journal, 5);
      matcher.detect();
      matcher.detect();

      const history = matcher.getHistory();
      expect(history.length).toBe(2);
      expect(history[0]?.timestamp).toBeDefined();
      expect(history[0]?.journalSize).toBe(1);
    });
  });

  // ── Event Bus Integration ──────────────────────────────────────────────

  describe("event bus integration", () => {
    it("publishes semantic.pattern_detected events", () => {
      const bus = getEventBus();
      const received: unknown[] = [];
      bus.subscribe("semantic.pattern_detected", (payload) => {
        received.push(payload);
      });

      const journal = new ChangeJournal(TEST_DIR, "session-1");
      // Add enough signals to trigger a pattern
      journal.add(makeClassification("persistence", "database-driver"), 1, [], ["dependency.added"]);
      journal.add(makeClassification("persistence", "schema-migration"), 1, [], ["file.created"]);
      journal.add(makeClassification("persistence", "connection-config"), 1, [], ["config.changed"]);

      const matcher = getPatternMatcher(journal, 5);
      matcher.detect();

      expect(received.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Convenience Function ───────────────────────────────────────────────

  describe("detectPatterns convenience", () => {
    it("detects patterns via convenience function", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");
      journal.add(makeClassification("security", "security-library"), 1, [], ["dependency.added"]);
      journal.add(makeClassification("security", "secret-config"), 1, [], ["config.changed"]);

      const patterns = detectPatterns(journal, 5);
      expect(Array.isArray(patterns)).toBe(true);
    });
  });
});
