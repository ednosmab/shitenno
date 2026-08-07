/**
 * Barrel export for the rule-engine module.
 */

export { isScriptAllowed, isShugoCommandAllowed, getAllowedScriptCommand, getAllowedShugoCommand, isValidRuleId, DANGEROUS_KEYS } from "../shared/security.js";
export { VALID_ACTION_TYPES, validateRule, type ValidationResult } from "./validation.js";
export { evaluateCondition, resolveField } from "../shared/conditions.js";
export { executeAction } from "./actions.js";
export { getDefaultRules } from "./defaults.js";
export { loadRules, saveRule, executeRules, initializeRules, initializeRuleEngine } from "./engine.js";
export {
  type PolicyMode,
  type PolicyEffect,
  type ComparisonOperator,
  type PolicyCondition,
  type PolicyAction,
  type Policy,
  type PolicyResult,
  type PolicyEvaluation,
  type PolicyFilter,
  type PolicyRepository,
  FilePolicyRepository,
  PolicyEngine,
  evaluateCondition as evaluatePolicyCondition,
} from "../infrastructure/policy.js";
