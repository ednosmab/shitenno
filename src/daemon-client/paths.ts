/**
 * daemon-client/paths.ts — Path constants for daemon files
 */

import { join } from "node:path";

export function getPidPath(shitennoDir: string): string {
  return join(shitennoDir, "daemon", "daemon.pid");
}

export function getSocketPath(shitennoDir: string): string {
  return join(shitennoDir, "daemon", "daemon.sock");
}

export function getApprovedPath(shitennoDir: string): string {
  return join(shitennoDir, "daemon", "daemon.approved");
}
