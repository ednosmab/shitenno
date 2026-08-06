/**
 * session-tracker.ts — Session Tracking for User Performance
 *
 * Tracks session start/end, commands executed, and duration.
 * Persists to shitenno/telemetry/sessions.jsonl (append-only).
 *
 * PRINCIPLE: To report on performance, we must first observe it.
 */

import { existsSync, readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../shared/logger.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SessionRecord {
  id: string;
  startedAt: string;
  endedAt?: string;
  /** Duration in minutes. */
  duration?: number;
  commands: string[];
  feedbackGiven: number;
  recommendationsAccepted: number;
  recommendationsRejected: number;
  pathChoices: { comfortable: number; challenging: number };
  branch?: string;
  commitCount?: number;
  lastActivityAt?: string;
}

export interface SessionMetrics {
  totalSessions: number;
  avgDuration: number;
  totalCommands: number;
  commandFrequency: Record<string, number>;
  avgFeedbackPerSession: number;
  totalAccepts: number;
  totalRejects: number;
  challengingRatio: number;
}

// ── Storage ──────────────────────────────────────────────────────────────────

let sessionCounter = 0;

function getTelemetryDir(shitennoDir: string): string {
  return join(shitennoDir, "telemetry");
}

function getSessionsPath(shitennoDir: string): string {
  return join(getTelemetryDir(shitennoDir), "sessions.jsonl");
}

function ensureTelemetryDir(shitennoDir: string): void {
  const dir = getTelemetryDir(shitennoDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ── Core Functions ───────────────────────────────────────────────────────────

/** Start a new session. Returns the session record. */
export function startSession(shitennoDir: string): SessionRecord {
  ensureTelemetryDir(shitennoDir);

  const now = new Date();
  const ts = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  const seq = String(++sessionCounter).padStart(4, "0");
  const session: SessionRecord = {
    id: `SES-${ts}${ms}-${seq}`,
    startedAt: now.toISOString(),
    commands: [],
    feedbackGiven: 0,
    recommendationsAccepted: 0,
    recommendationsRejected: 0,
    pathChoices: { comfortable: 0, challenging: 0 },
  };

  appendSession(shitennoDir, session);
  logger.debug("SessionTracker", `Session started: ${session.id}`);
  return session;
}

/** Track a command executed during the session. */
export function trackCommand(shitennoDir: string, sessionId: string, command: string): void {
  const sessions = readAllSessions(shitennoDir);
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;

  session.commands.push(command);
  session.lastActivityAt = new Date().toISOString();
  appendSession(shitennoDir, session);
}

/** Record a feedback event in the session. */
export function trackFeedback(
  shitennoDir: string,
  sessionId: string,
  action: "accepted" | "rejected" | "deferred",
  pathChoice?: "comfortable" | "challenging"
): void {
  const sessions = readAllSessions(shitennoDir);
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;

  session.feedbackGiven++;
  if (action === "accepted") session.recommendationsAccepted++;
  if (action === "rejected") session.recommendationsRejected++;
  if (pathChoice === "comfortable") session.pathChoices.comfortable++;
  if (pathChoice === "challenging") session.pathChoices.challenging++;
  session.lastActivityAt = new Date().toISOString();
  appendSession(shitennoDir, session);
}

/** End a session and calculate duration. */
export function endSession(shitennoDir: string, sessionId: string): SessionRecord | null {
  const sessions = readAllSessions(shitennoDir);
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return null;

  const endedAt = new Date();
  session.endedAt = endedAt.toISOString();
  session.lastActivityAt = endedAt.toISOString();

  const startedAt = new Date(session.startedAt);
  session.duration = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);

  appendSession(shitennoDir, session);
  logger.debug("SessionTracker", `Session ended: ${session.id} (${session.duration}min)`);
  return session;
}

/** Get all sessions, optionally filtered. */
export function getSessions(
  shitennoDir: string,
  options?: { since?: string; limit?: number }
): SessionRecord[] {
  let sessions = readAllSessions(shitennoDir);

  if (options?.since) {
    const sinceDate = new Date(options.since);
    sessions = sessions.filter((s) => new Date(s.startedAt) >= sinceDate);
  }

  if (options?.limit) {
    sessions = sessions.slice(-options.limit);
  }

  return sessions;
}

/** Get aggregated session metrics. */
export function getSessionMetrics(shitennoDir: string, days?: number): SessionMetrics {
  const since = days
    ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    : undefined;
  const sessions = getSessions(shitennoDir, { since });

  const commandFrequency: Record<string, number> = {};
  let totalCommands = 0;
  let totalFeedback = 0;
  let totalAccepts = 0;
  let totalRejects = 0;
  let totalComfortable = 0;
  let totalChallenging = 0;
  let totalDuration = 0;
  let durationCount = 0;

  for (const session of sessions) {
    for (const cmd of session.commands) {
      commandFrequency[cmd] = (commandFrequency[cmd] || 0) + 1;
      totalCommands++;
    }
    totalFeedback += session.feedbackGiven;
    totalAccepts += session.recommendationsAccepted;
    totalRejects += session.recommendationsRejected;
    totalComfortable += session.pathChoices.comfortable;
    totalChallenging += session.pathChoices.challenging;
    if (session.duration) {
      totalDuration += session.duration;
      durationCount++;
    }
  }

  const totalPathChoices = totalComfortable + totalChallenging;

  return {
    totalSessions: sessions.length,
    avgDuration: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
    totalCommands,
    commandFrequency,
    avgFeedbackPerSession: sessions.length > 0 ? Math.round(totalFeedback / sessions.length * 10) / 10 : 0,
    totalAccepts,
    totalRejects,
    challengingRatio: totalPathChoices > 0 ? totalChallenging / totalPathChoices : 0.5,
  };
}

// ── Internal Helpers ─────────────────────────────────────────────────────────



function appendSession(shitennoDir: string, session: SessionRecord): void {
  const sessionsPath = getSessionsPath(shitennoDir);
  appendFileSync(sessionsPath, JSON.stringify(session) + "\n", "utf-8");
}

/** Read all sessions and deduplicate by ID (keep latest entry per session). */
function readAllSessions(shitennoDir: string): SessionRecord[] {
  const sessionsPath = getSessionsPath(shitennoDir);
  if (!existsSync(sessionsPath)) return [];

  try {
    const content = readFileSync(sessionsPath, "utf-8").trim();
    if (!content) return [];

    const entries = content.split("\n")
      .map((line) => {
        try {
          const parsed = JSON.parse(line) as Record<string, unknown>;
          if (
            typeof parsed === "object" && parsed !== null &&
            typeof parsed.id === "string" &&
            typeof parsed.startedAt === "string" &&
            Array.isArray(parsed.commands)
          ) {
            return parsed as unknown as SessionRecord;
          }
          return null;
        } catch {
          return null;
        }
      })
      .filter((r): r is SessionRecord => r !== null);

    // Deduplicate: keep the latest entry for each session ID
    const latestById = new Map<string, SessionRecord>();
    for (const entry of entries) {
      const existing = latestById.get(entry.id);
      if (!existing || new Date(entry.startedAt) >= new Date(existing.startedAt)) {
        latestById.set(entry.id, entry);
      }
    }

    return Array.from(latestById.values());
  } catch {
    return [];
  }
}
