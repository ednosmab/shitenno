/**
 * atomic-write.ts — Atomic file operations with inter-process locking.
 *
 * Provides:
 * - acquireFileLock / releaseFileLock: PID-based file locks with stale detection
 * - atomicWriteFile: write to temp file + rename (crash-safe)
 * - atomicAppendLine: append a single line atomically
 *
 * Used by session-tracker and context-buffer-writer to prevent race conditions
 * when multiple CLI/daemon processes write to the same files.
 */

import {
  writeFileSync,
  readFileSync,
  existsSync,
  unlinkSync,
  statSync,
  renameSync,
  appendFileSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { randomBytes } from "node:crypto";

const LOCK_STALE_MS = 30_000;

// ── File Lock ──────────────────────────────────────────────────────────────

interface LockInfo {
  pid: number;
  acquiredAt: string;
}

function lockPath(baseDir: string, lockName: string): string {
  const locksDir = join(baseDir, ".locks");
  mkdirSync(locksDir, { recursive: true });
  return join(locksDir, `${lockName}.lock`);
}

/**
 * Try to acquire a named file lock.
 * Uses atomic "wx" flag — OS guarantees no check-then-write race.
 * Locks older than LOCK_STALE_MS are reclaimed (owner likely crashed).
 */
export function acquireFileLock(baseDir: string, lockName: string): boolean {
  const path = lockPath(baseDir, lockName);
  const payload = JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() });

  try {
    writeFileSync(path, payload, { flag: "wx" });
    return true;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }

  // Lock exists — reclaim if stale
  try {
    const stat = statSync(path);
    if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
      unlinkSync(path);
      writeFileSync(path, payload, { flag: "wx" });
      return true;
    }
  } catch {
    // Lock disappeared — try once more
    try {
      writeFileSync(path, payload, { flag: "wx" });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Release a named file lock. Only removes if owned by this process.
 */
export function releaseFileLock(baseDir: string, lockName: string): void {
  const path = lockPath(baseDir, lockName);
  try {
    if (existsSync(path)) {
      const info: LockInfo = JSON.parse(readFileSync(path, "utf-8"));
      if (info.pid === process.pid) unlinkSync(path);
    }
  } catch {
    // If error reading, don't risk deleting another process's lock
  }
}

// ── Atomic Write ───────────────────────────────────────────────────────────

/**
 * Write content to a file atomically via temp + rename.
 * On POSIX, rename() is atomic within the same filesystem.
 */
export function atomicWriteFile(filePath: string, content: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const tmp = `${filePath}.tmp.${randomBytes(4).toString("hex")}`;
  try {
    writeFileSync(tmp, content, "utf-8");
    renameSync(tmp, filePath);
  } catch (err) {
    // Cleanup temp on failure
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch { /* best effort */ }
    throw err;
  }
}

/**
 * Append a line to a file atomically (write full file with appended line).
 * Use for JSONL files where atomicity matters more than append performance.
 */
export function atomicAppendLine(filePath: string, line: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, "utf-8");
    atomicWriteFile(filePath, existing + line + "\n");
  } else {
    atomicWriteFile(filePath, line + "\n");
  }
}

/**
 * Append a line to a JSONL file using fast appendFileSync.
 * Safe for append-only logs where the OS guarantees atomic appends
 * for writes smaller than PIPE_BUF (4096 bytes on Linux).
 * Each JSONL line is typically < 1KB.
 */
export function fastAppendLine(filePath: string, line: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  appendFileSync(filePath, line + "\n", "utf-8");
}
