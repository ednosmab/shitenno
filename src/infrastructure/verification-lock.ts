import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

interface LockInfo {
  pid: number;
  startedAt: string;
}

function lockPath(shitennoDir: string): string {
  return join(shitennoDir, "governance", "plans", ".verification.lock");
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // signal 0 doesn't kill, just checks if process exists
    return true;
  } catch {
    return false;
  }
}

/**
 * Attempts to acquire the verification lock. Returns true if successful
 * (can proceed with verification); false if another process is already verifying.
 * Lock held by a dead process (crash) is automatically released.
 */
export function acquireVerificationLock(shitennoDir: string): boolean {
  const path = lockPath(shitennoDir);

  if (existsSync(path)) {
    try {
      const info: LockInfo = JSON.parse(readFileSync(path, "utf-8"));
      if (isProcessAlive(info.pid)) {
        return false; // another process (daemon OR close-session) is truly verifying now
      }
      // Lock from dead process (crash) — safe to remove
    } catch {
      // Corrupted/illegible lock — treat as orphan, remove and continue
    }
  }

  writeFileSync(path, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2), "utf-8");
  return true;
}

export function releaseVerificationLock(shitennoDir: string): void {
  const path = lockPath(shitennoDir);
  try {
    if (existsSync(path)) {
      const info: LockInfo = JSON.parse(readFileSync(path, "utf-8"));
      if (info.pid === process.pid) unlinkSync(path); // only remove lock created by this process
    }
  } catch {
    // If error reading, don't risk deleting another process's lock
  }
}