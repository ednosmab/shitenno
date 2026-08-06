/**
 * daemon-circuit-breaker.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DaemonCircuitBreaker } from "../infrastructure/daemon-circuit-breaker.js";

const TEST_DIR = join(__dirname, ".test-circuit-breaker");

describe("DaemonCircuitBreaker", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("starts closed (not tripped)", () => {
    const breaker = new DaemonCircuitBreaker(TEST_DIR);
    expect(breaker.isTripped()).toBe(false);
    expect(breaker.getState().crashCount).toBe(0);
  });

  it("records a crash and increments count", () => {
    const breaker = new DaemonCircuitBreaker(TEST_DIR);
    breaker.record();
    expect(breaker.isTripped()).toBe(false);
    expect(breaker.getState().crashCount).toBe(1);
    expect(breaker.getState().lastCrashAt).not.toBeNull();
  });

  it("trips after max retries", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const breaker = new DaemonCircuitBreaker(TEST_DIR, 3, 60000);
    breaker.record();
    breaker.record();
    expect(breaker.isTripped()).toBe(false);
    breaker.record(); // 3rd crash
    expect(breaker.isTripped()).toBe(true);
    expect(breaker.getState().crashCount).toBe(3);
  });

  it("resets count if crash is outside window", () => {
    const breaker = new DaemonCircuitBreaker(TEST_DIR, 3, 60000);
    breaker.record();
    breaker.record();
    expect(breaker.getState().crashCount).toBe(2);

    vi.advanceTimersByTime(61000); // Wait past window
    breaker.record();
    expect(breaker.isTripped()).toBe(false);
    expect(breaker.getState().crashCount).toBe(1); // Reset to 1
  });

  it("persists state to disk", () => {
    const breaker1 = new DaemonCircuitBreaker(TEST_DIR, 3, 60000);
    breaker1.record();
    breaker1.record();

    // Re-instantiate should load from disk
    const breaker2 = new DaemonCircuitBreaker(TEST_DIR, 3, 60000);
    expect(breaker2.getState().crashCount).toBe(2);
  });

  it("can be manually reset", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const breaker = new DaemonCircuitBreaker(TEST_DIR, 3, 60000);
    breaker.record();
    breaker.record();
    breaker.record();
    expect(breaker.isTripped()).toBe(true);

    breaker.reset();
    expect(breaker.isTripped()).toBe(false);
    expect(breaker.getState().crashCount).toBe(0);
  });
});
