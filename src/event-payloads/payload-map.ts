/**
 * payload-map.ts — Maps each ShitennoEventType to its typed payload.
 *
 * Use this for type-safe publish/subscribe:
 *   bus.publish("session.start", { ...SessionStartPayload })
 *   bus.subscribe("session.start", (payload: EventPayloadMap["session.start"]) => { ... })
 */

import type {
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
  SystemUpdatedPayload,
} from "./types.js";

export interface EventPayloadMap {
  "session.start": SessionStartPayload;
  "session.end": SessionEndPayload;
  "analysis.complete": AnalysisCompletePayload;
  "command.completed": CommandCompletedPayload;
  "score.calculated": ScoreCalculatedPayload;
  "pattern.detected": PatternDetectedPayload;
  "health.checked": HealthCheckedPayload;
  "debt.detected": DebtDetectedPayload;
  "capability.installed": CapabilityInstalledPayload;
  "capability.unlocked": CapabilityUnlockedPayload;
  "maturity.changed": MaturityChangedPayload;
  "rule.triggered": RuleTriggeredPayload;
  "evolution.recommended": EvolutionRecommendedPayload;
  "adr.created": AdrCreatedPayload;
  "skill.created": SkillCreatedPayload;
  "validation.completed": ValidationCompletedPayload;
  "task.completed": TaskCompletedPayload;
  "pipeline.stage.start": PipelineStageStartPayload;
  "pipeline.stage.complete": PipelineStageCompletePayload;
  "pipeline.complete": PipelineCompletePayload;
  "lifecycle.state_changed": LifecycleStateChangedPayload;
  "knowledge.analyzed": KnowledgeAnalyzedPayload;
  "engineering_state.updated": EngineeringStateUpdatedPayload;
  "engineering_state.consolidated": EngineeringStateConsolidatedPayload;
  "knowledge_debt.detected": KnowledgeDebtDetectedPayload;
  "recommendation.accepted": RecommendationAcceptedPayload;
  "recommendation.rejected": RecommendationRejectedPayload;
  "governance.policy_applied": GovernancePolicyAppliedPayload;
  "asset.created": AssetCreatedPayload;
  "asset.updated": AssetUpdatedPayload;
  "asset.archived": AssetArchivedPayload;
  "plan.archived": PlanArchivedPayload;
  "plan.file_changed": PlanFileChangedPayload;
  "plan.status_changed": PlanStatusChangedPayload;
  "plan.format_warning": PlanFormatWarningPayload;
  "backlog.updated": BacklogUpdatedPayload;
  "challenge.generated": ChallengeGeneratedPayload;
  "resource.claimed": ResourceClaimedPayload;
  "resource.released": ResourceReleasedPayload;
  "state.mutated": StateMutatedPayload;
  "entropy.calculated": EntropyCalculatedPayload;
  "docs.sync.triggered": DocsSyncTriggeredPayload;
  "doc.lifecycle.audited": DocLifecycleAuditPayload;
  "system.updated": SystemUpdatedPayload;
}
