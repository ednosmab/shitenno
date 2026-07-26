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

// ── Task Pipeline Events ───────────────────────────────────────────────────

export interface TaskCompletedPayload extends EventMeta {
  taskId: string;
  source: string;
  affectedFiles: string[];
  gates: { name: string; passed: boolean }[];
}

// ── Pipeline Events ────────────────────────────────────────────────────────

export interface PipelineStageStartPayload extends EventMeta {
  pipelineId: string;
  stage: string;
  stageIndex: number;
  totalStages: number;
}

export interface PipelineStageCompletePayload extends EventMeta {
  pipelineId: string;
  stage: string;
  stageIndex: number;
  totalStages: number;
  success: boolean;
  duration: number;
}

export interface PipelineCompletePayload extends EventMeta {
  pipelineId: string;
  stages: string[];
  totalDuration: number;
  success: boolean;
}

// ── Lifecycle Events ───────────────────────────────────────────────────────

export interface LifecycleStateChangedPayload extends EventMeta {
  capabilityId: string;
  previousState: string;
  newState: string;
  reason?: string;
}

// ── Knowledge Events ───────────────────────────────────────────────────────

export interface KnowledgeAnalyzedPayload extends EventMeta {
  artifactsScanned: number;
  relationsFound: number;
  healthScore: number;
  cyclesDetected: number;
}

export interface EngineeringStateUpdatedPayload extends EventMeta {
  dimension: string;
  previousValue: unknown;
  newValue: unknown;
  source: string;
}

export interface EngineeringStateConsolidatedPayload extends EventMeta {
  totalDimensions: number;
  changedDimensions: string[];
  overallHealth: number;
}

export interface KnowledgeDebtDetectedPayload extends EventMeta {
  gapCount: number;
  gaps: Array<{ source: string; gap: string; severity: "low" | "medium" | "high" }>;
}

// ── Recommendation Events ──────────────────────────────────────────────────

export interface RecommendationAcceptedPayload extends EventMeta {
  recommendationId: string;
  category: string;
  action: string;
  confidence: number;
}

export interface RecommendationRejectedPayload extends EventMeta {
  recommendationId: string;
  category: string;
  action: string;
  reason?: string;
}

// ── Governance Events ──────────────────────────────────────────────────────

export interface GovernancePolicyAppliedPayload extends EventMeta {
  policyId: string;
  policyName: string;
  action: "enforced" | "advisory" | "violated";
  details?: string;
}

// ── Asset Lifecycle Events ─────────────────────────────────────────────────

export interface AssetCreatedPayload extends EventMeta {
  assetId: string;
  assetType: string;
  path: string;
}

export interface AssetUpdatedPayload extends EventMeta {
  assetId: string;
  assetType: string;
  path: string;
  changes: string[];
}

export interface AssetArchivedPayload extends EventMeta {
  assetId: string;
  assetType: string;
  path: string;
  reason?: string;
}

// ── Plan Events ─────────────────────────────────────────────────────────────

export interface PlanArchivedPayload extends EventMeta {
  planId: string;
  title: string;
  path: string;
  finalStatus: string;
}

export interface PlanStatusChangedPayload extends EventMeta {
  planId: string;
  oldStatus: string;
  newStatus: string;
  path: string;
}

export interface PlanFileChangedPayload extends EventMeta {
  planId: string;
  path: string;
  content: string;
}

export interface PlanFormatWarningPayload extends EventMeta {
  planId: string;
  path: string;
  errors: Array<{ rule: string; message: string; line?: number; fix?: string }>;
  warnings: Array<{ rule: string; message: string; line?: number; fix?: string }>;
}

export interface BacklogUpdatedPayload extends EventMeta {
  path: string;
  timestamp: string;
}

// ── Challenge Events ──────────────────────────────────────────────────────

export interface ChallengeGeneratedPayload extends EventMeta {
  type: "entropy_reduction" | "knowledge_gap" | "capability_stale";
  severity: "low" | "medium" | "high";
  description: string;
}

// ── Resource Arbitration Events ────────────────────────────────────────────

/** Emitted by the CLI when it starts working on a resource (plan/task). */
export interface ResourceClaimedPayload extends EventMeta {
  resourceId: string;
  resourceType: "plan" | "task";
  sessionId: string;
}

/** Emitted by the CLI when it finishes working on a resource. */
export interface ResourceReleasedPayload extends EventMeta {
  resourceId: string;
  sessionId: string;
}

// ── State Mutation Events ──────────────────────────────────────────────────

export interface StateMutatedPayload extends EventMeta {
  source: string;
  trigger: string;
  description: string;
}

// ── Entropy Events ─────────────────────────────────────────────────────────

export interface EntropyCalculatedPayload extends EventMeta {
  projectId: string;
  entropyScore: number;
  factors: Record<string, number>;
}

// ── Doc Sync Events ────────────────────────────────────────────────────────

export interface DocsSyncTriggeredPayload extends EventMeta {
  path: string;
  relativePath: string;
  significance: number;
  level: "ignore" | "low" | "medium" | "high";
  outputLevel: "silent" | "minimal" | "verbose";
  reasons: string[];
}

// ── Doc Lifecycle Events ───────────────────────────────────────────────────

export interface DocLifecycleAuditPayload extends EventMeta {
  totalDocuments: number;
  classified: Record<string, number>;
  clustersDetected: number;
  movesProposed: number;
}

export interface SystemUpdatedPayload extends EventMeta {
  filesChanged: number;
  cliVersion: string;
}

export interface PipelinePartialFailurePayload extends EventMeta {
  taskId: string;
  backlogUpdated: boolean;
  planArchived: boolean;
  errors: string[];
}

// ── Payload Map ────────────────────────────────────────────────────────────

/**
 * Maps each ShitennoEventType to its typed payload.
 * Use this for type-safe publish/subscribe:
 *   bus.publish("session.start", { ...SessionStartPayload })
 *   bus.subscribe("session.start", (payload: EventPayloadMap["session.start"]) => { ... })
 */
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
  "pipeline.partial_failure": PipelinePartialFailurePayload;
}
