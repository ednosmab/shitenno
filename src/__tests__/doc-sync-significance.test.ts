import { describe, it, expect, beforeEach } from "vitest";
import {
  detectArtifactType,
  detectDirectoryScore,
  calculateFrequencyScore,
  calculateSizeScore,
  calculateSignificance,
  ChangeHistoryTracker,
  type ChangeFrequency,
} from "../doc-sync-significance.js";

const SHUGO = "/project/shitenno";

// ── detectArtifactType ─────────────────────────────────────────────────────

describe("detectArtifactType", () => {
  it("detects skill files", () => {
    expect(detectArtifactType(`${SHUGO}/docs/skills/tdd.md`, SHUGO)).toBe("skill");
  });

  it("detects ADR files", () => {
    expect(detectArtifactType(`${SHUGO}/docs/adrs/ADR-001.md`, SHUGO)).toBe("adr");
  });

  it("detects workflow files", () => {
    expect(detectArtifactType(`${SHUGO}/governance/WORKFLOW.md`, SHUGO)).toBe("workflow");
  });

  it("detects rule files", () => {
    expect(detectArtifactType(`${SHUGO}/governance/rules/RULE-001.json`, SHUGO)).toBe("rule");
  });

  it("detects agent config files", () => {
    expect(detectArtifactType(`${SHUGO}/governance/agents/planner.yaml`, SHUGO)).toBe("config");
  });

  it("detects generic governance docs", () => {
    expect(detectArtifactType(`${SHUGO}/governance/policies/BRANCH.md`, SHUGO)).toBe("doc");
  });

  it("detects generic docs", () => {
    expect(detectArtifactType(`${SHUGO}/docs/README.md`, SHUGO)).toBe("doc");
  });

  it("detects script files", () => {
    expect(detectArtifactType(`${SHUGO}/scripts/close-session.ts`, SHUGO)).toBe("script");
  });

  it("detects telemetry files", () => {
    expect(detectArtifactType(`${SHUGO}/telemetry/log.json`, SHUGO)).toBe("telemetry");
  });

  it("detects report files", () => {
    expect(detectArtifactType(`${SHUGO}/reports/weekly.md`, SHUGO)).toBe("report");
  });

  it("detects feedback files", () => {
    expect(detectArtifactType(`${SHUGO}/feedback/2026-07-08.md`, SHUGO)).toBe("feedback");
  });

  it("detects session-feedback files", () => {
    expect(detectArtifactType(`${SHUGO}/session-feedback/notes.md`, SHUGO)).toBe("feedback");
  });

  it("detects core config files", () => {
    expect(detectArtifactType(`${SHUGO}/core/complexity/types.ts`, SHUGO)).toBe("config");
  });

  it("detects cognition docs", () => {
    expect(detectArtifactType(`${SHUGO}/cognition/context/HIERARCHY.md`, SHUGO)).toBe("doc");
  });

  it("detects JSON files as config", () => {
    expect(detectArtifactType(`${SHUGO}/some/path.json`, SHUGO)).toBe("config");
  });

  it("detects YAML files as config", () => {
    expect(detectArtifactType(`${SHUGO}/some/path.yaml`, SHUGO)).toBe("config");
  });

  it("detects .md files as doc", () => {
    expect(detectArtifactType(`${SHUGO}/some/file.md`, SHUGO)).toBe("doc");
  });

  it("detects .ts files as script", () => {
    expect(detectArtifactType(`${SHUGO}/some/file.ts`, SHUGO)).toBe("script");
  });

  it("returns unknown for unrecognized files", () => {
    expect(detectArtifactType(`${SHUGO}/some/file.xyz`, SHUGO)).toBe("unknown");
  });
});

// ── detectDirectoryScore ───────────────────────────────────────────────────

describe("detectDirectoryScore", () => {
  it("returns 1.0 for docs/skills/", () => {
    expect(detectDirectoryScore(`${SHUGO}/docs/skills/tdd.md`, SHUGO)).toBe(1.0);
  });

  it("returns 0.9 for docs/adrs/", () => {
    expect(detectDirectoryScore(`${SHUGO}/docs/adrs/ADR-001.md`, SHUGO)).toBe(0.9);
  });

  it("returns 0.9 for governance/agents/", () => {
    expect(detectDirectoryScore(`${SHUGO}/governance/agents/planner.yaml`, SHUGO)).toBe(0.9);
  });

  it("returns 1.0 for governance/WORKFLOW", () => {
    expect(detectDirectoryScore(`${SHUGO}/governance/WORKFLOW.md`, SHUGO)).toBe(1.0);
  });

  it("returns 0.7 for governance/rules/", () => {
    expect(detectDirectoryScore(`${SHUGO}/governance/rules/RULE-001.json`, SHUGO)).toBe(0.7);
  });

  it("returns 0.0 for telemetry/", () => {
    expect(detectDirectoryScore(`${SHUGO}/telemetry/log.json`, SHUGO)).toBe(0.0);
  });

  it("returns 0.0 for reports/", () => {
    expect(detectDirectoryScore(`${SHUGO}/reports/weekly.md`, SHUGO)).toBe(0.0);
  });

  it("returns 0.1 for unmatched paths", () => {
    expect(detectDirectoryScore(`${SHUGO}/unknown/file.txt`, SHUGO)).toBe(0.1);
  });

  it("scores files inside docs/generated/ as zero significance (BUG-002)", () => {
    expect(detectDirectoryScore(`${SHUGO}/docs/generated/ARCHITECTURE.md`, SHUGO)).toBe(0.0);
  });

  it("docs/generated/ takes priority over the generic docs/ prefix", () => {
    const generatedScore = detectDirectoryScore(`${SHUGO}/docs/generated/ANYTHING.md`, SHUGO);
    const genericDocsScore = detectDirectoryScore(`${SHUGO}/docs/some-other-file.md`, SHUGO);
    expect(generatedScore).toBeLessThan(genericDocsScore);
  });

  it("matches longest prefix first", () => {
    expect(detectDirectoryScore(`${SHUGO}/governance/context/state.yaml`, SHUGO)).toBe(0.6);
  });
});

// ── calculateFrequencyScore ────────────────────────────────────────────────

describe("calculateFrequencyScore", () => {
  it("returns 0.2 for expired window", () => {
    const history: ChangeFrequency = {
      count: 10,
      windowStart: Date.now() - 120_000,
      lastChange: Date.now() - 120_000,
    };
    expect(calculateFrequencyScore(history)).toBe(0.2);
  });

  it("returns 0.2 for single change in window", () => {
    const history: ChangeFrequency = {
      count: 1,
      windowStart: Date.now(),
      lastChange: Date.now(),
    };
    expect(calculateFrequencyScore(history)).toBe(0.2);
  });

  it("returns 0.5 for 2-5 changes", () => {
    const history: ChangeFrequency = {
      count: 3,
      windowStart: Date.now(),
      lastChange: Date.now(),
    };
    expect(calculateFrequencyScore(history)).toBe(0.5);
  });

  it("returns 0.8 for 6-10 changes", () => {
    const history: ChangeFrequency = {
      count: 8,
      windowStart: Date.now(),
      lastChange: Date.now(),
    };
    expect(calculateFrequencyScore(history)).toBe(0.8);
  });

  it("returns 1.0 for 11+ changes", () => {
    const history: ChangeFrequency = {
      count: 15,
      windowStart: Date.now(),
      lastChange: Date.now(),
    };
    expect(calculateFrequencyScore(history)).toBe(1.0);
  });
});

// ── calculateSizeScore ─────────────────────────────────────────────────────

describe("calculateSizeScore", () => {
  it("returns 0.5 for small new file (<20 lines)", () => {
    const content = Array.from({ length: 10 }, (_, i) => `line ${i}`).join("\n");
    expect(calculateSizeScore(null, content)).toBe(0.5);
  });

  it("returns 0.8 for medium new file (20-99 lines)", () => {
    const content = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    expect(calculateSizeScore(null, content)).toBe(0.8);
  });

  it("returns 1.0 for large new file (100+ lines)", () => {
    const content = Array.from({ length: 150 }, (_, i) => `line ${i}`).join("\n");
    expect(calculateSizeScore(null, content)).toBe(1.0);
  });

  it("returns 0.2 for small change (<5 lines diff)", () => {
    const old = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    const newC = Array.from({ length: 53 }, (_, i) => `line ${i}`).join("\n");
    expect(calculateSizeScore(old, newC)).toBe(0.2);
  });

  it("returns 0.5 for medium change (5-19 lines diff)", () => {
    const old = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    const newC = Array.from({ length: 65 }, (_, i) => `line ${i}`).join("\n");
    expect(calculateSizeScore(old, newC)).toBe(0.5);
  });

  it("returns 0.8 for large change (20-99 lines diff)", () => {
    const old = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    const newC = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
    expect(calculateSizeScore(old, newC)).toBe(0.8);
  });

  it("returns 1.0 for massive change (100+ lines diff)", () => {
    const old = Array.from({ length: 10 }, (_, i) => `line ${i}`).join("\n");
    const newC = Array.from({ length: 200 }, (_, i) => `line ${i}`).join("\n");
    expect(calculateSizeScore(old, newC)).toBe(1.0);
  });
});

// ── calculateSignificance ──────────────────────────────────────────────────

describe("calculateSignificance", () => {
  it("returns high significance for skill file with frequent changes", () => {
    const highFreq: ChangeFrequency = { count: 12, windowStart: Date.now(), lastChange: Date.now() };
    const result = calculateSignificance({
      filePath: `${SHUGO}/docs/skills/tdd.md`, shitennoDir: SHUGO, oldContent: null,
      newContent: Array.from({ length: 200 }, (_, i) => `line ${i}`).join("\n"),
      frequency: highFreq,
    });
    expect(result.level).toBe("high");
    expect(result.shouldSync).toBe(true);
    expect(result.outputLevel).toBe("verbose");
    expect(result.score).toBeGreaterThanOrEqual(0.8);
  });

  it("returns ignore for telemetry file with no changes", () => {
    const result = calculateSignificance({
      filePath: `${SHUGO}/telemetry/log.json`, shitennoDir: SHUGO, oldContent: "old", newContent: "old",
      frequency: { count: 1, windowStart: Date.now() - 120_000, lastChange: Date.now() - 120_000 },
    });
    expect(result.level).toBe("ignore");
    expect(result.shouldSync).toBe(false);
    expect(result.outputLevel).toBe("silent");
  });

  it("returns low/medium for moderate changes", () => {
    const result = calculateSignificance({
      filePath: `${SHUGO}/docs/README.md`, shitennoDir: SHUGO, oldContent: "old\n".repeat(10),
      newContent: "new\n".repeat(15),
      frequency: { count: 3, windowStart: Date.now(), lastChange: Date.now() },
    });
    expect(["low", "medium"]).toContain(result.level);
    expect(result.shouldSync).toBe(true);
  });

  it("populates reasons array for significant factors", () => {
    const highFreq: ChangeFrequency = { count: 8, windowStart: Date.now(), lastChange: Date.now() };
    const result = calculateSignificance({
      filePath: `${SHUGO}/docs/skills/test.md`, shitennoDir: SHUGO, oldContent: null,
      newContent: Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n"),
      frequency: highFreq,
    });
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("score is between 0 and 1", () => {
    const result = calculateSignificance({
      filePath: `${SHUGO}/governance/rules/RULE-001.json`, shitennoDir: SHUGO,
      oldContent: "a\n".repeat(5), newContent: "b\n".repeat(25),
      frequency: { count: 6, windowStart: Date.now(), lastChange: Date.now() },
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it("does not trigger sync for files inside docs/generated/ (BUG-002, full pipeline)", () => {
    const tracker = new ChangeHistoryTracker();
    const filePath = `${SHUGO}/docs/generated/ARCHITECTURE.md`;

    const result = calculateSignificance({
      filePath,
      shitennoDir: SHUGO,
      oldContent: null,
      newContent: "# Conteúdo gerado\n".repeat(50),
      frequency: tracker.recordChange(filePath),
    });

    expect(result.shouldSync).toBe(false);
    expect(result.level).toBe("ignore");
  });
});

// ── ChangeHistoryTracker ───────────────────────────────────────────────────

describe("ChangeHistoryTracker", () => {
  let tracker: ChangeHistoryTracker;

  beforeEach(() => {
    tracker = new ChangeHistoryTracker();
  });

  it("records first change with count 1", () => {
    const freq = tracker.recordChange("file.md");
    expect(freq.count).toBe(1);
  });

  it("increments count for same file in same window", () => {
    tracker.recordChange("file.md");
    tracker.recordChange("file.md");
    tracker.recordChange("file.md");
    const freq = tracker.getFrequency("file.md");
    expect(freq.count).toBe(3);
  });

  it("returns default frequency for unknown file", () => {
    const freq = tracker.getFrequency("unknown.md");
    expect(freq.count).toBe(0);
  });

  it("clears all history", () => {
    tracker.recordChange("file.md");
    tracker.clear();
    const freq = tracker.getFrequency("file.md");
    expect(freq.count).toBe(0);
  });

  it("tracks different files independently", () => {
    tracker.recordChange("a.md");
    tracker.recordChange("a.md");
    tracker.recordChange("b.md");
    expect(tracker.getFrequency("a.md").count).toBe(2);
    expect(tracker.getFrequency("b.md").count).toBe(1);
  });
});
