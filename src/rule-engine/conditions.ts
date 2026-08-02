/**
 * Condition evaluation for the rule engine.
 */

import type { RuleCondition, RuleContext } from "../domain/rules/rule.js";
import { DANGEROUS_KEYS } from "./security.js";

function matchesRegex(fieldValue: unknown, targetValue: unknown): boolean {
  try {
    const pattern = String(targetValue);
    if (pattern.length > 200) return false;
    const groupCount = (pattern.match(/\(/g) || []).length;
    if (groupCount > 10) return false;
    const regex = new RegExp(pattern);
    return regex.test(String(fieldValue));
  } catch {
    return false;
  }
}

/** Avalia uma condição contra o contexto. */
export function evaluateCondition(
  condition: RuleCondition,
  context: RuleContext
): boolean {
  const fieldValue = resolveField(condition.field, context);
  const targetValue = condition.value;

  switch (condition.operator) {
    case "equals":
      return fieldValue === targetValue;
    case "not_equals":
      return fieldValue !== targetValue;
    case "contains":
      return String(fieldValue).includes(String(targetValue));
    case "not_contains":
      return !String(fieldValue).includes(String(targetValue));
    case "greater_than":
      return Number(fieldValue) > Number(targetValue);
    case "less_than":
      return Number(fieldValue) < Number(targetValue);
    case "exists":
      return fieldValue !== undefined && fieldValue !== null;
    case "not_exists":
      return fieldValue === undefined || fieldValue === null;
    case "matches_regex":
      return matchesRegex(fieldValue, targetValue);
    default:
      return false;
  }
}

/** Resolve um campo do contexto (notação pontilhada). */
export function resolveField(
  field: string,
  context: RuleContext
): string | number | boolean | undefined {
  const parts = field.split(".");
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (DANGEROUS_KEYS.has(part)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current as string | number | boolean | undefined;
}
