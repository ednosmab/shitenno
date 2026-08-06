/**
 * reporter/types.ts — Performance Reporting Types
 */

import type { PerformanceMetric } from "../application/feedback-loops.js";

// ── Re-export feedback-loops types ─────────────────────────────────────────

export type { PerformanceMetric } from "../application/feedback-loops.js";

// ── Constants ──────────────────────────────────────────────────────────────

export const METRIC_KEYS: PerformanceMetric[] = [
  "prompt_quality", "scope_management",
  "decision_making", "sustainable_velocity", "risk_management", "technical_communication", "architectural_vision",
];

export const METRIC_LABELS: Record<PerformanceMetric, string> = {
  prompt_quality: "Qualidade do Prompt",
  scope_management: "Gestão de Escopo",
  decision_making: "Tomada de Decisão",
  sustainable_velocity: "Velocidade Sustentável",
  risk_management: "Gestão de Risco",
  technical_communication: "Comunicação Técnica",
  architectural_vision: "Visão Arquitetural",
};

// ── Types ──────────────────────────────────────────────────────────────────

export interface PerformancePeriod {
  from: string;
  to: string;
  days: number;
}

export interface PerformanceProfile {
  dominantDimension: PerformanceMetric | null;
  weakestDimension: PerformanceMetric | null;
  growthPattern: string;
  growthCapacity: number;
  challengeLevel: number;
}

export interface DimensionReport {
  score: number;
  trend: "improving" | "stable" | "declining";
  acceptRate: number;
  evidence: string[];
}

export interface SessionReport {
  total: number;
  avgDuration: number;
  mostActiveDay: string;
  commandFrequency: Record<string, number>;
}

export interface FeedbackReport {
  totalInteractions: number;
  acceptanceRate: number;
  challengingRatio: number;
  patterns: string[];
  suppressedCount: number;
}

export interface PerformanceReport {
  period: PerformancePeriod;
  profile: PerformanceProfile;
  dimensions: Record<PerformanceMetric, DimensionReport>;
  sessions: SessionReport;
  feedback: FeedbackReport;
  debtTrend: { current: number; previous: number; delta: number };
  maturityTrend: { current: number; previous: number; delta: number };
  insights: Insight[];
  nextSteps: string[];
  summary: string;
}

export interface Insight {
  type: "strength" | "improvement" | "suggestion" | "pattern";
  dimension: PerformanceMetric | null;
  text: string;
  evidence?: string;
}

export interface DimensionExtremes {
  strongest: PerformanceMetric | null;
  weakest: PerformanceMetric | null;
  maxScore: number;
  minScore: number;
  allTied: boolean;
}

export interface InsightContext {
  dimensions: Record<PerformanceMetric, DimensionReport>;
  sessionMetrics: import("../infrastructure/session-tracker.js").SessionMetrics;
  debtTrend: import("./telemetry-readers.js").TelemetryTrend;
  maturityTrend: import("./telemetry-readers.js").TelemetryTrend;
  growthProfile: import("../infrastructure/growth-profile.js").GrowthProfile;
}

export interface PerformanceRecommendation {
  dimension: PerformanceMetric;
  action: string;
  reason: string;
  priority: "low" | "medium" | "high";
}
