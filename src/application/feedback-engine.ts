/**
 * feedback-engine.ts — Context Pipeline: Personalized Feedback Engine
 *
 * Thin facade — all logic split into engine/feedback/ modules.
 */

// ── Re-exports from engine/feedback/ ────────────────────────────────────────

export type {
  SkillLevel,
  FeedbackTone,
  UserProfile,
  FeedbackItem,
  LeadershipMetrics,
  PersonalizedFeedback,
  SessionBehaviorData,
} from "../engine/feedback/profile.js";

export type { SessionFeedbackRecord } from "../engine/feedback/profile.js";

export {
  loadUserProfile,
  saveUserProfile,
  inferProfile,
  updateProfileFromSession,
  calibrateTone,
  getToneGreeting,
} from "../engine/feedback/profile.js";

export { generatePersonalizedFeedback } from "../engine/feedback/generator.js";

export { formatFeedbackAsMarkdown } from "../engine/feedback/formatter.js";
