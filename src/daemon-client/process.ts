/**
 * daemon-client/process.ts — Daemon start/stop/status operations
 */

import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { logger } from "../logger.js";
import { getPidPath, getSocketPath } from "./paths.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOCKET_WAIT_MS = 3_000;
const SOCKET_POLL_MS = 100;
const DAEMON_SCRIPT = join(__dirname, "..", "src", "daemon.js");

export function getDaemonPid(shitennoDir: string): string | null {
  const pidPath = getPidPath(shitennoDir);
  if (!existsSync(pidPath)) return null;
  try {
    return readFileSync(pidPath, "utf-8").trim();
  } catch {
    return null;
  }
}

export function isDaemonRunning(shitennoDir: string): boolean {
  const pidPath = getPidPath(shitennoDir);
  if (!existsSync(pidPath)) return false;
  try {
    const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
    if (isNaN(pid) || pid <= 0) return false;
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function startDaemon(shitennoDir: string, projectRoot?: string): Promise<void> {
  if (isDaemonRunning(shitennoDir)) {
    logger.info("daemon-client", "Daemon already running, skipping start");
    return;
  }

  if (!existsSync(DAEMON_SCRIPT)) {
    throw new Error(`Daemon script not found: ${DAEMON_SCRIPT}. Run 'pnpm build' first.`);
  }

  const daemonDir = join(shitennoDir, "daemon");
  if (!existsSync(daemonDir)) mkdirSync(daemonDir, { recursive: true });

  const logPath = join(daemonDir, "daemon.log");
  const resolvedProjectRoot = projectRoot ?? join(shitennoDir, "..");

  const child = spawn(process.execPath, [DAEMON_SCRIPT, shitennoDir, resolvedProjectRoot], {
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
    env: {
      ...process.env,
      SHITENNO_DAEMON_LOG: logPath,
      SHITENNO_CHILD: "1",
    },
  });

  child.unref();

  const socketPath = getSocketPath(shitennoDir);
  const deadline = Date.now() + SOCKET_WAIT_MS;

  while (Date.now() < deadline) {
    if (existsSync(socketPath)) {
      logger.info("daemon-client", `Daemon started (pid ${child.pid})`);
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, SOCKET_POLL_MS));
  }

  throw new Error("Daemon started but socket did not appear within timeout");
}

export function stopDaemon(shitennoDir: string): boolean {
  const pidPath = getPidPath(shitennoDir);
  if (!existsSync(pidPath)) return false;
  try {
    const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
    if (isNaN(pid) || pid <= 0) return false;
    process.kill(pid, "SIGTERM");
    logger.info("daemon-client", `SIGTERM sent to daemon pid ${pid}`);
    return true;
  } catch (error) {
    logger.debug("daemon-client", "stopDaemon failed", { error });
    return false;
  }
}
