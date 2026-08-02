/**
 * mcp-types.ts — Shared MCP Types
 *
 * Canonical ToolResponse type used by all MCP handlers.
 */

export interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}
