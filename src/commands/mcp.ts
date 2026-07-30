/**
 * mcp.ts — MCP Server CLI Command
 *
 * The `shugo mcp` command. Starts an MCP server over stdio
 * for AI agents to consume project context.
 *
 * Usage:
 *   shugo mcp                    # Start MCP server
 */

import { Command } from "commander";
import chalk from "chalk";
import { join } from "node:path";
import { startMcpServer, TOOLS } from "../mcp-server.js";
import { consolidateEngineeringState } from "../engineering-state.js";
import { SHITENNO_DIR_NAME } from "../constants.js";
import { outputError } from "../output.js";

async function startServerAction(projectRoot: string, shitennoDir: string): Promise<void> {
  const toolNames = TOOLS.map((t) => t.name).join(", ");
  console.error(chalk.dim(`  shitenno-mcp: Starting MCP server over stdio...`));
  console.error(chalk.dim(`  Tools: ${toolNames}`));
  try {
    await startMcpServer(projectRoot, shitennoDir);
  } catch (error) {
    console.error(chalk.red(`  MCP server error: ${error instanceof Error ? error.message : String(error)}`));
    process.exitCode = 1;
  }
}

export function mcpCommand(): Command {
  const cmd = new Command("mcp")
    .description("MCP server for AI agents (Model Context Protocol)")
    .option("-d, --dir <path>", "Project root directory")
    .action(async (options: Record<string, unknown>) => {
      const projectRoot = (options.dir as string) ?? process.cwd();
      const shitennoDir = join(projectRoot, SHITENNO_DIR_NAME);
      try {
        consolidateEngineeringState(projectRoot, shitennoDir);
      } catch {
        outputError(
          chalk.red(
            `  Error: Shugo not initialized in ${projectRoot}. Run 'shugo init' first.`
          )
        );
        process.exitCode = 1;
        return;
      }
      await startServerAction(projectRoot, shitennoDir);
    });

  return cmd;
}
