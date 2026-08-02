/**
 * commands/init/mcp.ts — MCP configuration functions
 *
 * Extracted from commands/init.ts to keep modules focused.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import fse from "fs-extra";
const { copySync } = fse;

// ── MCP Configuration ───────────────────────────────────────────────────────

export function mergeMcpJson(
  mcpJsonPath: string,
  entry: Record<string, { command: string; args: string[] }>,
): void {
  try {
    const existing = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
    if (!existing.mcpServers) existing.mcpServers = {};
    existing.mcpServers["shitenno-mcp"] = entry["shitenno-mcp"];
    writeFileSync(mcpJsonPath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
  } catch {
    const merged = { mcpServers: { ...entry } };
    writeFileSync(mcpJsonPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");
  }
}

export function generateMcpJson(
  targetDir: string,
  result: { filesCreated: string[] },
): void {
  const mcpJsonPath = join(targetDir, ".mcp.json");
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const mcpTemplatePath = join(currentDir, "..", "..", "templates", "base", ".mcp.json");
  const shitennoMcpEntry = { "shitenno-mcp": { command: "shugo", args: ["mcp"] } };

  if (existsSync(mcpJsonPath)) {
    mergeMcpJson(mcpJsonPath, shitennoMcpEntry);
  } else if (existsSync(mcpTemplatePath)) {
    copySync(mcpTemplatePath, mcpJsonPath);
  } else {
    const content = { mcpServers: shitennoMcpEntry };
    writeFileSync(mcpJsonPath, JSON.stringify(content, null, 2) + "\n", "utf-8");
  }
  result.filesCreated.push(".mcp.json");
}
