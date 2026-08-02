/**
 * Rule schema validation.
 */

import type { ActionType } from "../domain/rules/rule.js";

// ── Schema Validation ────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export const VALID_ACTION_TYPES: readonly ActionType[] = [
  "update_context_buffer", "create_reminder", "remove_reminder",
  "update_quick_board", "create_adr", "create_skill", "log_event",
  "send_notification", "trigger_assessment", "trigger_health_check",
  "update_backlog", "run_local_script", "run_script", "run_shugo_command",
  "update_file", "create_file", "remove_file", "update_backlog_status",
  "archive_plan", "auto_populate_next_p0", "apply_autofix",
];

function validateRuleShape(rule: unknown): string[] {
  const errors: string[] = [];
  if (typeof rule !== "object" || rule === null) return ["Rule is not an object"];
  const r = rule as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) errors.push("Missing or invalid 'id'");
  if (typeof r.trigger !== "string") errors.push("Missing or invalid 'trigger'");
  if (!Array.isArray(r.conditions)) errors.push("'conditions' must be an array");
  if (!Array.isArray(r.actions)) errors.push("'actions' must be an array");
  if (typeof r.priority !== "number") errors.push("'priority' must be a number");
  if (r.tags !== undefined && !Array.isArray(r.tags)) errors.push("'tags' must be an array");
  if (r.requiredCapability !== undefined && typeof r.requiredCapability !== "string") errors.push("'requiredCapability' must be a string");
  if (r.autonomous !== undefined && typeof r.autonomous !== "boolean") errors.push("'autonomous' must be a boolean");
  return errors;
}

function validateActions(rule: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!Array.isArray(rule.actions)) return errors;
  for (const action of rule.actions) {
    if (typeof action !== "object" || action === null) {
      errors.push("Action is not an object");
      continue;
    }
    const a = action as Record<string, unknown>;
    if (!VALID_ACTION_TYPES.includes(a.type as ActionType)) errors.push(`Invalid action type: "${a.type}"`);
    if (typeof a.params !== "object" || a.params === null) errors.push(`Action "${a.type}" missing 'params'`);
  }
  return errors;
}

export function validateRule(rule: unknown): ValidationResult {
  const errors = [...validateRuleShape(rule), ...validateActions(rule as Record<string, unknown>)];
  return { valid: errors.length === 0, errors };
}
