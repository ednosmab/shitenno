/**
 * daemon/log-rotation.ts — Log rotation, version detection, and path resolution
 *
 * Extracted from daemon/index.ts to keep modules focused.
 */

import { existsSync, readFileSync, statSync, appendFileSync, unlinkSync, renameSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../logger.js";

const __dirname_file = (() => {
  try {
    return join(fileURLToPath(import.meta.url), "..");
  } catch {
    return ".";
  }
})();

// ── Version ─────────────────────────────────────────────────────────────────

export function getVersion(): string {
  try {
    const pkgPath = join(__dirname_file, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

// ── Paths ───────────────────────────────────────────────────────────────────

export function getPaths(shitennoDir: string) {
  const daemonDir = join(shitennoDir, "daemon");
  return {
    daemonDir,
    pidPath: join(daemonDir, "daemon.pid"),
    sockPath: join(daemonDir, "daemon.sock"),
    logPath: process.env["SHITENNO_DAEMON_LOG"] ?? join(daemonDir, "daemon.log"),
    approvedPath: join(daemonDir, "daemon.approved"),
    statePath: join(daemonDir, "daemon-state.json"),
  };
}

// ── Log Rotation ────────────────────────────────────────────────────────────

const DEFAULT_MAX_LOG_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_ROTATED_FILES = 3;

let currentLogBytes = 0;

function getLogRotationConfig(): { maxBytes: number; maxFiles: number } {
  const maxBytes = Number(process.env["SHITENNO_DAEMON_LOG_MAX_BYTES"]) || DEFAULT_MAX_LOG_BYTES;
  const maxFiles = Number(process.env["SHITENNO_DAEMON_LOG_MAX_FILES"]) || DEFAULT_MAX_ROTATED_FILES;
  return { maxBytes, maxFiles };
}

export function initLogByteCounter(logPath: string): void {
  try {
    currentLogBytes = existsSync(logPath) ? statSync(logPath).size : 0;
  } catch {
    currentLogBytes = 0;
  }
}

function rotateLogIfNeeded(logPath: string): void {
  const { maxBytes, maxFiles } = getLogRotationConfig();
  if (currentLogBytes < maxBytes) return;

  try {
    for (let i = maxFiles - 1; i >= 1; i--) {
      const src = `${logPath}.${i}`;
      const dst = `${logPath}.${i + 1}`;
      if (existsSync(src)) {
        if (i === maxFiles - 1 && existsSync(dst)) unlinkSync(dst);
        renameSync(src, dst);
      }
    }
    renameSync(logPath, `${logPath}.1`);
    currentLogBytes = 0;
  } catch (err) {
    logger.debug("daemon", `Log rotation failed: ${err}`);
  }
}

export function daemonLog(logPath: string, level: string, msg: string): void {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}\n`;
  try {
    rotateLogIfNeeded(logPath);
    appendFileSync(logPath, line, "utf-8");
    currentLogBytes += Buffer.byteLength(line, "utf-8");
  } catch {
    logger.debug("daemon", `Failed to write log: ${msg}`);
  }
}
