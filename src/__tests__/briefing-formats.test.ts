import { describe, it, expect } from "vitest";
import { briefingToJson, briefingToSummary, generateDiff, type Briefing, type Reminder } from "../application/briefing.js";

function makeReminder(overrides?: Partial<Reminder>): Reminder {
  return {
    message: "Test reminder",
    priority: "medium",
    category: "feature",
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeBriefing(overrides?: Partial<Briefing>): Briefing {
  return {
    generatedAt: "2024-01-01T00:00:00Z",
    project: {
      domain: "web-app",
      scale: "medium",
      stack: ["react", "typescript"],
      maturityScore: 65,
    },
    risks: {
      overall: "medium",
      criticalAreas: [],
      highAreas: ["src/payments"],
    },
    tests: {
      hasTests: true,
      areasWithoutTests: ["src/utils"],
    },
    patterns: {
      recurringErrors: [],
      hotAreas: ["src/payments"],
      detected: [],
    },
    contextRules: [
      { id: "rule-1", rule: "Test rule", rationale: "Because", priority: 1, area: "src/", basedOn: "risk-map" },
    ],
    dynamicRules: [
      { id: "dyn-1", rule: "Dynamic rule", source: "git-incident", severity: "high", evidence: "Force push", generatedAt: "2024-01-01", incidentCount: 1 },
    ],
    recommendations: ["Address critical areas", "Improve test coverage"],
    tokenEconomy: {
      estimatedTokensSaved: 8800,
      cacheHit: false,
      contextRuleCount: 1,
      dynamicRuleCount: 1,
    },
    reminders: [],
    ...overrides,
  } as Briefing;
}

describe("briefing output formats", () => {
  describe("briefingToJson", () => {
    it("returns a structured object", () => {
      const briefing = makeBriefing();
      const json = briefingToJson(briefing);

      expect(json.generatedAt).toBe("2024-01-01T00:00:00Z");
      expect(json.project).toEqual(briefing.project);
      expect(json.risks).toEqual(briefing.risks);
      expect(json.recommendations).toEqual(briefing.recommendations);
    });

    it("strips detailed rule fields", () => {
      const briefing = makeBriefing();
      const json = briefingToJson(briefing);

      const contextRules = json.contextRules as Array<Record<string, unknown>>;
      expect(contextRules[0]).toHaveProperty("id");
      expect(contextRules[0]).toHaveProperty("rule");
      expect(contextRules[0]).not.toHaveProperty("rationale");
    });
  });

  describe("briefingToSummary", () => {
    it("returns a one-line summary", () => {
      const briefing = makeBriefing();
      const summary = briefingToSummary(briefing);

      expect(typeof summary).toBe("string");
      expect(summary).toContain("Domain: web-app");
      expect(summary).toContain("Scale: medium");
      expect(summary).toContain("Risk: medium");
      expect(summary).toContain("Recommendations: 2");
    });

    it("includes critical areas when present", () => {
      const briefing = makeBriefing({
        risks: { overall: "critical", criticalAreas: ["src/auth"], highAreas: [] },
      });
      const summary = briefingToSummary(briefing);
      expect(summary).toContain("Critical: src/auth");
    });

    it("includes no-tests count", () => {
      const briefing = makeBriefing();
      const summary = briefingToSummary(briefing);
      expect(summary).toContain("No-tests: 1 area(s)");
    });
  });

  describe("generateDiff", () => {
    it("detects no changes", () => {
      const briefing = makeBriefing();
      const diff = generateDiff(briefing, briefing);
      expect(diff).toContain("No changes detected");
    });

    it("detects risk level change", () => {
      const old = makeBriefing({ risks: { overall: "low", criticalAreas: [], highAreas: [] } });
      const new_ = makeBriefing({ risks: { overall: "high", criticalAreas: [], highAreas: [] } });
      const diff = generateDiff(old, new_);
      expect(diff).toContain("Risk level changed: low → high");
    });

    it("detects new critical area", () => {
      const old = makeBriefing({ risks: { overall: "low", criticalAreas: [], highAreas: [] } });
      const new_ = makeBriefing({ risks: { overall: "critical", criticalAreas: ["src/auth"], highAreas: [] } });
      const diff = generateDiff(old, new_);
      expect(diff).toContain("+ New critical area: src/auth");
    });

    it("detects removed critical area", () => {
      const old = makeBriefing({ risks: { overall: "critical", criticalAreas: ["src/auth"], highAreas: [] } });
      const new_ = makeBriefing({ risks: { overall: "low", criticalAreas: [], highAreas: [] } });
      const diff = generateDiff(old, new_);
      expect(diff).toContain("- Removed critical area: src/auth");
    });

    it("detects new area without tests", () => {
      const old = makeBriefing({ tests: { hasTests: true, areasWithoutTests: [] } });
      const new_ = makeBriefing({ tests: { hasTests: true, areasWithoutTests: ["src/new"] } });
      const diff = generateDiff(old, new_);
      expect(diff).toContain("+ New area without tests: src/new");
    });

    it("detects new context rule", () => {
      const old = makeBriefing({ contextRules: [] });
      const new_ = makeBriefing({
        contextRules: [{ id: "rule-new", rule: "New rule", rationale: "", priority: 1, area: "src/", basedOn: "risk-map" }],
      });
      const diff = generateDiff(old, new_);
      expect(diff).toContain("+ New rule:");
    });

    it("detects new dynamic rule", () => {
      const old = makeBriefing({ dynamicRules: [] });
      const new_ = makeBriefing({
        dynamicRules: [{ id: "dyn-new", rule: "New dynamic", source: "git-incident", severity: "high", evidence: "", generatedAt: "", incidentCount: 1 }],
      });
      const diff = generateDiff(old, new_);
      expect(diff).toContain("+ New dynamic rule:");
    });

    it("detects new recommendation", () => {
      const old = makeBriefing({ recommendations: ["Old rec"] });
      const new_ = makeBriefing({ recommendations: ["Old rec", "New rec"] });
      const diff = generateDiff(old, new_);
      expect(diff).toContain("+ New recommendation: New rec");
    });
  });

  describe("reminders with priority and category", () => {
    it("includes reminders in briefing", () => {
      const reminders: Reminder[] = [
        makeReminder({ message: "Fix bug", priority: "high", category: "bug" }),
        makeReminder({ message: "Add feature", priority: "low", category: "feature" }),
      ];
      const briefing = makeBriefing({ reminders });
      expect(briefing.reminders).toHaveLength(2);
      expect(briefing.reminders[0]!.message).toBe("Fix bug");
      expect(briefing.reminders[0]!.priority).toBe("high");
      expect(briefing.reminders[0]!.category).toBe("bug");
    });

    it("handles empty reminders", () => {
      const briefing = makeBriefing({ reminders: [] });
      expect(briefing.reminders).toHaveLength(0);
    });
  });
});
