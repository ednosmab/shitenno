import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../context-collector.js", () => ({
  collectContext: vi.fn(),
}));

vi.mock("../briefing-cache.js", () => ({
  computeRequestHash: vi.fn(() => "test-hash"),
  setCachedBriefing: vi.fn(),
  getCachedBriefingByRequest: vi.fn(() => null),
}));

vi.mock("../daemon-client.js", () => ({
  queryDaemon: vi.fn(),
  isDaemonRunning: vi.fn(() => false),
}));

vi.mock("../skill-manifest.js", () => ({
  loadSkillManifest: vi.fn(),
  partitionSkills: vi.fn(() => ({ mandatory: [], optional: [] })),
}));

vi.mock("../knowledge-loader.js", () => ({
  getSkill: vi.fn(),
}));

vi.mock("../context-buffer-writer.js", () => ({
  recordSkillResolution: vi.fn(),
}));

vi.mock("./rules.js", () => ({
  loadMandatoryRulesWithContent: vi.fn(() => []),
}));

vi.mock("../cache-metrics.js", () => ({
  recordHit: vi.fn(),
  recordMiss: vi.fn(),
}));

import { collectContext } from "../context-collector.js";
import { handleGetBriefing } from "../mcp-handlers/briefing.js";
import { setCachedBriefing } from "../briefing-cache.js";

const mockCollectContext = vi.mocked(collectContext);
const mockSetCachedBriefing = vi.mocked(setCachedBriefing);

const MOCK_BRIEFING = {
  generatedAt: "2026-08-01T00:00:00.000Z",
  project: {
    domain: "test",
    scale: "small",
    stack: ["typescript"],
    maturityScore: 50,
  },
  risks: {
    overall: "low",
    criticalAreas: [],
    highAreas: [],
  },
  tests: {
    hasTests: true,
    areasWithoutTests: [],
  },
  patterns: { recurringErrors: [], hotAreas: [], detected: [] },
  contextRules: [],
  dynamicRules: [],
  recommendations: [],
  tokenEconomy: {
    estimatedTokensSaved: 0,
    cacheHit: false,
    contextRuleCount: 0,
    dynamicRuleCount: 0,
  },
  quickBoard: {
    currentTask: "Test task",
    nextP0: "Test P0",
    p1Debts: "None",
    impediments: "None",
    lastSessionStatus: "completed",
  },
  reminders: [],
};

beforeEach(() => {
  mockCollectContext.mockReturnValue({
    briefing: MOCK_BRIEFING as any,
    fingerprint: "",
    contextRules: [],
    dynamicRules: [],
  } as any);
});

describe("getBriefing markdown — Quick Board contract", () => {
  it("includes QUICK BOARD section with all 5 expected fields", async () => {
    const result = await handleGetBriefing("/project", "/project/.shitenno", {
      format: "markdown",
    });
    const text = result.content[0]!.text as string;

    expect(text).toContain("## QUICK BOARD — Estado do Projecto");
    for (const field of [
      "Tarefa em curso",
      "Próximo P0",
      "Dívidas P1",
      "Impedimentos",
      "Estado última sessão",
    ]) {
      expect(text).toContain(field);
    }
  });

  it("writes briefing cache for markdown format (not only json)", async () => {
    await handleGetBriefing("/project", "/project/.shitenno", { format: "markdown" });
    expect(mockSetCachedBriefing).toHaveBeenCalledWith(
      "/project/.shitenno",
      MOCK_BRIEFING,
      expect.any(String)
    );
  });

  it("writes briefing cache for summary format (not only json)", async () => {
    await handleGetBriefing("/project", "/project/.shitenno", { format: "summary" });
    expect(mockSetCachedBriefing).toHaveBeenCalledWith(
      "/project/.shitenno",
      MOCK_BRIEFING,
      expect.any(String)
    );
  });
});
