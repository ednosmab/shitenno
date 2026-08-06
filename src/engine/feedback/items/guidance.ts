/**
 * engine/feedback/items/guidance.ts — Next-Level Guidance and Leadership Metrics
 */

import type { SessionFeedbackRecord, SessionOutcome } from "../../../infrastructure/session-feedback.js";
import type { UserProfile, FeedbackTone, LeadershipMetrics } from "../profile.js";

export function generateNextLevelGuidance(
  outcome: SessionOutcome,
  profile: UserProfile,
  tone: FeedbackTone
): string {
  if (profile.language === "en") {
    if (outcome === "success") {
      return "Keep building on this momentum. Focus on consistency.";
    }
    if (outcome === "failure") {
      return "Every failure is a learning opportunity. Focus on the process, not the outcome.";
    }
    return "Progress is progress. Focus on completing the next step.";
  }

  if (tone === "mentor") {
    if (outcome === "success") {
      return "Continua neste ritmo. A consistência é a chave para a mastery.";
    }
    if (outcome === "failure") {
      return "Cada falha é uma oportunidade de aprendizagem. Foca no processo, não no resultado.";
    }
    return "Progresso é progresso. Foca em completar o próximo passo.";
  }

  if (outcome === "success") {
    return "Momentum is building. Focus on consistency.";
  }
  if (outcome === "failure") {
    return "Focus on the process, not the outcome.";
  }
  return "Focus on completing the next step.";
}

export function generateLeadershipMetrics(
  record: SessionFeedbackRecord,
  _profile: UserProfile,
  _tone: FeedbackTone
): LeadershipMetrics[] {
  const metrics: LeadershipMetrics[] = [];

  if (record.outcome === "success") {
    metrics.push({
      name: "Gestão de risco",
      rating: "forte",
      note: record.followedRecommendations ? "Seguiu recomendações" : undefined,
    });
  } else {
    metrics.push({
      name: "Gestão de risco",
      rating: "a melhorar",
    });
  }

  if (record.modifiedAreas && record.modifiedAreas.length > 1) {
    metrics.push({
      name: "Sequenciação de problemas",
      rating: "forte",
      note: `${record.modifiedAreas.length} áreas geridas`,
    });
  }

  if (record.notes) {
    metrics.push({
      name: "Comunicação",
      rating: "forte",
      note: "Notas registadas",
    });
  }

  metrics.push({
    name: "Tomada de decisão",
    rating: record.outcome === "success" ? "forte" : "a melhorar",
  });

  return metrics;
}
