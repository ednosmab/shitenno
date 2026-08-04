/**
 * commands/init/mcp.ts — MCP configuration functions
 *
 * Extracted from commands/init.ts to keep modules focused.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import fse from "fs-extra";
import { NPM_PACKAGE_NAME } from "../../constants.js";
const { copySync } = fse;

// ── MCP Configuration ───────────────────────────────────────────────────────

/**
 * Resolve the command that runs the shugo MCP server.
 *
 * Default: `shugo` resolved via PATH (global install — the common case).
 * Fallback: the relative local binary when shugo is actually installed as a
 * local dependency of the target project (node_modules or dist).
 */
export function resolveMcpCommand(targetDir: string): { command: string; args: string[] } {
  const candidates = [
    join(targetDir, "node_modules", NPM_PACKAGE_NAME, "dist", "bin", "shugo.js"),
    join(targetDir, "dist", "bin", "shugo.js"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return { command: `./${relative(targetDir, candidate)}`, args: ["mcp"] };
    }
  }
  return { command: "shugo", args: ["mcp"] };
}

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
  const shitennoMcpEntry = { "shitenno-mcp": resolveMcpCommand(targetDir) };

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
