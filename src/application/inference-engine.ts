/**
 * inference-engine.ts — Plan Inference Engine
 *
 * Pure module (no side effects, no UI dependencies).
 * Produces canonical InferenceResult[] from filesystem state.
 *
 * Each consumer (CLI, TUI, MCP, opencode) decides how to render.
 */

import { readFileSync } from "node:fs";
import { MarkdownPlanEngine, type MarkdownPlan } from "../infrastructure/markdown-plan-engine.js";
import { countCheckboxes, calculateAgeInDays, inferStatus, type InferredStatus, type CheckboxSummary } from "../inference-engine/analysis.js";
import { generateRecommendation, type Recommendation } from "../inference-engine/recommendations.js";

export type { InferredStatus, CheckboxSummary } from "../inference-engine/analysis.js";
export type { Recommendation } from "../inference-engine/recommendations.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PlanInference {
  id: string;
  title: string;
  rawStatus: string;
  inferredStatus: InferredStatus;
  checkboxes: CheckboxSummary;
  ageInDays: number;
  estado: string | null;
  recommendation: Recommendation;
  reason: string;
  confidence: number;
}

export interface InferenceSummary {
  generatedAt: string;
  totalPlans: number;
  byStatus: Record<InferredStatus, number>;
  byRecommendation: Record<Recommendation, number>;
  plans: PlanInference[];
  summary: string;
}

// ── InferenceEngine ────────────────────────────────────────────────────────

export class InferenceEngine {
  private engine: MarkdownPlanEngine;

  constructor(shitennoDir: string) {
    this.engine = new MarkdownPlanEngine(shitennoDir);
  }

  inferPlan(plan: MarkdownPlan): PlanInference {
    const content = readFileSync(plan.filePath, "utf-8");
    const checkboxes = countCheckboxes(content);
    const ageInDays = calculateAgeInDays(plan.filePath);
    const estado = plan.metadata["estado"] || null;

    const inferredStatus = inferStatus(plan.status, checkboxes, ageInDays, estado);
    const { recommendation, reason, confidence } = generateRecommendation(inferredStatus, checkboxes, ageInDays, plan.status);

    return {
      id: plan.id,
      title: plan.title,
      rawStatus: plan.status,
      inferredStatus,
      checkboxes,
      ageInDays,
      estado,
      recommendation,
      reason,
      confidence,
    };
  }

  inferAllPlans(): PlanInference[] {
    const plans = this.engine.listAll();
    return plans.map((plan) => this.inferPlan(plan));
  }

  generateSummary(): InferenceSummary {
    const allInferences = this.inferAllPlans();

    const inferences = allInferences.filter((inf) => {
      if (inf.inferredStatus === "inconsistent") return true;
      if (inf.inferredStatus !== "done") return true;
      return false;
    });

    const byStatus: Record<InferredStatus, number> = {
      done: 0, in_progress: 0, paused: 0, obsolete: 0, inconsistent: 0,
    };
    const byRecommendation: Record<Recommendation, number> = {
      archive: 0, remove: 0, keep: 0, investigate: 0,
    };

    for (const inf of inferences) {
      byStatus[inf.inferredStatus]++;
      byRecommendation[inf.recommendation]++;
    }

    return {
      generatedAt: new Date().toISOString(),
      totalPlans: inferences.length,
      byStatus,
      byRecommendation,
      plans: inferences,
      summary: this.buildSummaryText(inferences, byRecommendation),
    };
  }

  private buildSummaryText(
    inferences: PlanInference[],
    byRecommendation: Record<Recommendation, number>
  ): string {
    if (inferences.length === 0) return "No active plans found.";

    const parts: string[] = [];
    if (byRecommendation.archive > 0) parts.push(`${byRecommendation.archive} ready to archive`);
    if (byRecommendation.remove > 0) parts.push(`${byRecommendation.remove} recommended to remove`);
    if (byRecommendation.investigate > 0) parts.push(`${byRecommendation.investigate} need investigation`);
    if (byRecommendation.keep > 0) parts.push(`${byRecommendation.keep} in progress`);

    return `${inferences.length} active plan(s): ${parts.join(", ")}`;
  }
}
