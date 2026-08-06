/**
 * knowledge-debt.ts — Pilar 8: Knowledge Debt
 *
 * Thin facade — all logic split into knowledge-debt/ modules.
 */

export type { DebtType, DebtSeverity, KnowledgeGap, KnowledgeDebtReport } from "../knowledge-debt/types.js";
export { detectKnowledgeDebt, writeDebtReport } from "../knowledge-debt/engine.js";
