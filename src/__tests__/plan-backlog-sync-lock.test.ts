/**
 * plan-backlog-sync-lock.test.ts — Tests for inter-process lock and cooldown
 *
 * Tests the 4 lock scenarios from the plan:
 * 1. Acquire when free → true
 * 2. Acquire when held (fresh) → false
 * 3. Acquire after release → true
 * 4. Lock with mtime >30s → reclaimed (true)
 *
 * Also tests cooldown: shouldSkipScan returns true right after markScanRun.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync, existsSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { acquireScanLock, releaseScanLock } from "../infrastructure/plan-backlog-sync-lock.js";
import { shouldSkipScan, markScanRun } from "../infrastructure/plan-backlog-sync-cooldown.js";

function createTempDir(): string {
  const dir = join(tmpdir(), `shitenno-lock-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ── Lock Tests ─────────────────────────────────────────────────────────────

describe("plan-backlog-sync-lock", () => {
  let dir: string;

  beforeEach(() => {
    dir = createTempDir();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("acquires lock when free → true", () => {
    const result = acquireScanLock(dir);
    expect(result).toBe(true);
    // Cleanup
    releaseScanLock(dir);
  });

  it("fails to acquire when held (fresh) → false", () => {
    // First process acquires
    acquireScanLock(dir);
    // Second process tries — should fail
    const result = acquireScanLock(dir);
    expect(result).toBe(false);
    // Cleanup
    releaseScanLock(dir);
  });

  it("acquires after release → true", () => {
    acquireScanLock(dir);
    releaseScanLock(dir);
    // Should be able to acquire again
    const result = acquireScanLock(dir);
    expect(result).toBe(true);
    releaseScanLock(dir);
  });

  it("reclaims stale lock (>30s) → true", () => {
    // Acquire lock
    acquireScanLock(dir);
    // Artificially age the lock file by modifying mtime
    const locksDir = join(dir, ".locks");
    const lockPath = join(locksDir, "plan-backlog-sync.lock");
    const pastTime = Date.now() - 31_000; // 31 seconds ago

    utimesSync(lockPath, pastTime / 1000, pastTime / 1000);

    // Should reclaim the stale lock
    const result = acquireScanLock(dir);
    expect(result).toBe(true);
    releaseScanLock(dir);
  });

  it("releaseScanLock is safe to call when no lock exists", () => {
    // Should not throw
    releaseScanLock(dir);
    // Calling again is also safe
    releaseScanLock(dir);
  });
});

// ── Cooldown Tests ─────────────────────────────────────────────────────────

describe("plan-backlog-sync-cooldown", () => {
  let dir: string;

  beforeEach(() => {
    dir = createTempDir();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("shouldSkipScan returns false when no state file exists", () => {
    expect(shouldSkipScan(dir)).toBe(false);
  });

  it("shouldSkipScan returns true right after markScanRun", () => {
    markScanRun(dir);
    expect(shouldSkipScan(dir)).toBe(true);
  });

  it("shouldSkipScan returns false after cooldown expires", () => {
    // Write a state file with a timestamp far in the past (beyond cooldown)
    const cacheDir = join(dir, ".cache");
    mkdirSync(cacheDir, { recursive: true });
    const oldTime = new Date(Date.now() - 20_000).toISOString(); // 20s ago > 15s TTL
    writeFileSync(join(cacheDir, "retroactive-scan-state.json"), JSON.stringify({ lastScanAt: oldTime }));
    expect(shouldSkipScan(dir)).toBe(false);
  });

  it("shouldSkipScan returns false with corrupt state file", () => {
    const cacheDir = join(dir, ".cache");
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, "retroactive-scan-state.json"), "not valid json");
    expect(shouldSkipScan(dir)).toBe(false);
  });

  it("markScanRun creates state file", () => {
    markScanRun(dir);
    const statePath = join(dir, ".cache", "retroactive-scan-state.json");
    expect(existsSync(statePath)).toBe(true);
  });
});
