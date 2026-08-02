/**
 * feedback-loops.ts — Recommendation Feedback System
 *
 * Tracks acceptance/rejection of recommendations and adjusts
 * future recommendations based on patterns.
 * Now includes dimension tracking for user performance reporting.
 *
 * PRINCIPLE: The system learns from human decisions.
 */

// ── Re-exports from split modules ───────────────────────────────────────────

export type {
  PerformanceMetric,
  FeedbackRecord,
  FeedbackSummary,
  FeedbackPattern,
  DimensionSummary,
} from "./feedback/types.js";

export { METRIC_LABELS } from "./feedback/types.js";

export {
  recordFeedback,
  getFeedbackRecords,
  getFeedbackSummary,
  getAllFeedbackSummaries,
  adjustConfidence,
  shouldSuppress,
  detectFeedbackPatterns,
} from "./feedback/core.js";

export {
  recordDimensionFeedback,
  getDimensionSummary,
  getAllDimensionSummaries,
} from "./feedback/dimensions.js";
