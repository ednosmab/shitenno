/**
 * mcp-server.ts — MCP Server for Shugo Context Pipeline
 *
 * Thin facade — handlers split into mcp-server-handlers.ts.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
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
} from "./mcp-server-handlers.js";

// Re-export handlers for test compatibility
export {
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
};
import {
  handleGetBacklog,
  handleAddBacklogItem,
  handleTransitionBacklogItem,
  handleDeleteBacklogItem,
  BACKLOG_MCP_TOOLS,
} from "./backlog-mcp-tools.js";

import type { ToolResponse } from "./mcp-types.js";

export const TOOLS = [
  {
    name: "getBriefing",
    description:
      "Generate a pre-session briefing for the project. Includes project identity, " +
      "risk status, test coverage, context rules, dynamic rules, and recommendations. " +
      "Pass `task` (e.g. implementation, refactor) to auto-attach mandatory skills for that scope.",
    inputSchema: {
      type: "object" as const,
      properties: {
        format: { type: "string" as const, enum: ["json", "markdown", "summary"], description: "Output format." },
        depth: { type: "string" as const, enum: ["minimal", "standard", "full"], description: "Briefing depth." },
        task: { type: "string" as const, description: "e.g. implementation, refactor, audit, infra — used to resolve mandatory skills." },
      },
    },
  },
  {
    name: "getRiskMap",
    description: "Generate a risk map of the project. Analyses test coverage, code churn, file sizes, import complexity, and sensitive keywords.",
    inputSchema: {
      type: "object" as const,
      properties: { format: { type: "string" as const, enum: ["json", "summary"], description: "Output format." } },
    },
  },
  {
    name: "getRules",
    description: "Get governance rules for the project.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: { type: "string" as const, enum: ["all", "context", "dynamic", "engine"], description: "Which rules to return." },
        format: { type: "string" as const, enum: ["json", "markdown"], description: "Output format." },
      },
    },
  },
  {
    name: "getEngineeringState",
    description: "Get the current engineering state of the project.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "getBacklog",
    description: "Get the current active tasks and backlog items. Supports filtering by state and priority. Returns summary stats.",
    inputSchema: {
      type: "object" as const,
      properties: {
        state: { type: "string" as const, description: "Optional filter by state." },
        priority: { type: "string" as const, description: "Optional filter by priority (P0, P1, P2, P3)." },
        includeDone: { type: "boolean" as const, description: "Include done items." },
        format: { type: "string" as const, enum: ["json", "summary"], description: "Output format." },
      },
    },
  },
  {
    name: "getPlans",
    description: "List active architectural plans or read a specific plan.",
    inputSchema: {
      type: "object" as const,
      properties: { planName: { type: "string" as const, description: "Optional plan filename." } },
    },
  },
  {
    name: "submitFeedback",
    description: "Submit feedback on an executed task.",
    inputSchema: {
      type: "object" as const,
      properties: {
        outcome: { type: "string" as const, enum: ["success", "failure", "partial"], description: "Outcome." },
        notes: { type: "string" as const, description: "Detailed notes." },
      },
      required: ["outcome", "notes"],
    },
  },
  {
    name: "getADRs",
    description: "List Architecture Decision Records, or get the full content of one by id (e.g. 'ADR-008')",
    inputSchema: {
      type: "object" as const,
      properties: { id: { type: "string" as const, description: "Optional ADR id (e.g. 'ADR-008'). If omitted, lists all ADRs." } },
    },
  },
  {
    name: "getSkills",
    description:
      "Get skills. Pass `name` for a specific skill, or `task`/`language`/`framework`/`layer` " +
      "to resolve which skills are mandatory or relevant for that scope of work — mandatory " +
      "skills are returned in full, others as pointers.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const, description: "Specific skill name or filename." },
        task: { type: "string" as const, description: "e.g. implementation, refactor, audit, infra." },
        language: { type: "string" as const },
        framework: { type: "string" as const },
        layer: { type: "string" as const, description: "e.g. frontend, backend, daemon, cli." },
      },
    },
  },
  ...BACKLOG_MCP_TOOLS,
  {
    name: "getKnowledgeDebt",
    description: "Analyse knowledge debt in the project. Detects missing ADRs, runbooks, skills, docs, automation, contracts, workflows, and stale ADRs. Returns gaps, severity, health score, and recommendations.",
    inputSchema: {
      type: "object" as const,
      properties: {
        format: { type: "string" as const, enum: ["json", "summary"], description: "Output format." },
      },
    },
  },
  {
    name: "getChallenges",
    description: "Generate challenge alternatives for current recommendations. Shows paradigm shifts that push beyond comfortable thinking. Requires a growth profile (run shugo assess first).",
    inputSchema: {
      type: "object" as const,
      properties: {
        format: { type: "string" as const, enum: ["json", "summary"], description: "Output format." },
      },
    },
  },
  {
    name: "getAuditReport",
    description: "Read the latest health audit report. Shows health score, dimension scores, issues by severity, and optimizations. Run 'shugo audit' first to generate a report.",
    inputSchema: {
      type: "object" as const,
      properties: {
        format: { type: "string" as const, enum: ["json", "summary"], description: "Output format." },
        date: { type: "string" as const, description: "Optional date filter (YYYY-MM-DD). If omitted, returns the latest report." },
      },
    },
  },
  {
    name: "getEvolution",
    description: "Read maturity evolution history. Shows score trends, dimension changes, and capability additions over time. Run 'shugo assess' multiple times to build history.",
    inputSchema: {
      type: "object" as const,
      properties: {
        format: { type: "string" as const, enum: ["json", "summary"], description: "Output format." },
      },
    },
  },
  {
    name: "getMandatoryContext",
    description: "Return the full mandatory context for the current session: MANDATORY_CONTEXT.md, context_buffer.yaml, mandatory rules, and unconditional mandatory skills.",
    inputSchema: {
      type: "object" as const,
      properties: {
        format: { type: "string" as const, enum: ["markdown", "json"], description: "Output format." },
        task: { type: "string" as const, description: "Optional task scope (e.g. implementation, refactor) to resolve task-scoped mandatory skills." },
      },
    },
  },
];

export async function dispatchTool(
  name: string,
  projectRoot: string,
  shitennoDir: string,
  toolArgs: Record<string, unknown>
): Promise<ToolResponse> {
  try {
    switch (name) {
      case "getBriefing":
        return await handleGetBriefing(projectRoot, shitennoDir, toolArgs);
      case "getRiskMap":
        return await handleGetRiskMap(projectRoot, shitennoDir, toolArgs);
      case "getRules":
        return await handleGetRules(projectRoot, shitennoDir, toolArgs);
      case "getEngineeringState":
        return await handleGetEngineeringState(projectRoot, shitennoDir, toolArgs);
      case "getBacklog":
        return handleGetBacklog(projectRoot, shitennoDir, toolArgs);
      case "getPlans":
        return handleGetPlans(projectRoot, shitennoDir, toolArgs);
      case "submitFeedback":
        return handleSubmitFeedback(projectRoot, shitennoDir, toolArgs);
      case "getADRs":
        return await handleGetADRs(projectRoot, shitennoDir, toolArgs);
      case "getSkills":
        return await handleGetSkills(projectRoot, shitennoDir, toolArgs);
      case "addBacklogItem":
        return handleAddBacklogItem(projectRoot, shitennoDir, toolArgs);
      case "transitionBacklogItem":
        return handleTransitionBacklogItem(projectRoot, shitennoDir, toolArgs);
      case "deleteBacklogItem":
        return handleDeleteBacklogItem(projectRoot, shitennoDir, toolArgs);
      case "getKnowledgeDebt":
        return handleGetKnowledgeDebt(projectRoot, shitennoDir, toolArgs);
      case "getChallenges":
        return handleGetChallenges(projectRoot, shitennoDir, toolArgs);
      case "getAuditReport":
        return handleGetAuditReport(projectRoot, shitennoDir, toolArgs);
      case "getEvolution":
        return handleGetEvolution(projectRoot, shitennoDir, toolArgs);
      case "getMandatoryContext":
        return handleGetMandatoryContext(projectRoot, shitennoDir, toolArgs);
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}. Available: ${TOOLS.map((t) => t.name).join(", ")}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
      isError: true,
    };
  }
}

export function createMcpServer(projectRoot: string, shitennoDir?: string): Server {
  const resolvedShitennoDir = shitennoDir ?? `${projectRoot}/shitenno`;

  const server = new Server(
    { name: "shitenno-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  // Required by MCP SDK type signature
  server.setRequestHandler(CallToolRequestSchema, async (request, _extra) => {
    const { name, arguments: args } = request.params;
    const toolArgs = (args ?? {}) as Record<string, unknown>;
    try {
      return await dispatchTool(name, projectRoot, resolvedShitennoDir, toolArgs) as unknown as Record<string, unknown>;
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      } as unknown as Record<string, unknown>;
    }
  });

  return server;
}

export async function startMcpServer(projectRoot: string, shitennoDir?: string): Promise<void> {
  const server = createMcpServer(projectRoot, shitennoDir);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
