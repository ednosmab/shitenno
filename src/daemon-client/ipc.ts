/**
 * daemon-client/ipc.ts — IPC query functions for daemon communication
 */

import { existsSync, readFileSync } from "node:fs";
import { createConnection } from "node:net";
import { getSocketPath, getPidPath } from "./paths.js";

const DEFAULT_QUERY_TIMEOUT_MS = 1_500;

export interface TimerInfoResponse {
  lastFiredAt: string | null;
  intervalMs: number;
  nextFireAt: string | null;
}

export interface DaemonStatusResponse {
  type: string;
  pid: number;
  version: string;
  shitennoDir: string;
  socketPath: string;
  uptimeSeconds: number;
  eventsRecorded: number;
  activeSessions: number;
  lastSession: { id: string; startedAt: string; duration?: number } | null;
  drift: { filesChanged: number; minutesSinceLastCommit: number; detectedAt: string } | null;
  health: { score: number; checkedAt: string } | null;
  challengesQueued: number;
  debt: { gapCount: number; healthScore: number; detectedAt: string } | null;
  proactiveEngine: { lastCheck: string | null; challengesTriggered: number; cooldownUntil: string | null } | null;
  audit: { lastAuditTime: string | null; auditCount: number; notificationsSent: number } | null;
  timers: {
    audit: TimerInfoResponse;
    consolidation: TimerInfoResponse;
    proactiveDigest: TimerInfoResponse;
  } | null;
  notificationStats: { sent: number; throttled: number; last24hWindow: string } | null;
}

export interface DaemonHealthResponse {
  type: string;
  score: number | null;
  checkedAt: string | null;
  trend: "stable" | "improving" | "degrading" | "unknown";
}

export function queryDaemon<T extends { type: string }>(
  shitennoDir: string,
  message: Record<string, unknown> & { type: string },
  timeoutMs = DEFAULT_QUERY_TIMEOUT_MS,
): Promise<T | null> {
  return new Promise((resolve) => {
    const socketPath = getSocketPath(shitennoDir);
    if (!existsSync(socketPath)) {
      resolve(null);
      return;
    }

    const client = createConnection(socketPath);
    const timer = setTimeout(() => {
      client.destroy();
      resolve(null);
    }, timeoutMs);

    client.once("connect", () => {
      client.write(JSON.stringify(message) + "\n");
    });

    client.once("data", (data) => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(data.toString().trim()) as T);
      } catch {
        resolve(null);
      }
      client.destroy();
    });

    client.once("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

export async function queryDaemonWithFallback<T extends { type: string }>(
  shitennoDir: string,
  message: Record<string, unknown> & { type: string },
  fallback: () => T | Promise<T>,
): Promise<T> {
  try {
    const pidPath = getPidPath(shitennoDir);
    if (!existsSync(pidPath)) return await fallback();
    const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
    if (isNaN(pid) || pid <= 0) return await fallback();
    try { process.kill(pid, 0); } catch { return await fallback(); }
    const response = await queryDaemon<T>(shitennoDir, message);
    return (response as T) ?? await fallback();
  } catch {
    return await fallback();
  }
}

export async function queryDaemonStatus(shitennoDir: string): Promise<DaemonStatusResponse | null> {
  return queryDaemon<DaemonStatusResponse>(shitennoDir, { type: "status" }, 2_000);
}

export async function queryDaemonHealth(shitennoDir: string): Promise<DaemonHealthResponse | null> {
  return queryDaemon<DaemonHealthResponse>(shitennoDir, { type: "query_health" }, 2_000);
}
