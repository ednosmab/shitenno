/**
 * prioritization/index.ts — Public API for the prioritization module.
 *
 * Consolidates: goal-engine, decision-engine, recommendation-engine, proactive-engine.
 * Only this file should be imported by code outside src/prioritization/.
 */

export {
  type GoalStatus,
  type GoalPriority,
  type Goal,
  type GoalFilter,
  type GoalRepository,
  FileGoalRepository,
  GoalEngine,
  getGoalEngine,
  resetGoalEngine,
} from "./goals.js";

export {
  type DecisionRecommendation,
  type RiskLevel,
  type DecisionRequest,
  type EvaluatorScore,
  type Decision,
  type DecisionFilter,
  type Evaluator,
  GoalEvaluator,
  RiskEvaluator,
  ImpactEvaluator,
  ConfidenceEvaluator,
  DebtEvaluator,
  type DecisionRepository,
  FileDecisionRepository,
  DecisionEngine,
} from "./evaluators.js";

export {
  type RecommendationSource,
  type Recommendation,
  type RecommendationEngineResult,
  type RecommendationEngineOptions,
  runRecommendationEngine,
  saveRecommendationResult,
  loadRecommendationResult,
  recommendationEngineToText,
} from "./recommend.js";

export { initializeProactiveEngine } from "./triggers.js";
