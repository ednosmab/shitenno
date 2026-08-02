/**
 * types.ts — Decision engine types.
 */

export type DecisionRecommendation = "proceed" | "proceed_with_caution" | "block" | "defer";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface DecisionRequest {
  id: string;
  action: string;
  category: string;
  targetGoalId?: string;
  context: Record<string, unknown>;
  timestamp: string;
}

export interface EvaluatorScore {
  evaluator: string;
  score: number;
  reasoning: string;
  concerns?: string[];
  mitigations?: string[];
}

export interface Decision {
  id: string;
  request: DecisionRequest;
  scores: EvaluatorScore[];
  compositeScore: number;
  recommendation: DecisionRecommendation;
  confidence: number;
  decidedAt: string;
  justification?: string;
}

export interface DecisionFilter {
  category?: string;
  recommendation?: DecisionRecommendation;
  since?: string;
}
