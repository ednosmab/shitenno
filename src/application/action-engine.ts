/**
 * action-engine.ts — Idempotent Action Engine
 *
 * Executes actions with idempotency guarantees via Action ID + Correlation ID + Execution Hash.
 * Supports rollback, status tracking, and action executors.
 *
 * Architecture: Action (request) → Executor → Execution Record → Rollback
 */

export type { ActionStatus, ActionResult, ActionRequest, ExecutionRecord, RollbackRecord, ActionFilter, ActionExecutor, ExecutionRepository } from "../action-engine/types.js";
export { LogEventExecutor, NotifyExecutor, FileExecutionRepository } from "../action-engine/executors.js";
export { computeExecutionHash, ActionEngine } from "../action-engine/engine.js";
