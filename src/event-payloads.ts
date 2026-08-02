/**
 * event-payloads.ts — Typed Payloads for All Shugo Events
 *
 * Provides strongly-typed interfaces for every ShitennoEventType.
 * Ensures compile-time safety when publishing and subscribing to events.
 *
 * PRINCIPLE: Every event carries a typed payload — no `unknown` at call sites.
 */

export type { CorrelationId, TraceId, EventMeta } from "./event-payloads/types.js";
export type {
  SessionStartPayload, SessionEndPayload,
  CommandCompletedPayload, AnalysisCompletePayload, ScoreCalculatedPayload,
  PatternDetectedPayload, HealthCheckedPayload, DebtDetectedPayload,
  CapabilityInstalledPayload, CapabilityUnlockedPayload,
  MaturityChangedPayload, RuleTriggeredPayload,
  EvolutionRecommendedPayload, AdrCreatedPayload, SkillCreatedPayload,
  ValidationCompletedPayload, TaskCompletedPayload,
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
  EventPayloadMap,
} from "./event-payloads/types.js";

import type { EventPayloadMap, CorrelationId, TraceId } from "./event-payloads/types.js";

/**
 * Creates a payload with automatic trace ID and optional correlation ID.
 * Use this when publishing events to ensure consistent metadata.
 */
export function createEventPayload<T extends keyof EventPayloadMap>(

  data: Omit<EventPayloadMap[T], "timestamp" | "traceId" | "correlationId">,
  options?: { correlationId?: CorrelationId; traceId?: TraceId }
): EventPayloadMap[T] {
  return {
    ...data,
    timestamp: new Date().toISOString(),
    traceId: options?.traceId ?? crypto.randomUUID(),
    correlationId: options?.correlationId,
  } as EventPayloadMap[T];
}
