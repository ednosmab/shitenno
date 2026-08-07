/**
 * Action execution for the rule engine.
 *
 * Legacy compatibility shim — the nine action implementations now live in
 * decision-core/executors/rule-actions.ts (ADR-009 unified execution core).
 * Kept for backward compatibility with consumers of rule-engine/actions.js.
 */

export { executeAction } from "../decision-core/executors/rule-actions.js";
