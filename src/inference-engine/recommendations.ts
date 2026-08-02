/**
 * inference-engine/recommendations.ts — Recommendation generation for plan inference
 */

import type { CheckboxSummary, InferredStatus } from "./analysis.js";

export type Recommendation =
  | "archive"
  | "remove"
  | "keep"
  | "investigate";

const OBSOLETE_THRESHOLD_DAYS = 30;

function recommendInProgress(
  checkboxes: CheckboxSummary,
  ageInDays: number
): { recommendation: Recommendation; reason: string; confidence: number } {
  if (ageInDays > OBSOLETE_THRESHOLD_DAYS && checkboxes.percentage < 50) {
    return {
      recommendation: "remove",
      reason: `Only ${checkboxes.percentage}% complete after ${ageInDays} days`,
      confidence: 0.7,
    };
  }
  return {
    recommendation: "keep",
    reason:
      checkboxes.total > 0
        ? `${checkboxes.closed}/${checkboxes.total} steps complete (${checkboxes.percentage}%)`
        : "Plan is actively in progress",
    confidence: 0.6,
  };
}

export function generateRecommendation(
  inferredStatus: InferredStatus,
  checkboxes: CheckboxSummary,
  ageInDays: number,
  rawStatus: string
): { recommendation: Recommendation; reason: string; confidence: number } {
  switch (inferredStatus) {
    case "done":
      return {
        recommendation: "archive",
        reason:
          checkboxes.total > 0
            ? `All ${checkboxes.total} checkboxes complete`
            : "Status explicitly marked as done",
        confidence: checkboxes.total > 0 ? 0.95 : 0.8,
      };
    case "obsolete":
      return { recommendation: "remove", reason: `Plan inactive for ${ageInDays}+ days with abandoned status`, confidence: 0.85 };
    case "inconsistent":
      return {
        recommendation: "investigate",
        reason: `Status says "${rawStatus}" but ${checkboxes.open} of ${checkboxes.total} steps still open`,
        confidence: 0.7,
      };
    case "paused":
      return { recommendation: "keep", reason: "Plan is paused — review before archiving", confidence: 0.6 };
    case "in_progress":
    default:
      return recommendInProgress(checkboxes, ageInDays);
  }
}
