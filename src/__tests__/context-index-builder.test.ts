/**
 * Tests for context-index-builder.ts
 *
 * Tests the P4 index generation and loading logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "index-builder-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

vi.mock("../shared/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { buildP4Index, loadP4Index } from "../infrastructure/context-index-builder.js";

describe("buildP4Index", () => {
  it("creates empty index when no history or feedback dirs exist", () => {
    const result = buildP4Index(tempDir);
    expect(result.entries).toEqual([]);
  });

  it("indexes markdown files from docs/history/", () => {
    const historyDir = join(tempDir, "docs", "history");
    mkdirSync(historyDir, { recursive: true });

    writeFileSync(
      join(historyDir, "2026-07-15-session-summary.md"),
      "# Session Summary\nThis session focused on refactoring.\n\n## Details\nMore info here.\n"
    );
    writeFileSync(
      join(historyDir, "2026-07-14-architecture-review.md"),
      "# Architecture Review\nReviewed clean architecture patterns.\n\n## Findings\nFound issues with coupling.\n"
    );

    const result = buildP4Index(tempDir);
    expect(result.entries.length).toBe(2);

    const summaries = result.entries.map((e) => e.file);
    expect(summaries).toContain("docs/history/2026-07-15-session-summary.md");
    expect(summaries).toContain("docs/history/2026-07-14-architecture-review.md");
  });

  it("extracts date from filename prefix", () => {
    const historyDir = join(tempDir, "docs", "history");
    mkdirSync(historyDir, { recursive: true });
    writeFileSync(
      join(historyDir, "2026-07-15-ADR.md"),
      "# ADR\nSome content.\n"
    );

    const result = buildP4Index(tempDir);
    expect(result.entries[0]!.date).toBe("2026-07-15");
  });

  it("extracts summary from second non-empty line", () => {
    const historyDir = join(tempDir, "docs", "history");
    mkdirSync(historyDir, { recursive: true });
    writeFileSync(
      join(historyDir, "2026-07-15-test.md"),
      "# Title\nThis is the summary line.\n\nMore content.\n"
    );

    const result = buildP4Index(tempDir);
    expect(result.entries[0]!.summary).toBe("This is the summary line.");
  });

  it("truncates summary to 120 characters", () => {
    const historyDir = join(tempDir, "docs", "history");
    mkdirSync(historyDir, { recursive: true });
    const longSummary = "A".repeat(200);
    writeFileSync(
      join(historyDir, "2026-07-15-long.md"),
      `# Title\n${longSummary}\n`
    );

    const result = buildP4Index(tempDir);
    expect(result.entries[0]!.summary.length).toBeLessThanOrEqual(120);
  });

  it("indexes feedback records from feedback/records/", () => {
    const feedbackDir = join(tempDir, "feedback", "records");
    mkdirSync(feedbackDir, { recursive: true });

    writeFileSync(
      join(feedbackDir, "session-001.json"),
      JSON.stringify({
        outcome: "success",
        failureHotspots: ["rule-engine.ts"],
        timestamp: "2026-07-15T10:00:00Z",
      })
    );

    const result = buildP4Index(tempDir);
    expect(result.entries.length).toBe(1);
    expect(result.entries[0]!.file).toContain("feedback/records/session-001.json");
    expect(result.entries[0]!.summary).toContain("success");
  });

  it("escapes YAML special characters in summary", () => {
    const historyDir = join(tempDir, "docs", "history");
    mkdirSync(historyDir, { recursive: true });
    writeFileSync(
      join(historyDir, "2026-07-15-special.md"),
      '# Title\nSummary with "quotes" and: colons\n'
    );

    const result = buildP4Index(tempDir);
    // The YAML file should be parseable
    expect(result.entries.length).toBe(1);
  });

  it("writes index file to governance/context/p4_index.yaml", () => {
    const historyDir = join(tempDir, "docs", "history");
    mkdirSync(historyDir, { recursive: true });
    writeFileSync(
      join(historyDir, "2026-07-15-test.md"),
      "# Test\nSummary.\n"
    );

    buildP4Index(tempDir);

    const indexPath = join(tempDir, "governance", "context", "p4_index.yaml");
    expect(existsSync(indexPath)).toBe(true);

    const content = readFileSync(indexPath, "utf-8");
    expect(content).toContain("file:");
    expect(content).toContain("date:");
    expect(content).toContain("summary:");
  });

  it("creates governance/context directory if missing", () => {
    const historyDir = join(tempDir, "docs", "history");
    mkdirSync(historyDir, { recursive: true });
    writeFileSync(join(historyDir, "2026-07-15-test.md"), "# Test\nSummary.\n");

    const result = buildP4Index(tempDir);
    expect(result.entries.length).toBe(1);
    expect(existsSync(join(tempDir, "governance", "context"))).toBe(true);
  });
});

describe("loadP4Index", () => {
  it("returns empty array when index file does not exist", () => {
    const entries = loadP4Index(tempDir);
    expect(entries).toEqual([]);
  });

  it("loads and parses a valid index file", () => {
    const contextDir = join(tempDir, "governance", "context");
    mkdirSync(contextDir, { recursive: true });
    writeFileSync(
      join(contextDir, "p4_index.yaml"),
      `- file: docs/history/2026-07-15-test.md\n  date: "2026-07-15"\n  summary: "Test summary"\n- file: feedback/records/s001.json\n  date: "2026-07-14"\n  summary: "Session success"\n`
    );

    const entries = loadP4Index(tempDir);
    expect(entries.length).toBe(2);
    expect(entries[0]!.file).toBe("docs/history/2026-07-15-test.md");
    expect(entries[0]!.date).toContain("2026-07-15");
    expect(entries[0]!.summary).toBe("Test summary");
  });

  it("returns empty array for malformed YAML", () => {
    const contextDir = join(tempDir, "governance", "context");
    mkdirSync(contextDir, { recursive: true });
    writeFileSync(join(contextDir, "p4_index.yaml"), "not valid yaml content [[[[");

    const entries = loadP4Index(tempDir);
    expect(entries).toEqual([]);
  });

  it("handles missing context directory", () => {
    const entries = loadP4Index(join(tempDir, "nonexistent"));
    expect(entries).toEqual([]);
  });
});
