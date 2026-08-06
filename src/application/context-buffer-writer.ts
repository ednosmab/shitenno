/**
 * context-buffer-writer.ts — Centralised buffer updates using YAML.parse/stringify.
 *
 * All writes to context_buffer.yaml MUST go through this module.
 * Uses proper YAML parsing instead of regex to prevent corruption.
 */

export { replaceSectionField, readBufferObject, writeBufferObject } from "../context-buffer-writer/buffer-io.js";

export type { SessionUpdate, CurrentTaskUpdate } from "../context-buffer-writer/updates.js";
export {
  updateSession,
  updateCurrentTask,
  updateNextP0,
  addCompletedTask,
  updateSessionLifecycle,
} from "../context-buffer-writer/updates.js";

export type { ReminderInput } from "../context-buffer-writer/reminders.js";
export { addReminder, clearRemindersByCategory } from "../context-buffer-writer/reminders.js";

export type { Impediment } from "../context-buffer-writer/impediments.js";
export { addImpediment, clearImpediments } from "../context-buffer-writer/impediments.js";

export type { SkillResolutionInput } from "../context-buffer-writer/skill-resolution.js";
export { recordSkillResolution } from "../context-buffer-writer/skill-resolution.js";
