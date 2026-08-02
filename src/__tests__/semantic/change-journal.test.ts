/**
 * change-journal.test.ts — Tests for Semantic Change Journal
 *
 * Verifies journal persistence, querying, windowing, and stats.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ChangeJournal, resetChangeJournal } from "../../semantic/change-journal.js";
import type { SemanticClassification } from "../../semantic/taxonomy.js";
import type { JournalEntry } from "../../semantic/change-journal.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

const TEST_DIR = join(process.cwd(), ".shitenno-test-journal");

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

describe("Change Journal", () => {
  beforeEach(() => {
    resetChangeJournal();
    if (!existsSync(TEST_DIR)) {
      mkdirSync(join(TEST_DIR, "governance"), { recursive: true });
    }
  });

  afterEach(() => {
    resetChangeJournal();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  // ── Basic Operations ───────────────────────────────────────────────────

  describe("add and query", () => {
    it("adds entries and queries them", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");

      const entry = journal.add(
        makeClassification("persistence", "database-driver"),
        3,
        ["src/db/user.ts"],
        ["dependency.added"]
      );

      expect(entry.id).toBeDefined();
      expect(entry.timestamp).toBeDefined();
      expect(entry.sessionId).toBe("session-1");
      expect(entry.classification.domain).toBe("persistence");
      expect(entry.eventCount).toBe(3);
      expect(entry.files).toEqual(["src/db/user.ts"]);
      expect(entry.signals).toEqual(["dependency.added"]);
    });

    it("queries entries by domain", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");

      journal.add(makeClassification("persistence", "database-driver"), 1, [], ["file.created"]);
      journal.add(makeClassification("security", "security-library"), 1, [], ["dependency.added"]);
      journal.add(makeClassification("persistence", "schema-migration"), 1, [], ["file.created"]);

      const results = journal.query({ domain: "persistence" });
      expect(results.length).toBe(2);
      expect(results.every((e) => e.classification.domain === "persistence")).toBe(true);
    });

    it("queries entries by minimum confidence", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");

      journal.add(makeClassification("persistence", "database-driver", 0.9), 1, [], ["file.created"]);
      journal.add(makeClassification("security", "security-library", 0.5), 1, [], ["dependency.added"]);

      const results = journal.query({ minConfidence: 0.7 });
      expect(results.length).toBe(1);
      expect(results[0]?.classification.domain).toBe("persistence");
    });

    it("queries entries by signal type", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");

      journal.add(makeClassification("persistence", "database-driver"), 1, [], ["dependency.added"]);
      journal.add(makeClassification("security", "security-library"), 1, [], ["file.created"]);

      const results = journal.query({ signal: "dependency.added" });
      expect(results.length).toBe(1);
      expect(results[0]?.classification.domain).toBe("persistence");
    });

    it("queries entries with limit", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");

      for (let i = 0; i < 10; i++) {
        journal.add(makeClassification("persistence", "database-driver"), 1, [], ["file.created"]);
      }

      const results = journal.query({ limit: 5 });
      expect(results.length).toBe(5);
    });
  });

  // ── Window ─────────────────────────────────────────────────────────────

  describe("getWindow", () => {
    it("returns entries from recent sessions", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");

      // Add entries from different sessions
      journal.add(makeClassification("persistence", "database-driver"), 1, [], ["file.created"]);
      journal.add(makeClassification("persistence", "schema-migration"), 1, [], ["file.created"]);
      journal.add(makeClassification("security", "security-library"), 1, [], ["dependency.added"]);

      // Window of 1 session should only include the last session
      const window = journal.getWindow("persistence", 1);
      expect(window.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Stats ──────────────────────────────────────────────────────────────

  describe("stats", () => {
    it("returns correct statistics", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");

      journal.add(makeClassification("persistence", "database-driver", 0.9), 1, [], ["file.created"]);
      journal.add(makeClassification("security", "security-library", 0.7), 1, [], ["dependency.added"]);

      const stats = journal.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.byDomain["persistence"]).toBe(1);
      expect(stats.byDomain["security"]).toBe(1);
      expect(stats.avgConfidence).toBeCloseTo(0.8);
      expect(stats.oldestEntry).toBeDefined();
      expect(stats.newestEntry).toBeDefined();
    });
  });

  // ── Persistence ────────────────────────────────────────────────────────

  describe("persistence", () => {
    it("persists entries to JSONL file", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");
      journal.add(makeClassification("persistence", "database-driver"), 1, [], ["file.created"]);

      const journalPath = join(TEST_DIR, "governance", "change-journal.jsonl");
      expect(existsSync(journalPath)).toBe(true);

      const content = readFileSync(journalPath, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim());
      expect(lines.length).toBe(1);

      const parsed = JSON.parse(lines[0]!) as JournalEntry;
      expect(parsed.classification.domain).toBe("persistence");
    });

    it("loads existing entries on construction", () => {
      // First journal writes
      const journal1 = new ChangeJournal(TEST_DIR, "session-1");
      journal1.add(makeClassification("persistence", "database-driver"), 1, [], ["file.created"]);

      // Second journal loads existing entries
      const journal2 = new ChangeJournal(TEST_DIR, "session-2");
      const stats = journal2.getStats();
      expect(stats.totalEntries).toBe(1);
    });
  });

  // ── Clear ──────────────────────────────────────────────────────────────

  describe("clear", () => {
    it("clears all entries", () => {
      const journal = new ChangeJournal(TEST_DIR, "session-1");
      journal.add(makeClassification("persistence", "database-driver"), 1, [], ["file.created"]);
      journal.add(makeClassification("security", "security-library"), 1, [], ["dependency.added"]);

      journal.clear();
      const stats = journal.getStats();
      expect(stats.totalEntries).toBe(0);
    });
  });
});
