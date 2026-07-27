/**
 * feedback/core.ts — Core Feedback Loop Functions
 *
 * Records, retrieves, and analyses feedback on recommendations.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { logger } from "../logger.js";
import { getEventBus } from "../event-bus.js";
import type { FeedbackRecord, FeedbackSummary, FeedbackPattern } from "./types.js";
import { getRecordsDir, getSummaryPath } from "./storage.js";

// ── Core Functions ───────────────────────────────────────────────────────────

/** Record a feedback event. */
export function recordFeedback(
  shitennoDir: string,
  record: Omit<FeedbackRecord, "id" | "timestamp">
): FeedbackRecord {
  const recordsDir = getRecordsDir(shitennoDir);

  if (!existsSync(recordsDir)) {
    mkdirSync(recordsDir, { recursive: true });
  }

  const fullRecord: FeedbackRecord = {
    ...record,
    id: `FB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };

  const filename = `${fullRecord.timestamp.split("T")[0]}-${fullRecord.id}.json`;
  writeFileSync(join(recordsDir, filename), JSON.stringify(fullRecord, null, 2));

  updateSummary(shitennoDir, fullRecord);

  const eventType = fullRecord.action === "accepted"
    ? "recommendation.accepted"
    : "recommendation.rejected";

  if (fullRecord.action === "accepted" || fullRecord.action === "rejected") {
    try {
      getEventBus().publish(eventType, {
        recommendationId: fullRecord.recommendationId,
        action: fullRecord.action,
        reason: fullRecord.reason,
        feedbackId: fullRecord.id,
      });
    } catch (error) {
      logger.debug("feedback-loops", "Failed to publish event:", error);
    }
  }

  return fullRecord;
}

/** Get all feedback records. */
export function getFeedbackRecords(shitennoDir: string): FeedbackRecord[] {
  const recordsDir = getRecordsDir(shitennoDir);
  if (!existsSync(recordsDir)) return [];

  const files = readdirSync(recordsDir).filter((f) => f.endsWith(".json"));
  const records: FeedbackRecord[] = [];

  for (const file of files) {
    try {
      const content = JSON.parse(readFileSync(join(recordsDir, file), "utf-8"));
      records.push(content);
    } catch {
      logger.debug("feedback-loops", "Failed to parse feedback record:", file);
    }
  }

  return records.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

/** Get feedback summary for a specific recommendation. */
export function getFeedbackSummary(
  shitennoDir: string,
  recommendationId: string
): FeedbackSummary | null {
  const summaryPath = getSummaryPath(shitennoDir);
  if (!existsSync(summaryPath)) return null;

  try {
    const summaries: Record<string, FeedbackSummary> = JSON.parse(
      readFileSync(summaryPath, "utf-8")
    );
    return summaries[recommendationId] || null;
  } catch {
    return null;
  }
}

/** Get all feedback summaries. */
export function getAllFeedbackSummaries(shitennoDir: string): Record<string, FeedbackSummary> {
  const summaryPath = getSummaryPath(shitennoDir);
  if (!existsSync(summaryPath)) return {};

  try {
    return JSON.parse(readFileSync(summaryPath, "utf-8"));
  } catch {
    return {};
  }
}

// ── Learning Functions ───────────────────────────────────────────────────────

/** Adjust confidence based on feedback. */
export function adjustConfidence(
  currentConfidence: number,
  action: "accepted" | "rejected",
  weight: number = 0.1
): number {
  if (action === "accepted") {
    return Math.min(1.0, currentConfidence + (1 - currentConfidence) * weight);
  } else {
    return Math.max(0.0, currentConfidence - currentConfidence * weight);
  }
}

/** Check if a recommendation should be suppressed. */
export function shouldSuppress(
  summary: FeedbackSummary,
  suppressThreshold: number = 5
): boolean {
  return summary.rejectCount >= suppressThreshold;
}

/** Detect feedback patterns. */
export function detectFeedbackPatterns(shitennoDir: string): FeedbackPattern[] {
  const summaries = getAllFeedbackSummaries(shitennoDir);
  const patterns: FeedbackPattern[] = [];

  for (const [recId, summary] of Object.entries(summaries)) {
    if (summary.totalInteractions < 3) continue;

    if (summary.acceptCount === 0 && summary.rejectCount >= 3) {
      patterns.push({
        type: "always_rejects",
        recommendationType: recId,
        confidence: summary.rejectCount / summary.totalInteractions,
        description: `Recommendation "${recId}" has been rejected ${summary.rejectCount} times`,
      });
    }

    if (summary.rejectCount === 0 && summary.acceptCount >= 3) {
      patterns.push({
        type: "always_accepts",
        recommendationType: recId,
        confidence: summary.acceptCount / summary.totalInteractions,
        description: `Recommendation "${recId}" has been accepted ${summary.acceptCount} times`,
      });
    }

    if (summary.deferCount >= 3 && summary.deferCount > summary.acceptCount + summary.rejectCount) {
      patterns.push({
        type: "defers_frequently",
        recommendationType: recId,
        confidence: summary.deferCount / summary.totalInteractions,
        description: `Recommendation "${recId}" has been deferred ${summary.deferCount} times`,
      });
    }
  }

  return patterns;
}

// ── Internal Helpers ─────────────────────────────────────────────────────────

function join(...paths: string[]): string {
  return paths.join("/");
}

function createEmptySummary(recId: string): FeedbackSummary {
  return {
    recommendationId: recId,
    acceptCount: 0,
    rejectCount: 0,
    deferCount: 0,
    totalInteractions: 0,
    acceptanceRate: 0,
    lastAction: null,
    lastTimestamp: null,
    pathChoiceStats: {
      comfortableCount: 0,
      challengingCount: 0,
      lastPathChoice: null,
    },
  };
}

function updateActionCounts(summary: FeedbackSummary, action: FeedbackRecord["action"]): void {
  switch (action) {
    case "accepted":
      summary.acceptCount++;
      break;
    case "rejected":
      summary.rejectCount++;
      break;
    case "deferred":
      summary.deferCount++;
      break;
  }
}

function updatePathChoiceStats(summary: FeedbackSummary, pathChoice: "comfortable" | "challenging"): void {
  if (!summary.pathChoiceStats) {
    summary.pathChoiceStats = {
      comfortableCount: 0,
      challengingCount: 0,
      lastPathChoice: null,
    };
  }

  if (pathChoice === "comfortable") {
    summary.pathChoiceStats.comfortableCount++;
  } else {
    summary.pathChoiceStats.challengingCount++;
  }
  summary.pathChoiceStats.lastPathChoice = pathChoice;
}

function updateSummary(shitennoDir: string, record: FeedbackRecord): void {
  const summaryPath = getSummaryPath(shitennoDir);
  const summaries: Record<string, FeedbackSummary> = existsSync(summaryPath)
    ? JSON.parse(readFileSync(summaryPath, "utf-8"))
    : {};

  const recId = record.recommendationId;
  if (!summaries[recId]) {
    summaries[recId] = createEmptySummary(recId);
  }

  const summary = summaries[recId];
  summary.totalInteractions++;
  updateActionCounts(summary, record.action);

  summary.acceptanceRate =
    summary.totalInteractions > 0
      ? summary.acceptCount / summary.totalInteractions
      : 0;
  summary.lastAction = record.action;
  summary.lastTimestamp = record.timestamp;

  if (record.pathChoice) {
    updatePathChoiceStats(summary, record.pathChoice);
  }

  writeFileSync(summaryPath, JSON.stringify(summaries, null, 2));
}
