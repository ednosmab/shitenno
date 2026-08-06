/**
 * rule-engine.ts — Pilar 5: Rule Engine (facade)
 *
 * Centraliza todos os comportamentos automáticos do Shugo.
 * Mecanismo declarativo para gatilhos: quando algo acontece,
 * o engine avalia condições e executa acções.
 *
 * PRINCÍPIO: Declaração sobre imperativo.
 * Novos comportamentos sem alterar código — apenas adicionar regras.
 */

// Re-export all public API from the rule-engine module
export {
  isScriptAllowed,
  isShugoCommandAllowed,
  getAllowedScriptCommand,
  getAllowedShugoCommand,
  isValidRuleId,
  DANGEROUS_KEYS,
} from "../rule-engine/security.js";

export {
  VALID_ACTION_TYPES,
  validateRule,
  type ValidationResult,
} from "../rule-engine/validation.js";

export {
  evaluateCondition,
  resolveField,
} from "../rule-engine/conditions.js";

export { executeAction } from "../rule-engine/actions.js";
export { getDefaultRules } from "../rule-engine/defaults.js";
export {
  loadRules,
  saveRule,
  executeRules,
  initializeRules,
  initializeRuleEngine,
} from "../rule-engine/engine.js";

// Re-export types from domain
export type {
  TriggerType,
  ConditionOperator,
  ActionType,
  Rule,
  RuleCondition,
  RuleAction,
  RuleContext,
  RuleResult,
  EngineResult,
} from "../domain/rules/rule.js";
