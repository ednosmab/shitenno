/**
 * recommendation-engine.ts — Recommendation Engine
 *
 * Continuously answers: "What is the next best action to increase
 * engineering capacity?" Considers complexity, engineering state,
 * knowledge debt, AI readiness, and capabilities.
 *
 * PRINCIPLE: The system should always know what to do next.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../shared/logger.js";
import type { EngineeringState } from "../application/engineering-state.js";
import type { CapabilityEngineResult } from "../application/capability-engine.js";
import { getAllFeedbackSummaries, adjustConfidence, shouldSuppress } from "../application/feedback-loops.js";
import type { Recommendation, RecommendationSource, RecommendationEngineResult, RecommendationEngineOptions } from "./recommend/types.js";
import {
  generateFromCapabilityEngine,
  generateFromKnowledgeDebt,
  generateFromPatternDetection,
  generateFromEntropy,
  generateFromAIReadiness,
  generateFromAssetManagement,
} from "./recommend/generators.js";

export type { Recommendation, RecommendationSource, RecommendationEngineResult, RecommendationEngineOptions } from "./recommend/types.js";

function applyFeedbackLoops(
  recommendations: Recommendation[],
  shitennoDir: string
): Recommendation[] {
  const feedbackSummaries = getAllFeedbackSummaries(shitennoDir);
  const adjusted: Recommendation[] = [];

  for (const rec of recommendations) {
    const summary = feedbackSummaries[rec.id];
    if (summary && shouldSuppress(summary)) continue;
    if (summary) {
      if (summary.lastAction === "accepted") {
        rec.confidence = adjustConfidence(rec.confidence, "accepted");
      } else if (summary.lastAction === "rejected") {
        rec.confidence = adjustConfidence(rec.confidence, "rejected");
      }
    }
    adjusted.push(rec);
  }

  return adjusted;
}

function computeCapacityScore(state: EngineeringState, capResult: CapabilityEngineResult): number {
  return Math.round(
    state.healthScores.knowledgeDebt * 0.25 +
    state.healthScores.knowledgeGraph * 0.2 +
    (100 - state.entropy.score) * 0.25 +
    capResult.overallScore * 0.3
  );
}

function buildSummary(recommendationCount: number, byPriority: Record<string, number>, capacityScore: number): string {
  const parts: string[] = [];
  parts.push(`${recommendationCount} recommendation(s).`);
  if (byPriority.urgent) parts.push(`${byPriority.urgent} urgent.`);
  if (byPriority.high) parts.push(`${byPriority.high} high.`);
  parts.push(`Engineering capacity: ${capacityScore}/100.`);
  return parts.join(" ");
}

function buildRecommendationResult(
  recommendations: Recommendation[],
  state: EngineeringState,
  capResult: CapabilityEngineResult
): RecommendationEngineResult {
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort(
    (x, y) => priorityOrder[x.priority] - priorityOrder[y.priority]
  );

  const bySource: Record<RecommendationSource, number> = {
    capability_engine: 0,
    knowledge_debt: 0,
    pattern_detection: 0,
    entropy_reduction: 0,
    ai_readiness: 0,
    complexity_analysis: 0,
    asset_management: 0,
  };
  const byPriority: Record<string, number> = {};

  for (const rec of recommendations) {
    bySource[rec.source]++;
    byPriority[rec.priority] = (byPriority[rec.priority] || 0) + 1;
  }

  const topNextSteps = recommendations
    .filter((r) => r.priority === "urgent" || r.priority === "high")
    .slice(0, 5)
    .map((r) => r.command || r.action);

  const engineeringCapacityScore = computeCapacityScore(state, capResult);

  return {
    generatedAt: new Date().toISOString(),
    totalRecommendations: recommendations.length,
    bySource: bySource as RecommendationEngineResult["bySource"],
    byPriority,
    recommendations,
    topNextSteps,
    engineeringCapacityScore,
    summary: buildSummary(recommendations.length, byPriority, engineeringCapacityScore),
  };
}

export function runRecommendationEngine(
  options: RecommendationEngineOptions
): RecommendationEngineResult {
  const { state, capResult, shitennoDir, patternReport, knowledgeDebtReport } = options;

  const allRecommendations: Recommendation[] = [
    ...generateFromCapabilityEngine(capResult),
    ...generateFromKnowledgeDebt(knowledgeDebtReport ?? (state.knowledgeDebt as import("../application/knowledge-debt.js").KnowledgeDebtReport | null)),
    ...generateFromPatternDetection(patternReport ?? null),
    ...generateFromEntropy(state),
    ...generateFromAIReadiness(state),
    ...generateFromAssetManagement(state),
  ];

  const adjustedRecommendations = applyFeedbackLoops(allRecommendations, shitennoDir);

  return buildRecommendationResult(adjustedRecommendations, state, capResult);
}

export function saveRecommendationResult(
  shitennoDir: string,
  result: RecommendationEngineResult
): void {
  const filePath = join(shitennoDir, "recommendation-engine.json");
  writeFileSync(filePath, JSON.stringify(result, null, 2), "utf-8");
}

export function loadRecommendationResult(
  shitennoDir: string
): RecommendationEngineResult | null {
  const filePath = join(shitennoDir, "recommendation-engine.json");
  if (!existsSync(filePath)) return null;

  try {
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as RecommendationEngineResult;
  } catch (err) {
    logger.debug("recommendation-engine", `Cannot load recommendation result: ${err}`);
    return null;
  }
}

export function recommendationEngineToText(result: RecommendationEngineResult): string {
  const lines: string[] = [];

  lines.push("# Recommendation Engine Report");
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push(`Engineering Capacity: ${result.engineeringCapacityScore}/100`);
  lines.push("");

  lines.push("## By Source");
  for (const [source, count] of Object.entries(result.bySource)) {
    if (count > 0) {
      lines.push(`  ${source}: ${count}`);
    }
  }
  lines.push("");

  if (result.topNextSteps.length > 0) {
    lines.push("## Top Next Steps");
    for (const step of result.topNextSteps) {
      lines.push(`  → ${step}`);
    }
    lines.push("");
  }

  lines.push("## Recommendations");
  for (const rec of result.recommendations) {
    const icon = rec.priority === "urgent" ? "🔴" : rec.priority === "high" ? "🟡" : rec.priority === "medium" ? "🔵" : "⚪";
    lines.push(`  ${icon} [${rec.id}] ${rec.priority.toUpperCase()} — ${rec.title}`);
    lines.push(`     ${rec.description}`);
    lines.push(`     Impact: ${rec.expectedImpact}`);
    if (rec.command) lines.push(`     Command: ${rec.command}`);
    lines.push("");
  }

  return lines.join("\n");
}
