/**
 * health-score-registry.ts — Unified Health Score System
 *
 * Provides three distinct health scores with clear labels:
 * - Code Security: Dampened exponential decay based on audit issues
 * - Engineering Risk: Dampened exponential decay based on doctor findings
 * - Knowledge Health: Weighted average of knowledge debt, graph, and entropy
 *
 * PRINCIPLE: Each score measures a different dimension. Labels prevent confusion.
 * Small samples share the dampened bounded formula (sqrt damping + sample floor)
 * so a cluster of findings in a small project does not zero the score by noise.
 */

import { calculateBoundedHealthScore, type SeverityBucket } from "../../shared/bounded-health-score.js";
import { HEALTH_SCORE_DEDUCTIONS } from "../../shared/formatting.js";

// ── Types ───────────────────────────────────────────────────────────────────

export type HealthScoreType = "code_security" | "engineering_risk" | "knowledge_health";

export interface HealthScoreResult {
  type: HealthScoreType;
  label: string;
  score: number;
  maxScore: number;
  formula: string;
}

// ── Code Security Score ────────────────────────────────────────────────────

// ── Engineering Risk Score ─────────────────────────────────────────────────

/**
 * Calculate Engineering Risk score using the dampened bounded formula.
 * sampleSize is the project scope (e.g. source file count) — NOT the finding
 * count, which would zero the score on small samples. Sample floor of 5
 * prevents degenerate zero-scope projects from reporting noise.
 */
export function getEngineeringRiskScore(
  findings: { severity: string }[],
  sampleSize: number
): HealthScoreResult {
  const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
  const buckets: SeverityBucket[] = Object.entries(HEALTH_SCORE_DEDUCTIONS).map(([key, weight]) => ({
    key,
    weight,
    count: bySeverity[key] ?? 0,
  }));
  const score = calculateBoundedHealthScore({ buckets, sampleSize, minSampleSize: 5 });

  return {
    type: "engineering_risk",
    label: "Engineering Risk",
    score,
    maxScore: 100,
    formula: "dampened: sqrt(count) per severity, sample = project scope (files), floor = 5",
  };
}

// ── Knowledge Health Score ─────────────────────────────────────────────────

/**
 * Calculate Knowledge Health score using weighted average.
 * Based on the actual engineering-state formula.
 */
export function getKnowledgeHealthScore(
  knowledgeDebtScore: number,
  knowledgeGraphScore: number,
  entropyScore: number
): HealthScoreResult {
  const weights = { knowledgeDebt: 0.4, knowledgeGraph: 0.3, entropy: 0.3 };
  const entropyInverse = 100 - entropyScore;

  const score = Math.round(
    knowledgeDebtScore * weights.knowledgeDebt +
    knowledgeGraphScore * weights.knowledgeGraph +
    entropyInverse * weights.entropy
  );

  return {
    type: "knowledge_health",
    label: "Knowledge Health",
    score: Math.max(0, Math.min(100, score)),
    maxScore: 100,
    formula: "debt*0.4 + graph*0.3 + (100-entropy)*0.3",
  };
}
