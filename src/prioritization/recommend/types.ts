/**
 * types.ts — Recommendation engine types.
 */

import type { EngineeringState } from "../../application/engineering-state.js";
import type { CapabilityEngineResult } from "../../application/capability-engine.js";
import type { KnowledgeDebtReport } from "../../application/knowledge-debt.js";
import type { PatternDetectionReport } from "../../infrastructure/pattern-detector.js";

export type RecommendationSource =
  | "capability_engine"
  | "knowledge_debt"
  | "pattern_detection"
  | "entropy_reduction"
  | "ai_readiness"
  | "complexity_analysis"
  | "asset_management";

export interface Recommendation {
  id: string;
  source: RecommendationSource;
  type: string;
  priority: "urgent" | "high" | "medium" | "low";
  title: string;
  description: string;
  expectedImpact: string;
  action: string;
  command?: string;
  affectedArtifacts: string[];
  dependencies: string[];
  confidence: number;
  evidence: string[];
  generatedAt: string;
}

export interface RecommendationEngineResult {
  generatedAt: string;
  totalRecommendations: number;
  bySource: Record<RecommendationSource, number>;
  byPriority: Record<string, number>;
  recommendations: Recommendation[];
  topNextSteps: string[];
  engineeringCapacityScore: number;
  summary: string;
}

export interface RecommendationEngineOptions {
  state: EngineeringState;
  capResult: CapabilityEngineResult;
  shitennoDir: string;
  patternReport?: PatternDetectionReport | null;
  knowledgeDebtReport?: KnowledgeDebtReport | null;
}
