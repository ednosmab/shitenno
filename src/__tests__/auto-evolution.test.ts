import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  analyzeEvolution,
} from "../application/auto-evolution.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const TEST_DIR = join(tmpdir(), "shitenno-auto-evolution-test");
const SHITENNO_DIR = join(TEST_DIR, "shugo");

beforeAll(() => {
  mkdirSync(join(SHITENNO_DIR, "governance", "rules"), { recursive: true });
  mkdirSync(join(SHITENNO_DIR, "governance", "context"), { recursive: true });
  mkdirSync(join(SHITENNO_DIR, "governance", "backlog"), { recursive: true });
  writeFileSync(
    join(SHITENNO_DIR, "governance", "context", "context_buffer.yaml"),
    "reminders:\n  - test\n",
  );
  writeFileSync(
    join(SHITENNO_DIR, "governance", "context", "quick_board.md"),
    "# Quick Board\n## Proximo\n- Do something\n",
  );
});
afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("analyzeEvolution", () => {
  it("returns a valid EvolutionReport", () => {
    const report = analyzeEvolution(TEST_DIR, SHITENNO_DIR);
    expect(report).toBeDefined();
    expect(typeof report.analyzedAt).toBe("string");
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(Array.isArray(report.dualPaths)).toBe(true);
    expect(typeof report.totalRecommendations).toBe("number");
  });

  it("includes byType and byPriority breakdowns", () => {
    const report = analyzeEvolution(TEST_DIR, SHITENNO_DIR);
    expect(report.byType).toBeDefined();
    expect(report.byPriority).toBeDefined();
  });

  it("recommendations have required fields", () => {
    const report = analyzeEvolution(TEST_DIR, SHITENNO_DIR);
    for (const rec of report.recommendations) {
      expect(typeof rec.id).toBe("string");
      expect(typeof rec.title).toBe("string");
      expect(typeof rec.confidence).toBe("number");
      expect(rec.confidence).toBeGreaterThanOrEqual(0);
      expect(rec.confidence).toBeLessThanOrEqual(1);
      expect(["urgent", "high", "medium", "low"]).toContain(rec.priority);
    }
  });

  it("dualPaths link to valid recommendations", () => {
    const report = analyzeEvolution(TEST_DIR, SHITENNO_DIR);
    for (const dp of report.dualPaths) {
      expect(dp.comfortable).toBeDefined();
      expect(dp.challenging).toBeDefined();
      expect(typeof dp.challengeLevel).toBe("number");
    }
  });
});
