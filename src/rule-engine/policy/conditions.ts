/**
 * conditions.ts — Condition evaluator for policy engine.
 */

import type { PolicyCondition, ComparisonOperator } from "./types.js";

function evalEquality(fieldValue: unknown, targetValue: unknown, operator: ComparisonOperator): boolean | null {
  switch (operator) {
    case "equals": return fieldValue === targetValue;
    case "not_equals": return fieldValue !== targetValue;
    default: return null;
  }
}

function evalComparison(fieldValue: unknown, targetValue: unknown, operator: ComparisonOperator): boolean | null {
  switch (operator) {
    case "greater_than": return Number(fieldValue) > Number(targetValue);
    case "less_than": return Number(fieldValue) < Number(targetValue);
    case "greater_or_equal": return Number(fieldValue) >= Number(targetValue);
    case "less_or_equal": return Number(fieldValue) <= Number(targetValue);
    default: return null;
  }
}

function evalStringOps(fieldValue: unknown, targetValue: unknown, operator: ComparisonOperator): boolean | null {
  if (typeof fieldValue !== "string") {
    if (Array.isArray(fieldValue)) return null;
    return operator === "not_contains" ? true : null;
  }
  switch (operator) {
    case "contains": return fieldValue.includes(String(targetValue));
    case "not_contains": return !fieldValue.includes(String(targetValue));
    case "starts_with": return fieldValue.startsWith(String(targetValue));
    case "ends_with": return fieldValue.endsWith(String(targetValue));
    default: return null;
  }
}

function evalRegex(fieldValue: unknown, targetValue: unknown): boolean {
  if (typeof fieldValue !== "string") return false;
  try { return new RegExp(String(targetValue)).test(fieldValue); } catch { return false; }
}

function evalMembership(fieldValue: unknown, targetValue: unknown, operator: "in" | "not_in"): boolean {
  if (Array.isArray(targetValue)) {
    return operator === "in"
      ? targetValue.includes(fieldValue)
      : !targetValue.includes(fieldValue);
  }
  return operator === "not_in";
}

function evalExistence(fieldValue: unknown, operator: "exists" | "not_exists"): boolean {
  return operator === "exists"
    ? fieldValue !== undefined && fieldValue !== null
    : fieldValue === undefined || fieldValue === null;
}

function evalCollectionOps(fieldValue: unknown, targetValue: unknown, operator: ComparisonOperator): boolean | null {
  switch (operator) {
    case "contains":
      return Array.isArray(fieldValue) ? fieldValue.includes(targetValue) : null;
    case "not_contains":
      return Array.isArray(fieldValue) ? !fieldValue.includes(targetValue) : null;
    case "matches_regex":
      return evalRegex(fieldValue, targetValue);
    case "in":
    case "not_in":
      return evalMembership(fieldValue, targetValue, operator);
    case "exists":
    case "not_exists":
      return evalExistence(fieldValue, operator);
    default:
      return null;
  }
}

function getFieldValue(path: string, obj: Record<string, unknown>): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

export function evaluateCondition(
  condition: PolicyCondition,
  context: Record<string, unknown>
): boolean {
  const fieldValue = getFieldValue(condition.field, context);
  const targetValue = condition.value;
  const op = condition.operator;

  return evalEquality(fieldValue, targetValue, op)
    ?? evalComparison(fieldValue, targetValue, op)
    ?? evalStringOps(fieldValue, targetValue, op)
    ?? evalCollectionOps(fieldValue, targetValue, op)
    ?? false;
}
