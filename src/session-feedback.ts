/**
 * session-feedback.ts — Context Pipeline: Session Outcome Feedback
 *
 * Records the outcome of a session (success/failure) and associates it
 * with the briefing that was used. Enables learning from results.
 *
 * Storage: .shugo/session-feedback.jsonl (append-only).
 *
 * PRINCIPLE: Close the feedback loop — outcomes inform future briefings.
 */

import { existsSync, readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────────

export type SessionOutcome = "success" | "failure" | "partial" | "session-start" | "session-end";

export interface SessionFeedbackRecord {
  /** Unique record ID. */
  id: string;
  /** ISO timestamp. */
  timestamp: string;
  /** The outcome of the session. */
  outcome: SessionOutcome;
  /** Briefing hash that was used for this session. */
  briefingHash: string;
  /** Briefing timestamp (when the briefing was generated). */
  briefingTimestamp: string;
  /** Link to session-tracker session ID (bridges the two systems). */
  sessionId?: string;
  /** Session duration in minutes (if known). */
  durationMinutes?: number;
  /** Areas that were modified during the session. */
  modifiedAreas?: string[];
  /** Optional notes about the session. */
  notes?: string;
  /** Whether the session followed the briefing recommendations. */
  followedRecommendations?: boolean;
  /** User-provided rating (1-5). */
  userRating?: 1 | 2 | 3 | 4 | 5;
  /** User-provided comment about the session. */
  userComment?: string;
  /** User-provided tags for categorization. */
  userTags?: string[];
  /** Briefing depth profile used for this session (minimal/standard/full). */
  briefingProfile?: string;
  /** Token economy metrics for this session */
  tokenEconomy?: {
    /** Tokens saved by using briefing vs manual discovery */
    tokensSaved: number;
    /** Whether briefing was served from cache */
    cacheHit: boolean;
    /** Briefing depth used (minimal/standard/full) */
    briefingDepth: string;
  };
}

export interface SessionFeedbackSummary {
  /** Total sessions recorded. */
  totalSessions: number;
  /** Breakdown by outcome. */
  byOutcome: Record<SessionOutcome, number>;
  /** Success rate (0-1). */
  successRate: number;
  /** Average duration of successful sessions. */
  avgSuccessDuration: number | null;
  /** Areas with most failures. */
  failureHotspots: string[];
  /** Average user rating across sessions that have ratings. */
  avgUserRating: number | null;
  /** Total sessions with user ratings. */
  ratedSessions: number;
  /** Token economy aggregated metrics */
  tokenEconomy: {
    /** Total tokens saved across all sessions */
    totalTokensSaved: number;
    /** Average tokens saved per session */
    avgTokensSaved: number;
    /** Number of cache hits */
    cacheHits: number;
    /** Cache hit rate (0-1) */
    cacheHitRate: number;
    /** Estimated monthly savings (10 sessions) */
    monthlyProjection: number;
  };
}

// ── Storage ────────────────────────────────────────────────────────────────

function getFeedbackDir(shitennoDir: string): string {
  return join(shitennoDir, "session-feedback");
}

function getRecordsPath(shitennoDir: string): string {
  return join(getFeedbackDir(shitennoDir), "records.jsonl");
}

function ensureDir(shitennoDir: string): void {
  const dir = getFeedbackDir(shitennoDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ── Core Functions ─────────────────────────────────────────────────────────

/**
 * Record a session outcome (append-only).
 */
export function recordOutcome(
  storage: { append(record: SessionFeedbackRecord): void },
  record: Omit<SessionFeedbackRecord, "id" | "timestamp">
): SessionFeedbackRecord {
  const fullRecord: SessionFeedbackRecord = {
    ...record,
    id: `SF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };

  storage.append(fullRecord);
  return fullRecord;
}

/**
 * Get a file-system based storage for session feedback.
 */
export function createFileStorage(shitennoDir: string) {
  ensureDir(shitennoDir);
  const recordsPath = getRecordsPath(shitennoDir);

  return {
    read(): SessionFeedbackRecord[] {
      if (!existsSync(recordsPath)) return [];
      try {
        const content = readFileSync(recordsPath, "utf-8").trim();
        if (!content) return [];
        return content.split("\n")
          .map((line) => {
            try {
              const parsed = JSON.parse(line) as Record<string, unknown>;
              if (
                typeof parsed === "object" && parsed !== null &&
                typeof parsed.id === "string" &&
                typeof parsed.timestamp === "string" &&
                typeof parsed.outcome === "string"
              ) {
                return parsed as unknown as SessionFeedbackRecord;
              }
              return null;
            } catch {
              return null;
            }
          })
          .filter((r): r is SessionFeedbackRecord => r !== null);
      } catch {
        return [];
      }
    },
    append(record: SessionFeedbackRecord): void {
      ensureDir(shitennoDir);
      appendFileSync(recordsPath, JSON.stringify(record) + "\n", "utf-8");
    },
  };
}

/**
 * Get all session feedback records.
 */
export function getFeedbackRecords(shitennoDir: string): SessionFeedbackRecord[] {
  return createFileStorage(shitennoDir).read();
}

/**
 * Get feedback records for a specific session-tracker session.
 * Bridges session-feedback with session-tracker.
 */
export function getFeedbackForSession(
  shitennoDir: string,
  sessionId: string
): SessionFeedbackRecord[] {
  return getFeedbackRecords(shitennoDir).filter((r) => r.sessionId === sessionId);
}

/**
 * Get the latest feedback record (for pattern analysis).
 */
export function getLatestFeedback(shitennoDir: string): SessionFeedbackRecord | null {
  const records = getFeedbackRecords(shitennoDir);
  return records.at(-1) ?? null;
}

/**
 * Compute a summary of all feedback records.
 */
export function computeFeedbackSummary(
  records: SessionFeedbackRecord[]
): SessionFeedbackSummary {
  const aggregated = aggregateRecords(records);
  return buildSummary(records.length, aggregated);
}

interface AggregatedData {
  byOutcome: Record<SessionOutcome, number>;
  totalDuration: number;
  successDurationCount: number;
  failureAreas: Record<string, number>;
  totalUserRating: number;
  ratedSessions: number;
  totalTokensSaved: number;
  cacheHits: number;
  tokenSessions: number;
}

function aggregateRecords(records: SessionFeedbackRecord[]): AggregatedData {
  const data: AggregatedData = {
    byOutcome: { success: 0, failure: 0, partial: 0, "session-start": 0, "session-end": 0 },
    totalDuration: 0,
    successDurationCount: 0,
    failureAreas: {},
    totalUserRating: 0,
    ratedSessions: 0,
    totalTokensSaved: 0,
    cacheHits: 0,
    tokenSessions: 0,
  };

  for (const record of records) {
    data.byOutcome[record.outcome]++;
    if (record.outcome === "success" && record.durationMinutes) {
      data.totalDuration += record.durationMinutes;
      data.successDurationCount++;
    }
    if (record.outcome === "failure" && record.modifiedAreas) {
      for (const area of record.modifiedAreas) {
        data.failureAreas[area] = (data.failureAreas[area] || 0) + 1;
      }
    }
    if (record.tokenEconomy) {
      data.totalTokensSaved += record.tokenEconomy.tokensSaved;
      if (record.tokenEconomy.cacheHit) data.cacheHits++;
      data.tokenSessions++;
    }
    if (record.userRating) {
      data.totalUserRating += record.userRating;
      data.ratedSessions++;
    }
  }

  return data;
}

function buildSummary(totalSessions: number, agg: AggregatedData): SessionFeedbackSummary {
  const successRate = totalSessions > 0 ? agg.byOutcome.success / totalSessions : 0;
  const avgSuccessDuration = agg.successDurationCount > 0
    ? Math.round(agg.totalDuration / agg.successDurationCount) : null;
  const failureHotspots = Object.entries(agg.failureAreas)
    .sort(([, a], [, b]) => b - a).slice(0, 5).map(([area]) => area);
  const avgUserRating = agg.ratedSessions > 0
    ? Math.round((agg.totalUserRating / agg.ratedSessions) * 10) / 10 : null;
  const avgTokensSaved = agg.tokenSessions > 0 ? Math.round(agg.totalTokensSaved / agg.tokenSessions) : 0;
  const cacheHitRate = agg.tokenSessions > 0 ? agg.cacheHits / agg.tokenSessions : 0;

  return {
    totalSessions,
    byOutcome: agg.byOutcome,
    successRate,
    avgSuccessDuration,
    failureHotspots,
    avgUserRating,
    ratedSessions: agg.ratedSessions,
    tokenEconomy: {
      totalTokensSaved: agg.totalTokensSaved,
      avgTokensSaved,
      cacheHits: agg.cacheHits,
      cacheHitRate,
      monthlyProjection: avgTokensSaved * 10,
    },
  };
}
