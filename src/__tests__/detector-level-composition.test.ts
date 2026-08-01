import { describe, it, expect } from "vitest";
import { DETECTORS_BY_LEVEL } from "../audit/constants/detector-levels.js";

/**
 * Regression test: detector level composition hierarchy.
 *
 * quick ⊂ standard ⊂ code-review ⊂ enterprise
 * Each higher level MUST include all detectors from the level below.
 * See: PLANO-UNICO-CONSOLIDADO-2026-08-01-v2.md — Phase A.1 / A.3
 */

const LEVELS = ["quick", "standard", "code-review", "enterprise"] as const;

describe("Detector level composition hierarchy", () => {
  it("each higher level includes all detectors from the level below", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const lowerLevel = LEVELS[i - 1]!;
      const higherLevel = LEVELS[i]!;
      const lower = DETECTORS_BY_LEVEL[lowerLevel];
      const higherSet = new Set(DETECTORS_BY_LEVEL[higherLevel]);
      const missing = lower.filter((d: string) => !higherSet.has(d));
      expect(
        missing,
        `${higherLevel} is missing detectors from ${lowerLevel}: ${missing.join(", ")}`,
      ).toEqual([]);
    }
  });

  it("no detector appears twice in the same level", () => {
    for (const level of LEVELS) {
      const detectors = DETECTORS_BY_LEVEL[level];
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const d of detectors) {
        if (seen.has(d)) duplicates.push(d);
        seen.add(d);
      }
      expect(
        duplicates,
        `${level} has duplicate detectors: ${duplicates.join(", ")}`,
      ).toEqual([]);
    }
  });

  it("every level has at least 1 detector", () => {
    for (const level of LEVELS) {
      expect(DETECTORS_BY_LEVEL[level].length).toBeGreaterThan(0);
    }
  });

  it("quick has exactly 6 detectors", () => {
    expect(DETECTORS_BY_LEVEL.quick.length).toBe(6);
  });

  it("detectMisclassifiedTier is in code-review and enterprise", () => {
    expect(DETECTORS_BY_LEVEL["code-review"]).toContain("detectMisclassifiedTier");
    expect(DETECTORS_BY_LEVEL.enterprise).toContain("detectMisclassifiedTier");
  });

  it("detectDependencyStaleness is in enterprise", () => {
    expect(DETECTORS_BY_LEVEL.enterprise).toContain("detectDependencyStaleness");
  });
});
