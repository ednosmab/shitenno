/**
 * Rule schema validation.
 */

import type { ActionType } from "../domain/rules/rule.js";
import { VALID_ACTION_TYPES } from "../domain/rules/rule.js";

// ── Schema Validation ────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export { VALID_ACTION_TYPES };

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
