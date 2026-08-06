/**
 * mcp-consolidation.ts — Background engineering-state consolidation for MCP
 *
 * The MCP stdio handshake must respond quickly. Heavy engineering-state
 * consolidation (analyseProject, detectKnowledgeDebt, discoverAssets,
 * knowledge-graph, entropy) can exceed 30s on a cold cache, which times out
 * the client. This module schedules that work in a detached child process so
 * it never blocks the MCP server's event loop. The resolved promise acts as a
 * "ready gate" for tool dispatch.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../../shared/logger.js";

const CONSOLIDATION_TIMEOUT_MS = 30_000;

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the shugo CLI entry script so a background child can be spawned.
 * Works in bundled (dist/bin/shugo.js) and dev (tsx via bin/shugo.ts) modes.
 */
function resolveShugoEntry(): string | null {
  const bundled = join(__dirname, "shugo.js");
  if (existsSync(bundled)) return bundled;
  const dev = join(__dirname, "..", "..", "..", "bin", "shugo.ts");
  if (existsSync(dev)) return dev;
  return null;
}

/**
 * Schedule engineering-state consolidation in a detached child process.
 *
 * Returns a promise that resolves when the child exits (or after a timeout),
 * used as a ready gate so tool dispatch never runs before state is fresh and
 * never triggers an in-process consolidation that would block the server.
 */
export function scheduleConsolidation(projectRoot: string, shitennoDir: string): Promise<void> {
  if (!projectRoot || !shitennoDir) return Promise.resolve();

  const entry = resolveShugoEntry();
  if (!entry) {
    logger.debug("mcp-consolidation", "Could not resolve shugo entry; skipping background consolidation");
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(
        process.execPath,
        [entry, "mcp", "--consolidate-only", "--dir", projectRoot, shitennoDir],
        {
          detached: true,
          stdio: "ignore",
          cwd: projectRoot,
          env: { ...process.env, SHITENNO_CHILD: "1", SHITENNO_QUIET: "1" },
        },
      );
    } catch (error) {
      logger.debug("mcp-consolidation", `Failed to spawn background consolidation: ${String(error)}`);
      resolve();
      return;
    }

    child.unref();

    const timer = setTimeout(() => resolve(), CONSOLIDATION_TIMEOUT_MS);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.once("error", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
