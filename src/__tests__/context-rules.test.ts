import { describe, it, expect } from "vitest";
import {
  generateContextRules,
  contextRulesToMarkdown,
  type ContextRule,
} from "../domain/rules/context-rules.js";
import type { ProjectFingerprint } from "../infrastructure/project-fingerprint.js";
import type { RiskMap } from "../infrastructure/risk-map.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeFingerprint(overrides: Partial<ProjectFingerprint> = {}): ProjectFingerprint {
  return {
    hash: "abc123",
    detectedAt: "2026-07-08T00:00:00Z",
    domain: "monorepo",
    stack: ["typescript"],
    scale: "medium",
    tooling: {
      typescript: true,
      tests: true,
      ci: false,
      linter: false,
      monorepo: false,
    },
    version: 1,
    ...overrides,
  };
}

function makeRiskMap(overrides: Partial<RiskMap> = {}): RiskMap {
  return {
    overallRisk: "low",
    overallScore: 0,
    summary: "",
    areas: [],
    generatedAt: "2026-07-08T00:00:00Z",
    ...overrides,
  };
}

// ── Risk-based rules ────────────────────────────────────────────────────────

describe("generateContextRules — risk-based", () => {
  it("generates no-tests rule for critical area without test coverage", () => {
    const riskMap = makeRiskMap({
      areas: [
        {
          path: "src",
          score: 75,
          riskLevel: "critical",
          fileCount: 10,
          factors: [
            { type: "no-tests", description: "No test file for src/app.ts", weight: 0.3 },
            { type: "no-tests", description: "No test file for src/utils.ts", weight: 0.3 },
          ],
        },
      ],
    });

    const rules = generateContextRules(makeFingerprint(), riskMap);
    const noTestRule = rules.find((r) => r.id === "risk-notest-src");

    expect(noTestRule).toBeDefined();
    expect(noTestRule!.rule).toContain("2 file(s) without tests");
    expect(noTestRule!.priority).toBe(1);
    expect(noTestRule!.area).toBe("src");
    expect(noTestRule!.basedOn).toBe("risk-map");
  });

  it("generates churn rule for high-churn area", () => {
    const riskMap = makeRiskMap({
      areas: [
        {
          path: "src",
          score: 50,
          riskLevel: "high",
          fileCount: 8,
          factors: [
            { type: "high-churn", description: "High churn detected", weight: 0.2 },
            { type: "high-churn", description: "Frequent changes", weight: 0.2 },
            { type: "high-churn", description: "Many commits", weight: 0.2 },
          ],
        },
      ],
    });

    const rules = generateContextRules(makeFingerprint(), riskMap);
    const churnRule = rules.find((r) => r.id === "risk-churn-src");

    expect(churnRule).toBeDefined();
    expect(churnRule!.rule).toContain("3 frequently changed file(s)");
    expect(churnRule!.priority).toBe(2);
  });

  it("generates large-file rule for area with big files", () => {
    const riskMap = makeRiskMap({
      areas: [
        {
          path: "src",
          score: 45,
          riskLevel: "high",
          fileCount: 6,
          factors: [
            { type: "large-file", description: "app.ts (520 lines)", weight: 0.15 },
            { type: "large-file", description: "utils.ts (410 lines)", weight: 0.15 },
          ],
        },
      ],
    });

    const rules = generateContextRules(makeFingerprint(), riskMap);
    const largeRule = rules.find((r) => r.id === "risk-large-src");

    expect(largeRule).toBeDefined();
    expect(largeRule!.rule).toContain("2 large file(s)");
    expect(largeRule!.priority).toBe(3);
  });

  it("generates sensitive-keyword rule for area with auth/payment/security keywords", () => {
    const riskMap = makeRiskMap({
      areas: [
        {
          path: "src",
          score: 60,
          riskLevel: "high",
          fileCount: 5,
          factors: [
            { type: "sensitive-keyword", description: "auth keyword in auth.ts", weight: 0.25 },
          ],
        },
      ],
    });

    const rules = generateContextRules(makeFingerprint(), riskMap);
    const sensitiveRule = rules.find((r) => r.id === "risk-sensitive-src");

    expect(sensitiveRule).toBeDefined();
    expect(sensitiveRule!.rule).toContain("sensitive keywords");
    expect(sensitiveRule!.priority).toBe(1);
  });

  it("does not generate risk-based rules for low-risk areas", () => {
    const fp = makeFingerprint({ domain: "web-app", scale: "tiny", tooling: { typescript: false, tests: false, ci: false, linter: false, monorepo: false } });
    const riskMap = makeRiskMap({
      areas: [
        {
          path: "docs",
          score: 5,
          riskLevel: "low",
          fileCount: 3,
          factors: [{ type: "no-tests", description: "No test for docs.md", weight: 0.3 }],
        },
      ],
    });

    const rules = generateContextRules(fp, riskMap);
    const riskRules = rules.filter((r) => r.basedOn === "risk-map");
    expect(riskRules).toHaveLength(0);
  });

  it("generates multiple rules for area with multiple risk factors", () => {
    const riskMap = makeRiskMap({
      areas: [
        {
          path: "src",
          score: 80,
          riskLevel: "critical",
          fileCount: 12,
          factors: [
            { type: "no-tests", description: "No tests", weight: 0.3 },
            { type: "large-file", description: "Big file", weight: 0.15 },
            { type: "sensitive-keyword", description: "auth", weight: 0.25 },
          ],
        },
      ],
    });

    const rules = generateContextRules(makeFingerprint(), riskMap);
    const srcRules = rules.filter((r) => r.area === "src");
    expect(srcRules.length).toBe(3);
  });
});

// ── Fingerprint-based rules ─────────────────────────────────────────────────

describe("generateContextRules — fingerprint-based", () => {
  it("generates monorepo rule", () => {
    const fp = makeFingerprint({ domain: "monorepo" });
    const rules = generateContextRules(fp, makeRiskMap());
    const monoRule = rules.find((r) => r.id === "fp-monorepo-packages");

    expect(monoRule).toBeDefined();
    expect(monoRule!.rule).toContain("backward compatibility");
    expect(monoRule!.area).toBe("packages/");
    expect(monoRule!.basedOn).toBe("fingerprint");
  });

  it("generates API rule", () => {
    const fp = makeFingerprint({ domain: "api" });
    const rules = generateContextRules(fp, makeRiskMap());
    const apiRule = rules.find((r) => r.id === "fp-api-contracts");

    expect(apiRule).toBeDefined();
    expect(apiRule!.rule).toContain("backward compatibility");
    expect(apiRule!.area).toBe("src/");
    expect(apiRule!.priority).toBe(1);
  });

  it("generates web-app rule", () => {
    const fp = makeFingerprint({ domain: "web-app" });
    const rules = generateContextRules(fp, makeRiskMap());
    const webRule = rules.find((r) => r.id === "fp-web-perf");

    expect(webRule).toBeDefined();
    expect(webRule!.rule).toContain("bundle size");
    expect(webRule!.area).toBe("src/");
  });

  it("generates scale rule for large/enterprise projects", () => {
    const fp = makeFingerprint({ scale: "large" });
    const rules = generateContextRules(fp, makeRiskMap());
    const scaleRule = rules.find((r) => r.id === "fp-scale-review");

    expect(scaleRule).toBeDefined();
    expect(scaleRule!.rule).toContain("Always run tests");
    expect(scaleRule!.area).toBe("project-wide");
  });

  it("does not generate scale rule for small projects", () => {
    const fp = makeFingerprint({ scale: "small" });
    const rules = generateContextRules(fp, makeRiskMap());
    const scaleRule = rules.find((r) => r.id === "fp-scale-review");

    expect(scaleRule).toBeUndefined();
  });

  it("generates ts+tests tooling rule", () => {
    const fp = makeFingerprint({ tooling: { typescript: true, tests: true, ci: false, linter: false, monorepo: false } });
    const rules = generateContextRules(fp, makeRiskMap());
    const tsRule = rules.find((r) => r.id === "fp-ts-tests");

    expect(tsRule).toBeDefined();
    expect(tsRule!.rule).toContain("type-safe");
  });

  it("does not generate ts+tests rule when tests missing", () => {
    const fp = makeFingerprint({ tooling: { typescript: true, tests: false, ci: false, linter: false, monorepo: false } });
    const rules = generateContextRules(fp, makeRiskMap());
    const tsRule = rules.find((r) => r.id === "fp-ts-tests");

    expect(tsRule).toBeUndefined();
  });
});

// ── Sorting and dedup ──────────────────────────────────────────────────────

describe("generateContextRules — sorting and deduplication", () => {
  it("sorts rules by priority ascending", () => {
    const riskMap = makeRiskMap({
      areas: [
        {
          path: "src",
          score: 75,
          riskLevel: "critical",
          fileCount: 10,
          factors: [
            { type: "no-tests", description: "No tests", weight: 0.3 },
            { type: "large-file", description: "Big file", weight: 0.15 },
            { type: "sensitive-keyword", description: "auth", weight: 0.25 },
          ],
        },
      ],
    });

    const rules = generateContextRules(makeFingerprint(), riskMap);
    const priorities = rules.map((r) => r.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });

  it("deduplicates rules with same id", () => {
    const riskMap = makeRiskMap({
      areas: [
        {
          path: "src",
          score: 75,
          riskLevel: "critical",
          fileCount: 10,
          factors: [
            { type: "no-tests", description: "No tests", weight: 0.3 },
          ],
        },
      ],
    });

    const fp = makeFingerprint({ domain: "monorepo" });
    const rules = generateContextRules(fp, riskMap);
    const ids = rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── Markdown output ─────────────────────────────────────────────────────────

describe("contextRulesToMarkdown", () => {
  it("returns empty string for no rules", () => {
    expect(contextRulesToMarkdown([])).toBe("");
  });

  it("formats single rule as markdown", () => {
    const rules: ContextRule[] = [
      {
        id: "risk-notest-src",
        rule: 'Area "src" has 5 file(s) without tests.',
        rationale: "Missing coverage increases regression risk.",
        priority: 1,
        area: "src",
        basedOn: "risk-map",
      },
    ];

    const md = contextRulesToMarkdown(rules);

    expect(md).toContain("## Context-Aware Rules (Auto-Generated)");
    expect(md).toContain("### risk-notest-src");
    expect(md).toContain('Area "src" has 5 file(s) without tests.');
    expect(md).toContain("Missing coverage increases regression risk.");
    expect(md).toContain("`src`");
    expect(md).toContain("**Priority:** 1");
    expect(md).toContain("risk-map");
  });

  it("formats multiple rules with correct separators", () => {
    const rules: ContextRule[] = [
      {
        id: "rule-1",
        rule: "First rule",
        rationale: "Rationale 1",
        priority: 1,
        area: "src",
        basedOn: "risk-map",
      },
      {
        id: "rule-2",
        rule: "Second rule",
        rationale: "Rationale 2",
        priority: 2,
        area: "packages",
        basedOn: "fingerprint",
      },
    ];

    const md = contextRulesToMarkdown(rules);

    expect(md).toContain("### rule-1");
    expect(md).toContain("### rule-2");
    expect(md).toContain("Rationale 1");
    expect(md).toContain("Rationale 2");
  });
});
