/**
 * engine/feedback/generator.ts — Personalized Feedback Generator
 *
 * Orchestrates feedback item generation, guidance, and leadership metrics.
 */

import type { SessionFeedbackRecord } from "../../session-feedback.js";
import type { UserProfile, FeedbackTone, FeedbackItem, PersonalizedFeedback } from "./profile.js";
import { calibrateTone } from "./profile.js";
import {
  generateSuccessStrengths,
  generateFailureStrengths,
  generatePartialStrengths,
  generateFailureImprovements,
  generatePartialImprovements,
  formatAgentStrengths,
  formatAgentImprovements,
} from "./items/items.js";
import { generateNextLevelGuidance, generateLeadershipMetrics } from "./items/guidance.js";

function computeSessionDateTime(record: SessionFeedbackRecord): { date: string; sessionTime: string } {
  const dateParts = new Date(record.timestamp).toISOString().split("T");
  const date = dateParts[0] || new Date().toISOString().split("T")[0] || "2026-07-01";
  const sessionTime = new Date(record.timestamp).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return { date, sessionTime };
}

function buildFeedbackItems(
  record: SessionFeedbackRecord,
  profile: UserProfile,
  tone: FeedbackTone,
  agentActions: { whatAgentDid: string[]; whatAgentMissed: string[] }
): { strengths: FeedbackItem[]; improvements: FeedbackItem[] } {
  const strengths: FeedbackItem[] = [];
  const improvements: FeedbackItem[] = [];

  if (record.outcome === "success") {
    strengths.push(...generateSuccessStrengths(record, profile, tone));
  } else if (record.outcome === "failure") {
    strengths.push(...generateFailureStrengths(record, profile, tone));
    improvements.push(...generateFailureImprovements(record, profile, tone));
  } else {
    strengths.push(...generatePartialStrengths(record, profile, tone));
    improvements.push(...generatePartialImprovements(record, profile, tone));
  }

  if (agentActions.whatAgentDid.length > 0) {
    strengths.push({
      category: "strength",
      title: "Agent collaboration",
      description: formatAgentStrengths(agentActions.whatAgentDid, tone, profile.language),
    });
  }

  if (agentActions.whatAgentMissed.length > 0) {
    improvements.push({
      category: "improvement",
      title: "Agent communication",
      description: formatAgentImprovements(agentActions.whatAgentMissed, tone, profile.language),
    });
  }

  return { strengths, improvements };
}

export function generatePersonalizedFeedback(
  record: SessionFeedbackRecord,
  profile: UserProfile,
  agentActions: { whatAgentDid: string[]; whatAgentMissed: string[] } = {
    whatAgentDid: [],
    whatAgentMissed: [],
  }
): PersonalizedFeedback {
  const tone = calibrateTone(profile, record.outcome, profile.architecture);
  const { date, sessionTime } = computeSessionDateTime(record);
  const { strengths, improvements } = buildFeedbackItems(record, profile, tone, agentActions);
  const nextLevel = generateNextLevelGuidance(record.outcome, profile, tone);
  const metrics = generateLeadershipMetrics(record, profile, tone);

  return {
    date,
    profile,
    sessionNumber: 1,
    sessionTimestamp: sessionTime,
    strengths,
    improvements,
    nextLevel,
    metrics,
    agentPerformance: {
      strengths: agentActions.whatAgentDid,
      improvements: agentActions.whatAgentMissed,
    },
  };
}
