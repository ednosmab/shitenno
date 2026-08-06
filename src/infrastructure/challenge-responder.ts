/**
 * challenge-responder.ts — Interactive Challenge Response
 *
 * Reads pending challenges from daemon state and provides
 * suggested actions. Enables the user to acknowledge, dismiss,
 * or act on challenges via the interactive briefing prompt.
 *
 * Storage: .shitenno/daemon/daemon-state.json (shared with daemon).
 *
 * PRINCIPLE: Close the interaction loop between proactive alerts and user action.
 */

import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { getEventBus } from "./event-bus.js";
import { readDaemonState, writeDaemonState } from "../challenge-responder/storage.js";
import { type ChallengeType, type ChallengeSeverity, getSuggestedActions, normalizeChallengeType, normalizeSeverity } from "../challenge-responder/actions.js";

export type { ChallengeType, ChallengeSeverity } from "../challenge-responder/actions.js";
export { getActionCommand } from "../challenge-responder/actions.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PendingChallenge {
  id: string;
  type: ChallengeType;
  severity: ChallengeSeverity;
  message: string;
  generatedAt: string;
  suggestedActions: string[];
}

export interface ChallengeResolution {
  challengeId: string;
  action: string;
  resolvedAt: string;
}

// ── Core Functions ─────────────────────────────────────────────────────────

export function getPendingChallenges(shitennoDir: string): PendingChallenge[] {
  const state = readDaemonState(shitennoDir);
  if (!state) return [];

  const challenges = state.challenges;
  if (!Array.isArray(challenges)) return [];

  return challenges
    .filter((c: Record<string, unknown>) => {
      if (typeof c !== "object" || c === null) return false;
      return c.resolved !== true;
    })
    .map((c: Record<string, unknown>, index: number) => {
      const type = normalizeChallengeType(String(c.type ?? "unknown"));
      const severity = normalizeSeverity(String(c.severity ?? "medium"));
      const message = String(c.message ?? "");
      const generatedAt = String(c.generatedAt ?? new Date().toISOString());
      const id = `CHL-${generatedAt.slice(0, 10).replace(/-/g, "")}-${index}`;

      return {
        id, type, severity, message, generatedAt,
        suggestedActions: getSuggestedActions(type, severity),
      };
    });
}

export function markChallengeResolved(
  shitennoDir: string,
  challengeIndex: number,
  action: string,
): ChallengeResolution | null {
  const state = readDaemonState(shitennoDir);
  if (!state) return null;

  const challenges = state.challenges;
  if (!Array.isArray(challenges) || challengeIndex >= challenges.length) return null;

  const challenge = challenges[challengeIndex] as Record<string, unknown>;
  challenge.resolved = true;
  challenge.resolvedAt = new Date().toISOString();
  challenge.resolutionAction = action;

  writeDaemonState(shitennoDir, state);

  try {
    const feedbackDir = join(shitennoDir, "session-feedback");
    if (!existsSync(feedbackDir)) mkdirSync(feedbackDir, { recursive: true });
    const recordsPath = join(feedbackDir, "records.jsonl");
    const record = {
      id: `SF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      outcome: "success",
      briefingHash: "",
      briefingTimestamp: "",
      notes: `Challenge resolved: ${String(challenge.type ?? "unknown")} → ${action}`,
      modifiedAreas: ["daemon-state"],
      followedRecommendations: true,
    };
    appendFileSync(recordsPath, JSON.stringify(record) + "\n", "utf-8");
  } catch { /* Feedback recording is non-critical */ }

  try {
    const bus = getEventBus();
    bus.publish("challenge.resolved" as never, {
      challengeType: String(challenge.type ?? "unknown"),
      action,
      resolvedAt: new Date().toISOString(),
    });
  } catch { /* Event publishing is non-critical */ }

  return {
    challengeId: `CHL-${challengeIndex}`,
    action,
    resolvedAt: new Date().toISOString(),
  };
}

export function undoChallengeResolution(
  shitennoDir: string,
  challengeIndex: number,
): PendingChallenge | null {
  const state = readDaemonState(shitennoDir);
  if (!state) return null;

  const challenges = state.challenges;
  if (!Array.isArray(challenges) || challengeIndex >= challenges.length) return null;

  const challenge = challenges[challengeIndex] as Record<string, unknown>;
  if (challenge.resolved !== true) return null;

  delete challenge.resolved;
  delete challenge.resolvedAt;
  delete challenge.resolutionAction;

  writeDaemonState(shitennoDir, state);

  const challengeType = String(challenge.type ?? "unknown");

  try {
    const feedbackDir = join(shitennoDir, "session-feedback");
    if (!existsSync(feedbackDir)) mkdirSync(feedbackDir, { recursive: true });
    const record = {
      id: `SF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      outcome: "success",
      briefingHash: "",
      briefingTimestamp: "",
      notes: `Challenge resolution undone: ${challengeType}`,
      modifiedAreas: ["daemon-state"],
      followedRecommendations: true,
    };
    appendFileSync(join(feedbackDir, "records.jsonl"), JSON.stringify(record) + "\n", "utf-8");
  } catch { /* Feedback recording is non-critical */ }

  try {
    getEventBus().publish("challenge.resolution_undone" as never, {
      challengeType,
      undoneAt: new Date().toISOString(),
    });
  } catch { /* Event publishing is non-critical */ }

  const type = normalizeChallengeType(String(challenge.type ?? "unknown"));
  const severity = normalizeSeverity(String(challenge.severity ?? "medium"));
  const message = String(challenge.message ?? "");
  const generatedAt = String(challenge.generatedAt ?? new Date().toISOString());
  const id = `CHL-${generatedAt.slice(0, 10).replace(/-/g, "")}-${challengeIndex}`;

  return {
    id, type, severity, message, generatedAt,
    suggestedActions: getSuggestedActions(type, severity),
  };
}
