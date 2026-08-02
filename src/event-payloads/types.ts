/**
 * types.ts — Typed Payloads for All Shugo Events.
 */

// ── Correlation & Trace ────────────────────────────────────────────────────

/** Unique identifier linking events within a single user action or pipeline run. */
export type CorrelationId = string;

/** Unique identifier for a single event emission (enables event-level tracing). */
export type TraceId = string;

/** Base fields present on every event payload. */
export interface EventMeta {
  /** Correlation ID — groups events from the same user action/pipeline. */
  correlationId?: CorrelationId;
  /** Trace ID — unique per-event emission for distributed tracing. */
  traceId?: TraceId;
  /** ISO-8601 timestamp of event emission. */
  timestamp: string;
}

// ── Session Events ─────────────────────────────────────────────────────────

export interface SessionStartPayload extends EventMeta {
  sessionId: string;
  projectRoot: string;
  agentName?: string;
}

export interface SessionEndPayload extends EventMeta {
  sessionId: string;
  duration: number;
  outcome: "success" | "partial" | "failed";
}

// ── Analysis Events ────────────────────────────────────────────────────────

export interface CommandCompletedPayload extends EventMeta {
  command: string;
  projectRoot: string;
  duration: number;
}

export interface AnalysisCompletePayload extends EventMeta {
  projectId: string;
  maturityScore: number;
  dimensions: Record<string, number>;
  recommendations: string[];
}

export interface ScoreCalculatedPayload extends EventMeta {
  projectId: string;
  score: number;
  previousScore?: number;
  delta?: number;
}

// ── Pattern Events ─────────────────────────────────────────────────────────

export interface PatternDetectedPayload extends EventMeta {
  patternId: string;
  patternType: "positive" | "negative" | "neutral";
  source: string;
  confidence: number;
  description: string;
}

// ── Health Events ──────────────────────────────────────────────────────────

export interface HealthCheckedPayload extends EventMeta {
  status: "healthy" | "degraded" | "critical";
  issues: string[];
  checksRun: number;
}

// ── Debt Events ────────────────────────────────────────────────────────────

export interface DebtDetectedPayload extends EventMeta {
  debtType: "knowledge" | "technical" | "documentation";
  severity: "low" | "medium" | "high";
  source: string;
  description: string;
}

// ── Capability Events ──────────────────────────────────────────────────────

export interface CapabilityInstalledPayload extends EventMeta {
  capabilityId: string;
  capabilityName: string;
  version?: string;
}

export interface CapabilityUnlockedPayload extends EventMeta {
  capabilityId: string;
  previousLevel: string;
  newLevel: string;
}

// ── Maturity Events ────────────────────────────────────────────────────────

export interface MaturityChangedPayload extends EventMeta {
  dimension: string;
  previousScore: number;
  newScore: number;
  delta: number;
}

// ── Rule Events ────────────────────────────────────────────────────────────

export interface RuleTriggeredPayload extends EventMeta {
  ruleId: string;
  ruleDescription: string;
  actionsExecuted: number;
  success: boolean;
}

// ── Evolution Events ───────────────────────────────────────────────────────

export interface EvolutionRecommendedPayload extends EventMeta {
  recommendationId: string;
  category: "maturity" | "capability" | "governance";
  description: string;
  priority: "low" | "medium" | "high";
}

// ── Asset Events ───────────────────────────────────────────────────────────

export interface AdrCreatedPayload extends EventMeta {
  adrId: string;
  title: string;
  status: "proposed" | "accepted" | "deprecated" | "superseded";
}

export interface SkillCreatedPayload extends EventMeta {
  skillId: string;
  skillName: string;
  template?: string;
}

// ── Validation Events ──────────────────────────────────────────────────────

export interface ValidationCompletedPayload extends EventMeta {
  validatorType: string;
  passed: boolean;
  issues: string[];
  duration: number;
}

// ── Re-export Extended Payloads ────────────────────────────────────────────

export type {
  TaskCompletedPayload,
  PipelineStageStartPayload, PipelineStageCompletePayload, PipelineCompletePayload,
  LifecycleStateChangedPayload,
  KnowledgeAnalyzedPayload, EngineeringStateUpdatedPayload,
  EngineeringStateConsolidatedPayload, KnowledgeDebtDetectedPayload,
  RecommendationAcceptedPayload, RecommendationRejectedPayload,
  GovernancePolicyAppliedPayload,
  AssetCreatedPayload, AssetUpdatedPayload, AssetArchivedPayload,
  PlanArchivedPayload, PlanStatusChangedPayload, PlanFileChangedPayload,
  PlanFormatWarningPayload, BacklogUpdatedPayload,
  ChallengeGeneratedPayload,
  ResourceClaimedPayload, ResourceReleasedPayload,
  StateMutatedPayload, EntropyCalculatedPayload,
  DocsSyncTriggeredPayload, DocLifecycleAuditPayload,
  SystemUpdatedPayload, PipelinePartialFailurePayload,
} from "./extended.js";

// ── Re-export Payload Map ──────────────────────────────────────────────────

export type { EventPayloadMap } from "./payload-map.js";
