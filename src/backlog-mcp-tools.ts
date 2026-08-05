/**
 * backlog-mcp-tools.ts — MCP tools for backlog read/write operations
 *
 * Adds 3 write tools to the MCP server:
 *   - addBacklogItem: Create a new backlog item
 *   - transitionBacklogItem: Change item state with validation
 *   - deleteBacklogItem: Remove an item from the backlog
 *
 * Also updates getBacklog to use the unified parser and include summary.
 */

import { existsSync } from "node:fs";
import {
  parseBacklogWithIntegrity,
  addItem,
  deleteItem,
  transitionItem,
  getBacklogSummary,
  resolveBacklogPaths,
  normalizeState,
  getAllowedTransitions,
  formatSummaryLine,
  type BacklogPriority,
  type BacklogSeverity,
  type BacklogItem,
} from "./backlog-core.js";

import type { ToolResponse } from "./mcp-types.js";

// ── getBacklog (enhanced) ─────────────────────────────────────────────────

/**
 * Enhanced getBacklog handler using the unified parser.
 * Supports state/priority filters and returns summary stats.
 */
export function handleGetBacklog(
  _projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const paths = resolveBacklogPaths(shitennoDir);
  const activeParsed = parseBacklogWithIntegrity(paths.active);
  let items = activeParsed.items;
  const integrityIssues = [...activeParsed.issues];

  // Also load done items if requested
  const includeDone = args.includeDone === true;
  if (includeDone && paths.done) {
    const doneParsed = parseBacklogWithIntegrity(paths.done);
    items = [...items, ...doneParsed.items];
    integrityIssues.push(...doneParsed.issues);
  }

  // Apply filters
  if (args.state && typeof args.state === "string") {
    const normalized = normalizeState(args.state);
    if (normalized) {
      items = items.filter((item) => item.state === normalized);
    }
  }

  if (args.priority && typeof args.priority === "string") {
    const p = args.priority.toUpperCase();
    items = items.filter((item) => item.priority === p);
  }

  // Adaptive recommend mode: suggest next items based on context
  if (args.recommend === true) {
    items = recommendNextItems(items, shitennoDir);
  }

  // Include summary stats
  const summary = getBacklogSummary(items);

  const format = (args.format as string) ?? "json";

  if (format === "summary") {
    const lines = [
      formatSummaryLine(summary),
      ...(integrityIssues.length > 0
        ? [`⚠ ${integrityIssues.length} bloco(s) sem header "### " ignorado(s) — ver integrityIssues (format=json)`]
        : []),
      "",
      ...items.map((item) => `  ${item.id} [${item.state}] — ${item.title}`),
    ];
    return { content: [{ type: "text", text: lines.join("\n") }] };
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify({ summary, items, integrityIssues }, null, 2),
    }],
  };
}

function recommendNextItems(items: BacklogItem[], _shitennoDir: string): BacklogItem[] {
  const active = items.filter((i) => i.state === "em implementação" || i.state === "em investigação");
  if (active.length > 0) return active;

  const p0 = items.filter((i) => i.priority === "P0");
  if (p0.length > 0) return p0;

  const p1Planeado = items.filter((i) => i.priority === "P1" && i.state === "planeado");
  if (p1Planeado.length > 0) return p1Planeado;

  return items.filter((i) => i.state === "planeado").slice(0, 5);
}

// ── addBacklogItem ─────────────────────────────────────────────────────────

/**
 * MCP tool: Add a new backlog item.
 */
export function handleAddBacklogItem(
  _projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const id = args.id as string;
  const title = args.title as string;

  if (!id || !title) {
    return {
      content: [{ type: "text", text: "Error: 'id' and 'title' are required." }],
      isError: true,
    };
  }

  const paths = resolveBacklogPaths(shitennoDir);
  const backlogExistedBefore = existsSync(paths.active);
  const result = addItem(paths.active, {
    id,
    title,
    state: normalizeState(args.state as string || "planeado") || "planeado",
    priority: (args.priority as string || "P2").toUpperCase() as BacklogPriority,
    severity: (args.severity as string || "Medio") as BacklogSeverity,
    owner: args.owner as string,
    description: args.description as string,
    source: (args.source as string) || "mcp",
  });

  const text = !backlogExistedBefore
    ? `⚠️ Backlog file did not exist and was recreated. ${result.message}`
    : result.message;
  return {
    content: [{ type: "text", text }],
    isError: !result.success,
  };
}

// ── transitionBacklogItem ──────────────────────────────────────────────────

/**
 * MCP tool: Transition a backlog item to a new state.
 * Validates the transition and returns allowed next states on failure.
 */
export function handleTransitionBacklogItem(
  _projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const id = args.id as string;
  const toStateRaw = args.toState as string;

  if (!id || !toStateRaw) {
    return {
      content: [{ type: "text", text: "Error: 'id' and 'toState' are required." }],
      isError: true,
    };
  }

  const toState = normalizeState(toStateRaw);
  if (!toState) {
    return {
      content: [{ type: "text", text: `Error: Invalid state "${toStateRaw}". Valid: planeado, em investigação, em implementação, em validação, pausado, adiado, concluído, encerrado` }],
      isError: true,
    };
  }

  const paths = resolveBacklogPaths(shitennoDir);
  const result = transitionItem(paths.active, id, toState);

  // On failure, include allowed transitions for guidance
  if (!result.success && result.previousState) {
    const allowed = getAllowedTransitions(result.previousState);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: result.message,
          currentState: result.previousState,
          allowedTransitions: allowed,
        }, null, 2),
      }],
      isError: true,
    };
  }

  return {
    content: [{ type: "text", text: result.message }],
    isError: !result.success,
  };
}

// ── deleteBacklogItem ──────────────────────────────────────────────────────

/**
 * MCP tool: Delete a backlog item by ID.
 */
export function handleDeleteBacklogItem(
  _projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): ToolResponse {
  const id = args.id as string;

  if (!id) {
    return {
      content: [{ type: "text", text: "Error: 'id' is required." }],
      isError: true,
    };
  }

  const paths = resolveBacklogPaths(shitennoDir);
  const result = deleteItem(paths.active, id);

  return {
    content: [{ type: "text", text: result.message }],
    isError: !result.success,
  };
}

// ── MCP Tool Definitions ───────────────────────────────────────────────────

export const BACKLOG_MCP_TOOLS = [
  {
    name: "addBacklogItem",
    description: "Add a new item to the project backlog. Requires id and title.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string" as const, description: "Unique item ID (e.g. BACKLOG-001)" },
        title: { type: "string" as const, description: "Item title" },
        state: { type: "string" as const, description: "Initial state (default: planeado)", enum: ["planeado", "em investigação", "em implementação", "em validação", "pausado", "adiado"] },
        priority: { type: "string" as const, description: "Priority level", enum: ["P0", "P1", "P2", "P3"] },
        severity: { type: "string" as const, description: "Severity level", enum: ["Critico", "Alto", "Medio", "Baixo"] },
        owner: { type: "string" as const, description: "Assigned owner" },
        description: { type: "string" as const, description: "Detailed description" },
        source: { type: "string" as const, description: "Source of the item (e.g. audit, manual)" },
      },
      required: ["id", "title"],
    },
  },
  {
    name: "transitionBacklogItem",
    description: "Transition a backlog item to a new state. Validates the transition against the state machine.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string" as const, description: "Item ID to transition" },
        toState: { type: "string" as const, description: "Target state", enum: ["planeado", "em investigação", "em implementação", "em validação", "pausado", "adiado", "concluído", "encerrado"] },
      },
      required: ["id", "toState"],
    },
  },
  {
    name: "deleteBacklogItem",
    description: "Remove an item from the backlog by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string" as const, description: "Item ID to delete" },
      },
      required: ["id"],
    },
  },
];
