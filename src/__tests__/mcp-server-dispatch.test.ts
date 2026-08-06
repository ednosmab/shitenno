/**
 * mcp-server-dispatch.test.ts — Tests for MCP Server dispatch logic
 *
 * Tests the dispatchTool routing, unknown tool handling, and tool definitions.
 * Uses mocked handlers to isolate the dispatch logic from handler implementations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("../interface/mcp/mcp-server-handlers.js", () => ({
  handleGetBriefing: vi.fn(),
  handleGetRiskMap: vi.fn(),
  handleGetRules: vi.fn(),
  handleGetEngineeringState: vi.fn(),
  handleGetPlans: vi.fn(),
  handleSubmitFeedback: vi.fn(),
  handleGetADRs: vi.fn(),
  handleGetSkills: vi.fn(),
  handleGetKnowledgeDebt: vi.fn(),
  handleGetChallenges: vi.fn(),
  handleGetAuditReport: vi.fn(),
  handleGetEvolution: vi.fn(),
  handleGetMandatoryContext: vi.fn(),
}));

vi.mock("../interface/mcp/backlog-mcp-tools.js", () => ({
  handleGetBacklog: vi.fn(),
  handleAddBacklogItem: vi.fn(),
  handleTransitionBacklogItem: vi.fn(),
  handleDeleteBacklogItem: vi.fn(),
  BACKLOG_MCP_TOOLS: [
    { name: "addBacklogItem", description: "Add item", inputSchema: { type: "object", properties: { id: { type: "string" }, title: { type: "string" } }, required: ["id", "title"] } },
    { name: "transitionBacklogItem", description: "Transition item", inputSchema: { type: "object", properties: { id: { type: "string" }, toState: { type: "string" } }, required: ["id", "toState"] } },
    { name: "deleteBacklogItem", description: "Delete item", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  ],
}));

vi.mock("../application/context-collector.js", () => ({ collectContext: vi.fn() }));
vi.mock("../infrastructure/risk-map.js", () => ({ generateRiskMap: vi.fn() }));
vi.mock("../infrastructure/daemon-client.js", () => ({
  isDaemonRunning: vi.fn(() => false),
  queryDaemon: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("../infrastructure/knowledge-loader.js", () => ({
  listAdrs: vi.fn(() => []),
  getAdr: vi.fn(() => null),
  listSkills: vi.fn(() => []),
  getSkill: vi.fn(() => null),
}));
vi.mock("../application/rule-engine.js", () => ({ loadRules: vi.fn(() => []) }));
vi.mock("../infrastructure/dynamic-rules.js", () => ({ generateDynamicRules: vi.fn(() => []) }));
vi.mock("../infrastructure/rule-manifest.js", () => ({
  loadManifest: vi.fn(() => ({ rules: [] })),
  partitionRules: vi.fn(() => ({ mandatory: [], contextual: [] })),
}));
vi.mock("../infrastructure/skill-manifest.js", () => ({
  loadSkillManifest: vi.fn(() => ({ skills: [] })),
  partitionSkills: vi.fn(() => ({ mandatory: [], contextual: [] })),
}));
vi.mock("../infrastructure/session-feedback.js", () => ({
  readCache: vi.fn(() => null),
  createFileStorage: vi.fn(),
  recordOutcome: vi.fn(),
}));
vi.mock("../application/context-buffer-writer.js", () => ({
  recordSkillResolution: vi.fn(),
}));
vi.mock("../infrastructure/usage-tracker.js", () => ({
  recordToolCall: vi.fn(),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { dispatchTool, TOOLS } from "../interface/mcp/mcp-server.js";
import {
  handleGetBriefing,
  handleGetRiskMap,
  handleGetRules,
  handleGetEngineeringState,
  handleGetPlans,
  handleSubmitFeedback,
  handleGetADRs,
  handleGetSkills,
  handleGetKnowledgeDebt,
  handleGetChallenges,
  handleGetAuditReport,
  handleGetEvolution,
  handleGetMandatoryContext,
} from "../interface/mcp/mcp-server-handlers.js";
import {
  handleGetBacklog,
  handleAddBacklogItem,
  handleTransitionBacklogItem,
  handleDeleteBacklogItem,
} from "../interface/mcp/backlog-mcp-tools.js";

const mockHandleGetBriefing = vi.mocked(handleGetBriefing);
const mockHandleGetRiskMap = vi.mocked(handleGetRiskMap);
const mockHandleGetRules = vi.mocked(handleGetRules);
const mockHandleGetEngineeringState = vi.mocked(handleGetEngineeringState);
const mockHandleGetPlans = vi.mocked(handleGetPlans);
const mockHandleSubmitFeedback = vi.mocked(handleSubmitFeedback);
const mockHandleGetADRs = vi.mocked(handleGetADRs);
const mockHandleGetSkills = vi.mocked(handleGetSkills);
const mockHandleGetKnowledgeDebt = vi.mocked(handleGetKnowledgeDebt);
const mockHandleGetChallenges = vi.mocked(handleGetChallenges);
const mockHandleGetAuditReport = vi.mocked(handleGetAuditReport);
const mockHandleGetEvolution = vi.mocked(handleGetEvolution);
const mockHandleGetMandatoryContext = vi.mocked(handleGetMandatoryContext);
const mockHandleGetBacklog = vi.mocked(handleGetBacklog);
const mockHandleAddBacklogItem = vi.mocked(handleAddBacklogItem);
const mockHandleTransitionBacklogItem = vi.mocked(handleTransitionBacklogItem);
const mockHandleDeleteBacklogItem = vi.mocked(handleDeleteBacklogItem);

const MOCK_RESPONSE = {
  content: [{ type: "text", text: '{"status":"ok"}' }],
};

const PROJECT_ROOT = "/test/project";
const SHITENNO_DIR = "/test/project/.shitenno";
const EMPTY_ARGS: Record<string, unknown> = {};

// ── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockHandleGetBriefing.mockResolvedValue(MOCK_RESPONSE);
  mockHandleGetRiskMap.mockResolvedValue(MOCK_RESPONSE);
  mockHandleGetRules.mockResolvedValue(MOCK_RESPONSE);
  mockHandleGetEngineeringState.mockResolvedValue(MOCK_RESPONSE);
  mockHandleGetPlans.mockReturnValue(MOCK_RESPONSE);
  mockHandleSubmitFeedback.mockReturnValue(MOCK_RESPONSE);
  mockHandleGetADRs.mockResolvedValue(MOCK_RESPONSE);
  mockHandleGetSkills.mockResolvedValue(MOCK_RESPONSE);
  mockHandleGetKnowledgeDebt.mockResolvedValue(MOCK_RESPONSE);
  mockHandleGetChallenges.mockResolvedValue(MOCK_RESPONSE);
  mockHandleGetAuditReport.mockResolvedValue(MOCK_RESPONSE);
  mockHandleGetEvolution.mockResolvedValue(MOCK_RESPONSE);
  mockHandleGetMandatoryContext.mockResolvedValue(MOCK_RESPONSE);
  mockHandleGetBacklog.mockReturnValue(MOCK_RESPONSE);
  mockHandleAddBacklogItem.mockReturnValue(MOCK_RESPONSE);
  mockHandleTransitionBacklogItem.mockReturnValue(MOCK_RESPONSE);
  mockHandleDeleteBacklogItem.mockReturnValue(MOCK_RESPONSE);
});

// ── dispatchTool routing ────────────────────────────────────────────────────

describe("dispatchTool", () => {
  it("routes getBriefing to handleGetBriefing", async () => {
    await dispatchTool("getBriefing", PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
    expect(mockHandleGetBriefing).toHaveBeenCalledWith(PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
  });

  it("routes getRiskMap to handleGetRiskMap", async () => {
    await dispatchTool("getRiskMap", PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
    expect(mockHandleGetRiskMap).toHaveBeenCalledWith(PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
  });

  it("routes getRules to handleGetRules", async () => {
    await dispatchTool("getRules", PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
    expect(mockHandleGetRules).toHaveBeenCalledWith(PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
  });

  it("routes getEngineeringState to handleGetEngineeringState", async () => {
    await dispatchTool("getEngineeringState", PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
    expect(mockHandleGetEngineeringState).toHaveBeenCalledWith(PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
  });

  it("routes getBacklog to handleGetBacklog", async () => {
    await dispatchTool("getBacklog", PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
    expect(mockHandleGetBacklog).toHaveBeenCalledWith(PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
  });

  it("routes getPlans to handleGetPlans", async () => {
    await dispatchTool("getPlans", PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
    expect(mockHandleGetPlans).toHaveBeenCalledWith(PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
  });

  it("routes submitFeedback to handleSubmitFeedback", async () => {
    await dispatchTool("submitFeedback", PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
    expect(mockHandleSubmitFeedback).toHaveBeenCalledWith(PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
  });

  it("routes getADRs to handleGetADRs", async () => {
    await dispatchTool("getADRs", PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
    expect(mockHandleGetADRs).toHaveBeenCalledWith(PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
  });

  it("routes getSkills to handleGetSkills", async () => {
    await dispatchTool("getSkills", PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
    expect(mockHandleGetSkills).toHaveBeenCalledWith(PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
  });

  it("routes addBacklogItem to handleAddBacklogItem", async () => {
    await dispatchTool("addBacklogItem", PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
    expect(mockHandleAddBacklogItem).toHaveBeenCalledWith(PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
  });

  it("routes transitionBacklogItem to handleTransitionBacklogItem", async () => {
    await dispatchTool("transitionBacklogItem", PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
    expect(mockHandleTransitionBacklogItem).toHaveBeenCalledWith(PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
  });

  it("routes deleteBacklogItem to handleDeleteBacklogItem", async () => {
    await dispatchTool("deleteBacklogItem", PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
    expect(mockHandleDeleteBacklogItem).toHaveBeenCalledWith(PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
  });

  it("returns isError for unknown tool", async () => {
    const result = await dispatchTool("nonExistentTool", PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Unknown tool: nonExistentTool");
    expect(result.content[0]?.text).toContain("getBriefing");
  });

  it("returns handler result for valid tool", async () => {
    const result = await dispatchTool("getBriefing", PROJECT_ROOT, SHITENNO_DIR, {});
    expect(result).toEqual(MOCK_RESPONSE);
  });

  it("waits for the ready gate before dispatching tool calls", async () => {
    const { createMcpServer } = await import("../interface/mcp/mcp-server.js");
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");

    let releaseReady!: () => void;
    const readyGate = new Promise<void>((resolve) => {
      releaseReady = resolve;
    });

    const server = createMcpServer(PROJECT_ROOT, SHITENNO_DIR, readyGate);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const serverReady = server.connect(serverTransport).catch(() => {});

    const client = new Client({ name: "test-client", version: "0.0.1" }, { capabilities: {} });
    await client.connect(clientTransport);

    const callPromise = client.callTool({ name: "getBriefing", arguments: {} });
    await new Promise((r) => setTimeout(r, 25));
    expect(mockHandleGetBriefing).not.toHaveBeenCalled();

    releaseReady();
    await callPromise;
    expect(mockHandleGetBriefing).toHaveBeenCalledWith(PROJECT_ROOT, SHITENNO_DIR, EMPTY_ARGS);

    await client.close();
    await serverReady;
  });

  it("returns isError for another unknown tool", async () => {
    const result = await dispatchTool("xyz123", PROJECT_ROOT, SHITENNO_DIR, {});
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Unknown tool: xyz123");
  });
});

// ── TOOLS definitions ───────────────────────────────────────────────────────

describe("TOOLS definitions", () => {
  it("includes all standard tools", () => {
    const toolNames = TOOLS.map((t) => t.name);
    expect(toolNames).toContain("getBriefing");
    expect(toolNames).toContain("getRiskMap");
    expect(toolNames).toContain("getRules");
    expect(toolNames).toContain("getEngineeringState");
    expect(toolNames).toContain("getBacklog");
    expect(toolNames).toContain("getPlans");
    expect(toolNames).toContain("submitFeedback");
    expect(toolNames).toContain("getADRs");
    expect(toolNames).toContain("getSkills");
  });

  it("includes backlog write tools", () => {
    const toolNames = TOOLS.map((t) => t.name);
    expect(toolNames).toContain("addBacklogItem");
    expect(toolNames).toContain("transitionBacklogItem");
    expect(toolNames).toContain("deleteBacklogItem");
  });

  it("each tool has name, description, and inputSchema", () => {
    for (const tool of TOOLS) {
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("inputSchema");
      expect(tool.inputSchema).toHaveProperty("type", "object");
      expect(tool.inputSchema).toHaveProperty("properties");
    }
  });

  it("getBriefing has format, depth, and task properties", () => {
    const tool = TOOLS.find((t) => t.name === "getBriefing");
    expect(tool?.inputSchema.properties).toHaveProperty("format");
    expect(tool?.inputSchema.properties).toHaveProperty("depth");
    expect(tool?.inputSchema.properties).toHaveProperty("task");
  });

  it("getBacklog has state, priority, includeDone, and format properties", () => {
    const tool = TOOLS.find((t) => t.name === "getBacklog");
    expect(tool?.inputSchema.properties).toHaveProperty("state");
    expect(tool?.inputSchema.properties).toHaveProperty("priority");
    expect(tool?.inputSchema.properties).toHaveProperty("includeDone");
    expect(tool?.inputSchema.properties).toHaveProperty("format");
  });

  it("addBacklogItem requires id and title", () => {
    const tool = TOOLS.find((t) => t.name === "addBacklogItem");
    expect(tool?.inputSchema.required).toContain("id");
    expect(tool?.inputSchema.required).toContain("title");
  });

  it("submitFeedback requires outcome and notes", () => {
    const tool = TOOLS.find((t) => t.name === "submitFeedback");
    expect(tool?.inputSchema.required).toContain("outcome");
    expect(tool?.inputSchema.required).toContain("notes");
  });
});

// ── Server creation ─────────────────────────────────────────────────────────

describe("createMcpServer", () => {
  it("creates a server without throwing", async () => {
    const { createMcpServer } = await import("../interface/mcp/mcp-server.js");
    expect(() => createMcpServer(PROJECT_ROOT, SHITENNO_DIR)).not.toThrow();
  });

  it("creates a server with default shitenno dir", async () => {
    const { createMcpServer } = await import("../interface/mcp/mcp-server.js");
    expect(() => createMcpServer(PROJECT_ROOT)).not.toThrow();
  });

  it("returns a Server instance", async () => {
    const { createMcpServer } = await import("../interface/mcp/mcp-server.js");
    const server = createMcpServer(PROJECT_ROOT, SHITENNO_DIR);
    expect(server).toBeDefined();
  });
});
