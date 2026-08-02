import { describe, it, expect } from "vitest";
import { DETECTOR_PATTERN_FILES } from "../audit/constants.js";
import { isDetectorPatternLine } from "../audit/security/helpers.js";
import { detectHardcodedSecrets } from "../audit/security/secrets.js";
import type { SourceFileInfo } from "../audit/types/common.js";

/**
 * Regression test: self-exclusion must be line-based, never file/directory-wide.
 *
 * Before: SECURITY_DETECTOR_SELF_PATHS excluded the ENTIRE src/audit/security/
 * directory (and 9 other files) — a real hardcoded secret in any of them was
 * never detected. Now only literal pattern-definition lines inside a closed
 * set of definition files are skipped.
 *
 * See: PLANO-MESTRE-UNICO-v2-2026-08-01.md — Item 6
 */

function makeFile(relPath: string, content: string): SourceFileInfo {
  return {
    fullPath: relPath,
    relPath,
    basename: relPath.split("/").pop() ?? relPath,
    content,
    lineCount: content.split("\n").length,
  };
}

describe("DETECTOR_PATTERN_FILES — closed set, file-scoped only", () => {
  it("contains only files that literally define detection patterns", () => {
    expect([...DETECTOR_PATTERN_FILES].sort()).toEqual([
      "src/audit/security/cors.ts",
      "src/audit/security/crypto.ts",
      "src/audit/security/injection.ts",
      "src/audit/security/path-traversal.ts",
      "src/audit/security/secrets.ts",
      "src/audit/taint/sanitizers.ts",
      "src/audit/taint/sinks.ts",
      "src/audit/taint/sources.ts",
    ]);
  });

  it("has NO directory-style (trailing slash) entries", () => {
    for (const path of DETECTOR_PATTERN_FILES) {
      expect(path.endsWith("/")).toBe(false);
    }
  });

  it("no longer excludes src/audit/security/ as a directory", () => {
    expect(DETECTOR_PATTERN_FILES.has("src/audit/security/")).toBe(false);
  });

  it("does NOT list non-pattern files (analyzer, ast-visitor, engineering-detectors)", () => {
    for (const path of [
      "src/audit/taint/analyzer.ts",
      "src/audit/taint/ast-visitor.ts",
      "src/audit/taint/issue-builder.ts",
      "src/health-auditor.ts",
      "src/audit/engineering-detectors.ts",
    ]) {
      expect(DETECTOR_PATTERN_FILES.has(path)).toBe(false);
    }
  });
});

describe("isDetectorPatternLine — skips pattern lines, never whole files", () => {
  it("skips a `name: \"...\"` definition line inside sinks.ts", () => {
    expect(isDetectorPatternLine("src/audit/taint/sinks.ts", `{ name: "find", kind: "call", severity: 3 }`)).toBe(true);
  });

  it("skips a `pattern: /.../` definition line inside sources.ts", () => {
    expect(isDetectorPatternLine("src/audit/taint/sources.ts", `{ pattern: /^req\\.body$/, kind: "property" }`)).toBe(true);
  });

  it("skips a regex-literal pattern array line inside injection.ts", () => {
    expect(isDetectorPatternLine("src/audit/security/injection.ts", `    /\\\\.innerHTML\\\\s*[=+]/, /dangerouslySetInnerHTML/,`)).toBe(true);
  });

  it("skips a JSDoc line inside a definition file (pattern examples, not real usage)", () => {
    expect(isDetectorPatternLine("src/audit/security/crypto.ts", ` * Matches both \`.createHash("md5")\` (property access) and \`createHash("md5")\``)).toBe(true);
    expect(isDetectorPatternLine("src/audit/security/cors.ts", ` * Also detects the dangerous cors({origin:'*', credentials:true}) combination`)).toBe(true);
  });

  it("does NOT skip a real secret line in a pattern file (non-definition line)", () => {
    expect(isDetectorPatternLine("src/audit/taint/sinks.ts", `const backup = "AKIAIOSFODNN7EXAMPLE";`)).toBe(false);
    expect(isDetectorPatternLine("src/audit/security/crypto.ts", `const hash = crypto.createHash("md5");`)).toBe(false);
  });

  it("returns false for any file OUTSIDE the closed set", () => {
    expect(isDetectorPatternLine("src/audit/security/analyzer.ts", `name: "detector"`)).toBe(false);
    expect(isDetectorPatternLine("src/audit/taint/ast-visitor.ts", `pattern: /x/`)).toBe(false);
    expect(isDetectorPatternLine("src/health-auditor.ts", `name: "x"`)).toBe(false);
  });
});

describe("self-exclusion no longer masks real secrets", () => {
  it("detects a REAL hardcoded secret in src/audit/security/analyzer.ts (leak regression)", () => {
    const file = makeFile(
      "src/audit/security/analyzer.ts",
      'export const awsAccessKeyId = "AKIAIOSFODNN7EXAMPLE";',
    );
    const issues = detectHardcodedSecrets("/repo", [file]);
    expect(issues.some((i) => i.type === "hardcoded_secret")).toBe(true);
  });

  it("detects a REAL hardcoded secret in src/audit/taint/analyzer.ts", () => {
    const file = makeFile(
      "src/audit/taint/analyzer.ts",
      'const token = "abcdef0123456789ABCDEF0123456789";',
    );
    const issues = detectHardcodedSecrets("/repo", [file]);
    expect(issues.some((i) => i.type === "hardcoded_secret")).toBe(true);
  });

  it("still skips literal pattern-definition lines in sinks.ts", () => {
    const file = makeFile(
      "src/audit/taint/sinks.ts",
      `export const NOSQL_SINKS: TaintSinkDef[] = [
  { name: "find", kind: "call", severity: 3, issueType: "nosql_injection", description: "collection.find()" },
];`,
    );
    const issues = detectHardcodedSecrets("/repo", [file]);
    expect(issues).toEqual([]);
  });
});
