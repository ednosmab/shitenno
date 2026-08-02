import { describe, it, expect } from "vitest";
import {
  generateBriefing,
  briefingToJson,
  briefingToSummary,
  generateDiff,
  briefingToMarkdown,
  type Briefing,
} from "../briefing.js";

function makeBriefing(overrides: Partial<Briefing> = {}): Briefing {
  const defaults: Briefing = {
    generatedAt: "2026-07-08T00:00:00Z",
    project: {
      domain: "monorepo",
      scale: "medium",
      stack: ["react", "typescript"],
      maturityScore: 73,
    },
    risks: {
      overall: "critical",
      criticalAreas: ["src"],
      highAreas: ["apps"],
    },
    tests: {
      hasTests: true,
      areasWithoutTests: ["src", "apps"],
    },
    patterns: {
      recurringErrors: [],
      hotAreas: ["src"],
      detected: [],
    },
    contextRules: [
      { id: "ctx-1", rule: "Rule 1", rationale: "test", priority: 1, area: "src", basedOn: "risk-map" },
    ],
    dynamicRules: [
      { id: "dyn-1", rule: "Dynamic 1", severity: "high", source: "git-incident", evidence: "test", generatedAt: "2026-07-08", incidentCount: 1 },
    ],
    recommendations: ["Fix src"],
    tokenEconomy: {
      estimatedTokensSaved: 8800,
      cacheHit: false,
      contextRuleCount: 1,
      dynamicRuleCount: 1,
    },
    quickBoard: {
      currentTask: "Nenhuma",
      nextP0: "Definir novo P0 no BACKLOG.md",
      p1Debts: "Nenhuma",
      impediments: "Nenhum",
      lastSessionStatus: "Desconhecido",
    },
    reminders: [],
  };
  return { ...defaults, ...overrides };
}

function makeFingerprint() {
  return {
    domain: "monorepo",
    scale: "medium",
    stack: ["react", "typescript"],
    tooling: { tests: true, linter: true, formatter: true, bundler: "vite" },
  };
}

function makeRiskMap() {
  return {
    overallRisk: "critical",
    areas: [
      {
        path: "src",
        riskLevel: "critical" as const,
        score: 0.9,
        factors: [
          { type: "no-tests" as const, description: "src", weight: 0.5, severity: "critical" as const },
          { type: "high-churn" as const, description: "src", weight: 0.3, severity: "high" as const },
        ],
      },
      {
        path: "apps",
        riskLevel: "high" as const,
        score: 0.6,
        factors: [
          { type: "no-tests" as const, description: "apps", weight: 0.4, severity: "high" as const },
        ],
      },
    ],
  };
}

// ── generateBriefing ───────────────────────────────────────────────────────

describe("generateBriefing", () => {
  it("populates project from fingerprint", () => {
    const b = generateBriefing({ fingerprint: makeFingerprint() as any, riskMap: makeRiskMap() as any, contextRules: [], dynamicRules: [] });
    expect(b.project.domain).toBe("monorepo");
    expect(b.project.scale).toBe("medium");
    expect(b.project.stack).toEqual(["react", "typescript"]);
  });

  it("extracts critical areas from risk map", () => {
    const b = generateBriefing({ fingerprint: makeFingerprint() as any, riskMap: makeRiskMap() as any, contextRules: [], dynamicRules: [] });
    expect(b.risks.criticalAreas).toEqual(["src"]);
    expect(b.risks.highAreas).toEqual(["apps"]);
  });

  it("extracts areas without tests from risk factors", () => {
    const b = generateBriefing({ fingerprint: makeFingerprint() as any, riskMap: makeRiskMap() as any, contextRules: [], dynamicRules: [] });
    expect(b.tests.areasWithoutTests).toContain("src");
    expect(b.tests.areasWithoutTests).toContain("apps");
  });

  it("generates recommendations based on risks", () => {
    const b = generateBriefing({ fingerprint: makeFingerprint() as any, riskMap: makeRiskMap() as any, contextRules: [], dynamicRules: [] });
    expect(b.recommendations.some((r) => r.includes("src"))).toBe(true);
  });

  it("generates healthy recommendation when no issues", () => {
    const emptyRisk = { overallRisk: "low", areas: [] };
    const b = generateBriefing({ fingerprint: makeFingerprint() as any, riskMap: emptyRisk as any, contextRules: [], dynamicRules: [] });
    expect(b.recommendations.some((r) => r.includes("healthy"))).toBe(true);
  });

  it("includes maturity score when provided", () => {
    const profile = { overallScore: 73, recommendedCapabilities: ["test-coverage"] };
    const b = generateBriefing({ fingerprint: makeFingerprint() as any, riskMap: makeRiskMap() as any, contextRules: [], dynamicRules: [], maturityProfile: profile as any });
    expect(b.project.maturityScore).toBe(73);
    expect(b.recommendations.some((r) => r.includes("test-coverage"))).toBe(true);
  });

  it("uses default quickBoard when not provided", () => {
    const b = generateBriefing({ fingerprint: makeFingerprint() as any, riskMap: makeRiskMap() as any, contextRules: [], dynamicRules: [] });
    expect(b.quickBoard?.currentTask).toBe("Nenhuma");
  });

  it("passes through quickBoard when provided", () => {
    const qb = { currentTask: "Tarefa X", nextP0: "P0-1", p1Debts: "none", impediments: "none", lastSessionStatus: "ok" };
    const b = generateBriefing({ fingerprint: makeFingerprint() as any, riskMap: makeRiskMap() as any, contextRules: [], dynamicRules: [], quickBoard: qb });
    expect(b.quickBoard?.currentTask).toBe("Tarefa X");
  });

  it("defaults reminders to empty array", () => {
    const b = generateBriefing({ fingerprint: makeFingerprint() as any, riskMap: makeRiskMap() as any, contextRules: [], dynamicRules: [] });
    expect(b.reminders).toEqual([]);
  });

  it("passes through reminders", () => {
    const reminder = { message: "rem1", priority: "medium" as const, category: "feature" as const, createdAt: "2026-07-08" };
    const b = generateBriefing({ fingerprint: makeFingerprint() as any, riskMap: makeRiskMap() as any, contextRules: [], dynamicRules: [], reminders: [reminder] });
    expect(b.reminders).toHaveLength(1);
    const [first] = b.reminders;
    expect(first?.message).toBe("rem1");
  });

  it("estimates token savings based on rules count", () => {
    const rules = [
      { id: "r1", rule: "R1", rationale: "", priority: 1, area: "a", basedOn: "risk-map" as const },
      { id: "r2", rule: "R2", rationale: "", priority: 2, area: "b", basedOn: "risk-map" as const },
    ];
    const b = generateBriefing({ fingerprint: makeFingerprint() as any, riskMap: makeRiskMap() as any, contextRules: rules, dynamicRules: [] });
    expect(b.tokenEconomy.estimatedTokensSaved).toBeGreaterThan(8000);
    expect(b.tokenEconomy.contextRuleCount).toBe(2);
  });

  it("detects hot areas from high-churn factors", () => {
    const b = generateBriefing({ fingerprint: makeFingerprint() as any, riskMap: makeRiskMap() as any, contextRules: [], dynamicRules: [] });
    expect(b.patterns.hotAreas).toContain("src");
  });
});

// ── briefingToJson ─────────────────────────────────────────────────────────

describe("briefingToJson", () => {
  it("returns a plain object with expected keys", () => {
    const json = briefingToJson(makeBriefing());
    expect(json.generatedAt).toBe("2026-07-08T00:00:00Z");
    expect(json.project).toBeDefined();
    expect(json.risks).toBeDefined();
    expect(json.contextRules).toBeDefined();
    expect(json.dynamicRules).toBeDefined();
    expect(json.recommendations).toBeDefined();
  });

  it("maps context rules to simplified format", () => {
    const json = briefingToJson(makeBriefing());
    const rules = json.contextRules as any[];
    expect(rules[0]).toHaveProperty("id");
    expect(rules[0]).toHaveProperty("rule");
    expect(rules[0]).not.toHaveProperty("source");
  });

  it("maps dynamic rules to simplified format", () => {
    const json = briefingToJson(makeBriefing());
    const rules = json.dynamicRules as any[];
    expect(rules[0]).toHaveProperty("severity");
    expect(rules[0]).not.toHaveProperty("source");
  });
});

// ── briefingToSummary ──────────────────────────────────────────────────────

describe("briefingToSummary", () => {
  it("returns a single line with key info", () => {
    const summary = briefingToSummary(makeBriefing());
    expect(summary).toContain("Domain: monorepo");
    expect(summary).toContain("Scale: medium");
    expect(summary).toContain("Risk: critical");
  });

  it("includes critical areas when present", () => {
    const summary = briefingToSummary(makeBriefing());
    expect(summary).toContain("Critical: src");
  });

  it("omits critical section when empty", () => {
    const b = makeBriefing({ risks: { overall: "low", criticalAreas: [], highAreas: [] } });
    const summary = briefingToSummary(b);
    expect(summary).not.toContain("Critical:");
  });

  it("includes no-tests count", () => {
    const summary = briefingToSummary(makeBriefing());
    expect(summary).toContain("No-tests: 2 area(s)");
  });

  it("includes token savings", () => {
    const summary = briefingToSummary(makeBriefing());
    expect(summary).toContain("Tokens saved:");
  });
});

// ── generateDiff ───────────────────────────────────────────────────────────

describe("generateDiff", () => {
  it("reports no changes for identical briefings", () => {
    const b = makeBriefing();
    const diff = generateDiff(b, b);
    expect(diff).toContain("No changes detected");
  });

  it("detects risk level change", () => {
    const old = makeBriefing({ risks: { overall: "low", criticalAreas: [], highAreas: [] } });
    const now = makeBriefing({ risks: { overall: "critical", criticalAreas: ["src"], highAreas: [] } });
    const diff = generateDiff(old, now);
    expect(diff).toContain("Risk level changed: low → critical");
  });

  it("detects new critical area", () => {
    const old = makeBriefing({ risks: { overall: "low", criticalAreas: [], highAreas: [] } });
    const now = makeBriefing({ risks: { overall: "critical", criticalAreas: ["src"], highAreas: [] } });
    const diff = generateDiff(old, now);
    expect(diff).toContain("+ New critical area: src");
  });

  it("detects removed critical area", () => {
    const old = makeBriefing({ risks: { overall: "critical", criticalAreas: ["src"], highAreas: [] } });
    const now = makeBriefing({ risks: { overall: "low", criticalAreas: [], highAreas: [] } });
    const diff = generateDiff(old, now);
    expect(diff).toContain("- Removed critical area: src");
  });

  it("detects new area without tests", () => {
    const old = makeBriefing({ tests: { hasTests: true, areasWithoutTests: [] } });
    const now = makeBriefing({ tests: { hasTests: true, areasWithoutTests: ["apps"] } });
    const diff = generateDiff(old, now);
    expect(diff).toContain("+ New area without tests: apps");
  });

  it("detects area now has tests", () => {
    const old = makeBriefing({ tests: { hasTests: true, areasWithoutTests: ["src"] } });
    const now = makeBriefing({ tests: { hasTests: true, areasWithoutTests: [] } });
    const diff = generateDiff(old, now);
    expect(diff).toContain("- Area now has tests: src");
  });

  it("detects new context rule", () => {
    const old = makeBriefing({ contextRules: [] });
    const now = makeBriefing({ contextRules: [{ id: "r2", rule: "New rule", rationale: "", priority: 1, area: "a", basedOn: "risk-map" }] });
    const diff = generateDiff(old, now);
    expect(diff).toContain("+ New rule: [a] New rule");
  });

  it("detects new dynamic rule", () => {
    const old = makeBriefing({ dynamicRules: [] });
    const now = makeBriefing({ dynamicRules: [{ id: "d2", rule: "New dynamic", severity: "medium", source: "history-analysis", evidence: "", generatedAt: "2026-07-08", incidentCount: 0 }] });
    const diff = generateDiff(old, now);
    expect(diff).toContain("+ New dynamic rule: [medium] New dynamic");
  });

  it("detects new recommendation", () => {
    const old = makeBriefing({ recommendations: [] });
    const now = makeBriefing({ recommendations: ["New rec"] });
    const diff = generateDiff(old, now);
    expect(diff).toContain("+ New recommendation: New rec");
  });
});

// ── briefingToMarkdown ─────────────────────────────────────────────────────

describe("briefingToMarkdown", () => {
  it("includes quick board table when present", () => {
    const md = briefingToMarkdown(makeBriefing());
    expect(md).toContain("QUICK BOARD");
    expect(md).toContain("Tarefa em curso");
  });

  it("omits quick board when not present", () => {
    const b = makeBriefing({ quickBoard: undefined });
    const md = briefingToMarkdown(b);
    expect(md).not.toContain("QUICK BOARD");
  });

  it("includes project identity section", () => {
    const md = briefingToMarkdown(makeBriefing());
    expect(md).toContain("## Project Identity");
    expect(md).toContain("**Domain:** monorepo");
  });

  it("includes risk status section", () => {
    const md = briefingToMarkdown(makeBriefing());
    expect(md).toContain("## Risk Status");
    expect(md).toContain("**Critical:** src");
  });

  it("includes test coverage section", () => {
    const md = briefingToMarkdown(makeBriefing());
    expect(md).toContain("## Test Coverage");
    expect(md).toContain("**Has Tests:** Yes");
  });

  it("includes context rules section when present", () => {
    const md = briefingToMarkdown(makeBriefing());
    expect(md).toContain("## Context Rules (Top)");
    expect(md).toContain("Rule 1");
  });

  it("omits context rules section when empty", () => {
    const b = makeBriefing({ contextRules: [] });
    const md = briefingToMarkdown(b);
    expect(md).not.toContain("## Context Rules");
  });

  it("includes dynamic rules section when present", () => {
    const md = briefingToMarkdown(makeBriefing());
    expect(md).toContain("## Dynamic Rules (From History)");
  });

  it("includes recommendations section", () => {
    const md = briefingToMarkdown(makeBriefing());
    expect(md).toContain("## Recommended Next Steps");
  });

  it("includes token economy section", () => {
    const md = briefingToMarkdown(makeBriefing());
    expect(md).toContain("## Token Economy");
    expect(md).toContain("**Cache hit:** No");
  });

  it("includes reminders when present", () => {
    const reminder = { message: "Test reminder", priority: "high" as const, category: "bug" as const, createdAt: "2026-07-08" };
    const b = makeBriefing({ reminders: [reminder] } as any);
    const md = briefingToMarkdown(b);
    expect(md).toContain("## Active Reminders");
    expect(md).toContain("Test reminder");
  });

  it("omits reminders when empty", () => {
    const md = briefingToMarkdown(makeBriefing());
    expect(md).not.toContain("## Active Reminders");
  });
});
