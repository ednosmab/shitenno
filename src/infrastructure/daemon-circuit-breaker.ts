/**
 * daemon-circuit-breaker.ts — Daemon Crash Loop Protection
 *
 * Tracks consecutive daemon crashes and trips a circuit breaker
 * after too many failures within a time window.
 *
 * When tripped, the circuit breaker prevents further auto-start attempts,
 * causing the CLI to fall back to daemonless (disk-based) mode.
 *
 * PRINCIPLE: A crashing daemon is worse than no daemon.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { logger } from "../shared/logger.js";

// ── Config ────────────────────────────────────────────────────────────────────

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const STABLE_UPTIME_MS = 30_000;  // 30s uptime = stable, reset counter

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CircuitBreakerState {
  crashCount: number;
  lastCrashAt: string | null;
  tripped: boolean;
  trippedAt: string | null;
}

// ── Circuit Breaker ───────────────────────────────────────────────────────────

export class DaemonCircuitBreaker {
  private state: CircuitBreakerState = {
    crashCount: 0,
    lastCrashAt: null,
    tripped: false,
    trippedAt: null,
  };

  private stateFile: string;

  constructor(
    shitennoDir: string,
    private readonly maxRetries: number = DEFAULT_MAX_RETRIES,
    private readonly windowMs: number = DEFAULT_WINDOW_MS
  ) {
    this.stateFile = join(shitennoDir, "daemon", "circuit-breaker.json");
    this.load();
  }

  /**
   * Record a crash event.
   * If crashes exceed maxRetries within the time window, trips the circuit.
   */
  record(): void {
    const now = new Date();
    const nowMs = now.getTime();

    // Reset counter if last crash was outside the window
    if (this.state.lastCrashAt) {
      const lastMs = new Date(this.state.lastCrashAt).getTime();
      if (nowMs - lastMs > this.windowMs) {
        this.state.crashCount = 0;
        logger.debug("daemon-circuit-breaker", "Crash window expired — counter reset");
      }
    }

    this.state.crashCount++;
    this.state.lastCrashAt = now.toISOString();

    if (this.state.crashCount >= this.maxRetries && !this.state.tripped) {
      this.state.tripped = true;
      this.state.trippedAt = now.toISOString();
      logger.warn(
        "daemon-circuit-breaker",
        `Circuit tripped after ${this.state.crashCount} crashes — auto-start disabled`
      );
    }

    this.save();
  }

  /**
   * Check if the circuit is tripped (auto-start should be suppressed).
   */
  isTripped(): boolean {
    return this.state.tripped;
  }

  /**
   * Reset after a period of stable operation.
   * Call this after the daemon has been running for STABLE_UPTIME_MS.
   */
  reset(): void {
    this.state = {
      crashCount: 0,
      lastCrashAt: null,
      tripped: false,
      trippedAt: null,
    };
    this.save();
    logger.info("daemon-circuit-breaker", "Circuit reset — stable uptime reached");
  }

  /** Get a snapshot of the current state (for `shugo daemon status`). */
  getState(): Readonly<CircuitBreakerState> {
    return { ...this.state };
  }

  /** How long to wait before being considered stable (ms). */
  static get stableUptimeMs(): number {
    return STABLE_UPTIME_MS;
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  private load(): void {
    try {
      if (!existsSync(this.stateFile)) return;
      const raw = readFileSync(this.stateFile, "utf-8");
      const parsed = JSON.parse(raw) as Partial<CircuitBreakerState>;
      this.state = {
        crashCount: parsed.crashCount ?? 0,
        lastCrashAt: parsed.lastCrashAt ?? null,
        tripped: parsed.tripped ?? false,
        trippedAt: parsed.trippedAt ?? null,
      };
    } catch {
      logger.debug("daemon-circuit-breaker", "Corrupt state file — starting fresh");
    }
  }

  private save(): void {
    try {
      const dir = dirname(this.stateFile);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), "utf-8");
    } catch (error) {
      logger.debug("daemon-circuit-breaker", "Failed to persist state", { error });
    }
  }
}
