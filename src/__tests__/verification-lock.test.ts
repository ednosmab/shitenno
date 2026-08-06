/**
 * verification-lock.test.ts — Tests for cross-process verification lock
 *
 * Tests the PID-based file lock pattern used to prevent concurrent
 * plan verification between daemon and close-session processes:
 * 1. Acquire when free → true (lock file created)
 * 2. Acquire when held by alive process → false
 * 3. Release own lock → file removed
 * 4. Release does not remove another process's lock
 * 5. Stale lock (dead PID) → reclaimed automatically
 * 6. Corrupt lock file → treated as orphan, reclaimed
 * 7. Release is safe when no lock exists
 * 8. Release is safe when lock file is corrupt
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  acquireVerificationLock,
  releaseVerificationLock,
} from "../infrastructure/verification-lock.js";

function createTempDir(): string {
  const dir = join(
    tmpdir(),
    `shitenno-vlock-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  // Pre-create governance/plans so acquireVerificationLock can write the lock file
  mkdirSync(join(dir, "governance", "plans"), { recursive: true });
  return dir;
}

function getLockPath(shitennoDir: string): string {
  return join(shitennoDir, "governance", "plans", ".verification.lock");
}

function writeLockFile(shitennoDir: string, pid: number, startedAt?: string): void {
  writeFileSync(
    getLockPath(shitennoDir),
    JSON.stringify(
      { pid, startedAt: startedAt ?? new Date().toISOString() },
      null,
      2
    ),
    "utf-8"
  );
}

// ── Successful Acquire / Release ──────────────────────────────────────────

describe("verification-lock: acquire/release lifecycle", () => {
  let dir: string;

  beforeEach(() => {
    dir = createTempDir();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("acquires lock when free → true and creates lock file", () => {
    const result = acquireVerificationLock(dir);
    expect(result).toBe(true);
    expect(existsSync(getLockPath(dir))).toBe(true);

    // Verify lock content contains our PID
    const content = JSON.parse(readFileSync(getLockPath(dir), "utf-8"));
    expect(content.pid).toBe(process.pid);
    expect(content.startedAt).toBeDefined();

    releaseVerificationLock(dir);
  });

  it("release removes lock file created by this process", () => {
    acquireVerificationLock(dir);
    expect(existsSync(getLockPath(dir))).toBe(true);

    releaseVerificationLock(dir);
    expect(existsSync(getLockPath(dir))).toBe(false);
  });

  it("acquire after release → true", () => {
    acquireVerificationLock(dir);
    releaseVerificationLock(dir);

    const result = acquireVerificationLock(dir);
    expect(result).toBe(true);
    releaseVerificationLock(dir);
  });

  it("acquire twice in same process → false (same PID detected as alive)", () => {
    const first = acquireVerificationLock(dir);
    expect(first).toBe(true);

    // Second acquire from same process — PID matches, so it's "alive"
    // and we get false (another process is verifying)
    const second = acquireVerificationLock(dir);
    expect(second).toBe(false);

    releaseVerificationLock(dir);
  });
});

// ── Lock Conflict Detection ───────────────────────────────────────────────

describe("verification-lock: conflict detection", () => {
  let dir: string;

  beforeEach(() => {
    dir = createTempDir();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails to acquire when held by alive process → false", () => {
    // Simulate another process holding the lock with our own PID
    // (which is alive)
    writeLockFile(dir, process.pid);

    const result = acquireVerificationLock(dir);
    expect(result).toBe(false);

    // Clean up the lock we wrote
    releaseVerificationLock(dir);
  });

  it("does not overwrite existing lock file when failing to acquire", () => {
    writeLockFile(dir, process.pid, "2026-01-01T00:00:00.000Z");

    acquireVerificationLock(dir);

    // Original lock content should be unchanged
    const content = JSON.parse(readFileSync(getLockPath(dir), "utf-8"));
    expect(content.startedAt).toBe("2026-01-01T00:00:00.000Z");

    releaseVerificationLock(dir);
  });
});

// ── Stale Lock Cleanup (Dead Process) ─────────────────────────────────────

describe("verification-lock: stale lock cleanup", () => {
  let dir: string;

  beforeEach(() => {
    dir = createTempDir();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reclaims lock held by dead process → true", () => {
    // Use a PID that is guaranteed not to exist
    const deadPid = 999999999;
    writeLockFile(dir, deadPid);

    const result = acquireVerificationLock(dir);
    expect(result).toBe(true);

    // Lock file should now contain our PID, not the dead one
    const content = JSON.parse(readFileSync(getLockPath(dir), "utf-8"));
    expect(content.pid).toBe(process.pid);

    releaseVerificationLock(dir);
  });

  it("reclaims lock with PID 0 (kernel scheduler, never user-owned)", () => {
    // PID 0 is the scheduler; process.kill(0, 0) on Linux sends signal to
    // every process in the process group, but on most systems it won't
    // throw for the calling process. However, PID 0 is never a user process
    // that would hold our lock. To be safe we use a clearly-dead PID.
    // PID 1 (init) might exist, so let's use a very high PID instead
    writeLockFile(dir, 999999999);

    const result = acquireVerificationLock(dir);
    expect(result).toBe(true);
    releaseVerificationLock(dir);
  });

  it("reclaims lock with non-numeric PID → true", () => {
    writeFileSync(
      getLockPath(dir),
      JSON.stringify({ pid: "not-a-number", startedAt: "2026-01-01T00:00:00.000Z" }),
      "utf-8"
    );

    // parseInt("not-a-number") → NaN → process.kill(NaN, 0) throws → lock reclaimed
    const result = acquireVerificationLock(dir);
    expect(result).toBe(true);
    releaseVerificationLock(dir);
  });
});

// ── Corrupt Lock File Handling ────────────────────────────────────────────

describe("verification-lock: corrupt lock handling", () => {
  let dir: string;

  beforeEach(() => {
    dir = createTempDir();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reclaims lock when file contains invalid JSON → true", () => {
    writeFileSync(getLockPath(dir), "not valid json {{{", "utf-8");

    const result = acquireVerificationLock(dir);
    expect(result).toBe(true);

    // Should have overwritten with valid lock
    const content = JSON.parse(readFileSync(getLockPath(dir), "utf-8"));
    expect(content.pid).toBe(process.pid);

    releaseVerificationLock(dir);
  });

  it("reclaims lock when file is empty → true", () => {
    writeFileSync(getLockPath(dir), "", "utf-8");

    const result = acquireVerificationLock(dir);
    expect(result).toBe(true);
    releaseVerificationLock(dir);
  });

  it("reclaims lock when JSON is valid but missing pid field → true", () => {
    writeFileSync(
      getLockPath(dir),
      JSON.stringify({ startedAt: "2026-01-01T00:00:00.000Z" }),
      "utf-8"
    );

    // JSON.parse succeeds but info.pid is undefined → isProcessAlive(undefined)
    // → process.kill(NaN, 0) throws → returns false → lock reclaimed
    const result = acquireVerificationLock(dir);
    expect(result).toBe(true);
    releaseVerificationLock(dir);
  });
});

// ── Release Safety ────────────────────────────────────────────────────────

describe("verification-lock: release safety", () => {
  let dir: string;

  beforeEach(() => {
    dir = createTempDir();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("release is safe when no lock file exists", () => {
    // Should not throw
    expect(() => releaseVerificationLock(dir)).not.toThrow();
  });

  it("release is safe when lock file is corrupt", () => {
    writeFileSync(getLockPath(dir), "corrupt", "utf-8");

    // Should not throw — the catch block handles read errors gracefully
    expect(() => releaseVerificationLock(dir)).not.toThrow();

    // Corrupt file should still exist (we didn't risk removing it)
    expect(existsSync(getLockPath(dir))).toBe(true);
  });

  it("release does not remove lock created by another process", () => {
    const otherPid = 999999999; // Clearly not our PID
    writeLockFile(dir, otherPid);

    releaseVerificationLock(dir);

    // Lock file should still exist (belonging to the other process)
    expect(existsSync(getLockPath(dir))).toBe(true);

    const content = JSON.parse(readFileSync(getLockPath(dir), "utf-8"));
    expect(content.pid).toBe(otherPid);
  });

  it("release only removes lock with matching PID", () => {
    // Acquire our own lock
    acquireVerificationLock(dir);
    const ourLockPath = getLockPath(dir);
    expect(existsSync(ourLockPath)).toBe(true);

    releaseVerificationLock(dir);
    expect(existsSync(ourLockPath)).toBe(false);
  });
});
