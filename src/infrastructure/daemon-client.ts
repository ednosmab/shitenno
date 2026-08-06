/**
 * daemon-client.ts — Daemon Lifecycle Client
 *
 * Provides functions to start, stop, ping, and query the Shugo daemon.
 * Respects SHITENNO_NO_DAEMON and CI environment variables.
 *
 * PRINCIPLE: The daemon is opt-in. The CLI always works without it.
 */

import { existsSync } from "node:fs";
import { getApprovedPath } from "../daemon-client/paths.js";
import { queryDaemon } from "../daemon-client/ipc.js";

export { getPidPath, getSocketPath, getApprovedPath } from "../daemon-client/paths.js";
export { getDaemonPid, isDaemonRunning, startDaemon, stopDaemon } from "../daemon-client/process.js";
export { queryDaemon, queryDaemonWithFallback, queryDaemonStatus, queryDaemonHealth } from "../daemon-client/ipc.js";
export type { DaemonStatusResponse, DaemonHealthResponse, TimerInfoResponse } from "../daemon-client/ipc.js";

export async function pingDaemon(shitennoDir: string): Promise<boolean> {
  const result = await queryDaemon<{ type: string }>(shitennoDir, { type: "ping" }, 2_000);
  return result?.type === "pong";
}

/**
 * Returns true if the daemon should be bypassed.
 */
export function shouldSkipDaemon(): boolean {
  return (
    process.env["SHITENNO_NO_DAEMON"] === "1" ||
    process.env["CI"] === "true" ||
    process.env["SHITENNO_CHILD"] === "1"
  );
}

export function isDaemonApproved(shitennoDir: string): boolean {
  return existsSync(getApprovedPath(shitennoDir));
}
