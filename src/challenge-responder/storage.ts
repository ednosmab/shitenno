/**
 * challenge-responder/storage.ts — Daemon state read/write for challenges
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../shared/logger.js";

const DAEMON_STATE_FILE = "daemon-state.json";

export function getDaemonStatePath(shitennoDir: string): string {
  return join(shitennoDir, "daemon", DAEMON_STATE_FILE);
}

export function readDaemonState(shitennoDir: string): Record<string, unknown> | null {
  const statePath = getDaemonStatePath(shitennoDir);
  if (!existsSync(statePath)) {
    logger.debug("challenge-responder", `Daemon state file not found: ${statePath}`);
    return null;
  }
  try {
    const content = readFileSync(statePath, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch (error) {
    logger.warn("challenge-responder", `Failed to parse daemon state: ${error}`);
    return null;
  }
}

export function writeDaemonState(shitennoDir: string, state: Record<string, unknown>): void {
  const statePath = getDaemonStatePath(shitennoDir);
  const dir = join(shitennoDir, "daemon");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
}
