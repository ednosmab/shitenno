/**
 * extended.ts — Extended event payload types
 *
 * Extracted from types.ts to keep modules under 300 lines.
 */

import type { EventMeta } from "./types.js";

// ── Task Pipeline Events ───────────────────────────────────────────────────

export interface TaskCompletedPayload extends EventMeta {
  taskId: string;
  itemName?: string;
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
  path?: string;
  planId?: string;
  itemId?: string;
  itemName?: string;
  movedCount?: number;
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
