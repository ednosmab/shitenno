/**
 * mcp.ts — MCP Server CLI Command
 *
 * The `shugo mcp` command. Starts an MCP server over stdio
 * for AI agents to consume project context.
 *
 * Usage:
 *   shugo mcp                    # Start MCP server
 *
 * Internal:
 *   shugo mcp --consolidate-only --dir <root> <shitennoDir>
 *                                # Consolidate engineering state and exit
 *                                # (spawned in background by the MCP server)
 */

import { Command } from "commander";
import chalk from "chalk";
import { join } from "node:path";
import { startMcpServer, TOOLS } from "../mcp-server.js";
import { scheduleConsolidation } from "../mcp-consolidation.js";
import { consolidateEngineeringState } from "../engineering-state.js";
import { isInitialized } from "../engineering-state/index.js";
import { SHITENNO_DIR_NAME } from "../constants.js";
import { outputError } from "../output.js";
import { logger } from "../logger.js";

async function startServerAction(projectRoot: string, shitennoDir: string): Promise<void> {
  logger.info("mcp", `Starting MCP server over stdio...`);
  logger.info("mcp", `Project: ${projectRoot}`);
  logger.info("mcp", `Tools (${TOOLS.length}):`);
  for (const tool of TOOLS) {
    const desc = tool.description.split(".")[0];
    logger.info("mcp", `  - ${tool.name}: ${desc}`);
  }
  try {
    const readyPromise = scheduleConsolidation(projectRoot, shitennoDir);
    await startMcpServer(projectRoot, shitennoDir, readyPromise);
  } catch (error) {
    logger.error("mcp", `MCP server error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

export function mcpCommand(): Command {
  const cmd = new Command("mcp")
    .description("MCP server for AI agents (Model Context Protocol)")
    .option("-d, --dir <path>", "Project root directory")
    .option("--consolidate-only", "Internal: consolidate engineering state and exit")
    .argument("[stateDir]", "Internal: shitenno dir for consolidation (consolidate-only mode)")
    .action(async (stateDir: string | undefined, options: Record<string, unknown>) => {
      const projectRoot = (options.dir as string) ?? process.cwd();
      const shitennoDir = stateDir ?? join(projectRoot, SHITENNO_DIR_NAME);

      if (options.consolidateOnly) {
        try {
          consolidateEngineeringState(projectRoot, shitennoDir);
        } catch {
          // best-effort: background child, parent MCP server continues regardless
        }
        return;
      }

      if (!isInitialized(shitennoDir)) {
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
