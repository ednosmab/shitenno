import { describe, it, expect } from "vitest";
import { SECURITY_DETECTOR_SELF_PATHS } from "../audit/constants.js";

/**
 * Regression test: SECURITY_DETECTOR_SELF_PATHS narrow exclusion.
 *
 * The self-exclusion list should only exclude actual detector definition files,
 * not utility files within the same directories. This prevents security detectors
 * from scanning their own definition code (which would produce false positives)
 * while still allowing them to scan utility files for real security issues.
 *
 * See: PLANO-UNICO-CONSOLIDADO-2026-08-01-v2.md — Phase A.4
 */

describe("SECURITY_DETECTOR_SELF_PATHS narrow exclusion", () => {
  it("no longer excludes the entire src/audit/taint/ directory", () => {
    const hasDirectoryExclusion = SECURITY_DETECTOR_SELF_PATHS.some(
      (p) => p === "src/audit/taint/",
    );
    expect(hasDirectoryExclusion).toBe(false);
  });

  it("still excludes the entire src/audit/security/ directory (all are detector impls)", () => {
    const hasDirectoryExclusion = SECURITY_DETECTOR_SELF_PATHS.some(
      (p) => p === "src/audit/security/",
    );
    expect(hasDirectoryExclusion).toBe(true);
  });

  it("excludes the 6 taint detector definition files", () => {
    const expectedExcluded = [
      "src/audit/taint/analyzer.ts",
      "src/audit/taint/ast-visitor.ts",
      "src/audit/taint/sinks.ts",
      "src/audit/taint/sources.ts",
      "src/audit/taint/sanitizers.ts",
      "src/audit/taint/issue-builder.ts",
    ];
    for (const file of expectedExcluded) {
      expect(SECURITY_DETECTOR_SELF_PATHS).toContain(file);
    }
  });

  it("does NOT exclude taint utility files (graph.ts, reporter.ts, types.ts)", () => {
    const utilityFiles = [
      "src/audit/taint/graph.ts",
      "src/audit/taint/reporter.ts",
      "src/audit/taint/types.ts",
      "src/audit/taint/index.ts",
      "src/audit/taint/ast-utils.ts",
    ];
    for (const file of utilityFiles) {
      expect(SECURITY_DETECTOR_SELF_PATHS).not.toContain(file);
    }
  });

  it("excludes core detector entry points", () => {
    const coreFiles = [
      "src/health-auditor.ts",
      "src/audit/engineering-detectors.ts",
      "src/audit/engineering-detectors-security.ts",
      "src/audit/engineering-detectors-quality.ts",
      "src/audit/engineering-detectors-supply.ts",
    ];
    for (const file of coreFiles) {
      expect(SECURITY_DETECTOR_SELF_PATHS).toContain(file);
    }
  });
});
