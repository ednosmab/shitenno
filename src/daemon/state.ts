import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { logger } from "../logger.js";
import { getEventBus } from "../event-bus.js";

// ── Daemon State ──────────────────────────────────────────────────────────────

export interface DriftInfo {
  filesChanged: number;
  minutesSinceLastCommit: number;
  detectedAt: string;
}

export interface SessionInfo {
  id: string;
  startedAt: string;
  endedAt?: string;
  duration?: number;
}

export interface HealthInfo {
  score: number;
  previousScore: number | null;
  checkedAt: string;
}

export interface ChallengeInfo {
  type: string;
  severity: string;
  message: string;
  generatedAt: string;
}

export interface DebtInfo {
  gapCount: number;
  healthScore: number;
  detectedAt: string;
}

export interface EventEntry {
  type: string;
  timestamp: string;
}

/** Timer state for scheduled periodic tasks. */
export interface TimerInfo {
  /** When the timer last fired */
  lastFiredAt: string | null;
  /** Interval in milliseconds */
  intervalMs: number;
}

/** Timer info with computed next-fire time for IPC responses. */
export interface TimerInfoResponse extends TimerInfo {
  /** When the timer will next fire (computed from lastFiredAt + intervalMs) */
  nextFireAt: string | null;
}

export interface DaemonState {
  drift: DriftInfo | null;
  sessions: SessionInfo[];
  health: HealthInfo | null;
  challenges: ChallengeInfo[];
  debt: DebtInfo | null;
  events: EventEntry[];
  startedAt: string;
  briefingCache: { computedAt: string; data: unknown } | null;
  riskMapCache: { computedAt: string; data: unknown } | null;
  lastCommandName: string | null;
  lastCommandAt: string | null;
  proactiveEngine: { lastCheck: string | null; challengesTriggered: number; cooldownUntil: string | null } | null;
  audit: { lastAuditTime: string | null; auditCount: number; notificationsSent: number } | null;
  /** Timer tracking for next-fire display */
  timers: {
    audit: TimerInfo;
    consolidation: TimerInfo;
    proactiveDigest: TimerInfo;
  } | null;
  /** Notification stats for last 24h */
  notificationStats: {
    sent: number;
    throttled: number;
    last24hWindow: string;
  } | null;
}

export const MAX_EVENTS = 100;
export const MAX_SESSIONS = 50;
export const MAX_CHALLENGES = 20;

export function createDaemonState(): DaemonState {
  return {
    drift: null,
    sessions: [],
    health: null,
    challenges: [],
    debt: null,
    events: [],
    startedAt: new Date().toISOString(),
    briefingCache: null,
    riskMapCache: null,
    lastCommandName: null,
    lastCommandAt: null,
    proactiveEngine: null,
    audit: null,
    timers: null,
    notificationStats: null,
  };
}

export function recordEvent(state: DaemonState, eventType: string): void {
  state.events.push({ type: eventType, timestamp: new Date().toISOString() });
  if (state.events.length > MAX_EVENTS) {
    state.events.shift();
  }
}

export function persistState(state: DaemonState, statePath: string): void {
  try {
    writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn("daemon", `Failed to persist daemon state: ${msg}`);
    getEventBus().publish("watcher.error" as never, {
      error: `State persistence failed: ${msg}`,
      timestamp: new Date().toISOString(),
    } as never);
  }
}

export function loadState(statePath: string): DaemonState | null {
  try {
    if (!existsSync(statePath)) return null;
    const raw = readFileSync(statePath, "utf-8");
    return JSON.parse(raw) as DaemonState;
  } catch {
    return null;
  }
}

// ── Notification Stats ──────────────────────────────────────────────────────

export function recordNotificationStat(state: DaemonState, sent: boolean): void {
  if (!state.notificationStats) {
    state.notificationStats = { sent: 0, throttled: 0, last24hWindow: new Date().toISOString() };
  }
  if (sent) {
    state.notificationStats.sent++;
  } else {
    state.notificationStats.throttled++;
  }
}
