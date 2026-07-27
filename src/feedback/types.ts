/**
 * feedback/types.ts — Types for the Feedback Loop System
 */

/** Performance dimensions inspired by the feedback template. */
export type PerformanceMetric =
  | "architectural_vision"
  | "scope_management"
  | "prompt_quality"
  | "decision_making"
  | "risk_management"
  | "technical_communication"
  | "sustainable_velocity";

/** Human-readable labels for each dimension. */
export const METRIC_LABELS: Record<PerformanceMetric, string> = {
  architectural_vision: "Visão Arquitectural",
  scope_management: "Gestão de Scope",
  prompt_quality: "Qualidade de Prompts",
  decision_making: "Tomada de Decisão",
  risk_management: "Gestão de Risco",
  technical_communication: "Comunicação Técnica",
  sustainable_velocity: "Velocidade Sustentável",
};

export interface FeedbackRecord {
  id: string;
  recommendationId: string;
  action: "accepted" | "rejected" | "deferred";
  reason?: string;
  timestamp: string;
  context: {
    maturityScore: number;
    installedCapabilities: string[];
    knowledgeDebt: number;
  };
  /** Path choice made by the user (for dual-path system). */
  pathChoice?: "comfortable" | "challenging";
  /** Performance dimension this feedback relates to. */
  dimension?: PerformanceMetric;
  /** Concrete evidence for the assessment. */
  evidence?: string;
  /** Session ID where this feedback was given. */
  sessionId?: string;
}

export interface FeedbackSummary {
  recommendationId: string;
  acceptCount: number;
  rejectCount: number;
  deferCount: number;
  totalInteractions: number;
  acceptanceRate: number;
  lastAction: "accepted" | "rejected" | "deferred" | null;
  lastTimestamp: string | null;
  /** Path choice statistics (for dual-path system). */
  pathChoiceStats?: {
    comfortableCount: number;
    challengingCount: number;
    lastPathChoice: "comfortable" | "challenging" | null;
  };
}

export interface FeedbackPattern {
  type: "always_rejects" | "always_accepts" | "rejects_after_threshold" | "defers_frequently";
  recommendationType: string;
  confidence: number;
  description: string;
}

export interface DimensionSummary {
  dimension: PerformanceMetric;
  acceptCount: number;
  rejectCount: number;
  deferCount: number;
  evidence: string[];
}
