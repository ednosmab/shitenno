/**
 * context-buffer-writer.ts — Centralised, section-aware buffer updates.
 *
 * All writes to context_buffer.yaml MUST go through this module.
 * Regex operations are section-scoped to prevent cross-section collisions
 * (e.g. updating session.status instead of current_task.status).
 */

export { replaceSectionField } from "./context-buffer-writer/buffer-io.js";

export type { SessionUpdate, CurrentTaskUpdate } from "./context-buffer-writer/updates.js";
export {
  updateSession,
  updateCurrentTask,
  updateNextP0,
  addCompletedTask,
  updateSessionLifecycle,
} from "./context-buffer-writer/updates.js";

export type { ReminderInput } from "./context-buffer-writer/reminders.js";
export { addReminder, clearRemindersByCategory } from "./context-buffer-writer/reminders.js";

export type { Impediment } from "./context-buffer-writer/impediments.js";
export { addImpediment, clearImpediments } from "./context-buffer-writer/impediments.js";

export type { SkillResolutionInput } from "./context-buffer-writer/skill-resolution.js";
export { recordSkillResolution } from "./context-buffer-writer/skill-resolution.js";
