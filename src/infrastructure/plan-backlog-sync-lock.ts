/**
 * plan-backlog-sync-lock.ts — Inter-process lock for retroactive scan
 *
 * Uses atomic file creation (flag "wx") to prevent concurrent CLI invocations
 * from running the retroactive scan simultaneously.
 */

import { writeFileSync, unlinkSync, statSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const LOCK_STALE_MS = 30_000; // lock older than this = owner process likely dead/hung

function lockPath(shitennoDir: string): string {
  const locksDir = join(shitennoDir, ".locks");
  mkdirSync(locksDir, { recursive: true });
  return join(locksDir, "plan-backlog-sync.lock");
}

/**
 * Try to acquire the retroactive scan lock.
 * Atomic via "wx" flag — the OS guarantees the open fails with EEXIST
 * if the file already exists, without check-then-write race.
 */
export function acquireScanLock(shitennoDir: string): boolean {
  const path = lockPath(shitennoDir);
  const payload = JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() });

  try {
    writeFileSync(path, payload, { flag: "wx" });
    return true;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }

  // Lock already exists — reclaim if stale
  try {
    const stat = statSync(path);
    if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
      unlinkSync(path);
      writeFileSync(path, payload, { flag: "wx" });
      return true;
    }
  } catch {
    // Lock disappeared between statSync and now (another process released it) — last attempt
    try {
      writeFileSync(path, payload, { flag: "wx" });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export function releaseScanLock(shitennoDir: string): void {
  try {
    unlinkSync(lockPath(shitennoDir));
  } catch {
    // Already gone — nothing to do
  }
}
