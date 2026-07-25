/**
 * task-completion-pipeline.ts — Task Completion Pipeline
 *
 * DUAS PORTAS DE ENTRADA PARA "DONE" (ver BLOCO Q):
 *   1. task-completion-pipeline.ts → runCompletionPipeline()
 *      cobre: tests, lint, documentation, backlog, plan_status
 *      NÃO cobre: build, gate_self_test
 *   2. plan-lifecycle.ts → runAutoVerification() / runLifecycleReview()
 *      cobre: build, tests, lint, gate_self_test
 *      NÃO cobre: documentation, backlog
 * Um plano pode ser arquivado por qualquer uma das duas sem passar pelos
 * checks exclusivos da outra. Se isso mudar de ser aceitável, ver o teste
 * done-entrypoints-coverage.test.ts.
 *
 * Implements the 3-layer automated task completion pipeline:
 * Layer 1: Completion Gates (5 gates)
 * Layer 2: Backlog State Machine
 * Layer 3: Event-Driven Pipeline (plan archive + buffer update)
 *
 * Flow: validate gates → publish event → transition backlog → archive plan → update buffer
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.js";
import { matchesTaskId } from "./id-matcher.js";
import { validateCompletionGate, type CompletionResult } from "./task-completion.js";
import { archivePlan } from "./plan-lifecycle.js";
import { completeTask } from "./backlog-state-machine.js";
import { getEventBus } from "./event-bus.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PipelineResult {
  success: boolean;
  taskId: string;
  gates: CompletionResult;
  backlogUpdated: boolean;
  planArchived: boolean;
  eventPublished: boolean;
  errors: string[];
  /** true when a side-effecting step (backlog write) succeeded but a later
   *  step (plan archival) failed — the state requires manual reconciliation,
   *  not a simple retry. */
  partialFailure: boolean;
}

export interface PipelineOptions {
  projectRoot: string;
  shitennoDir: string;
  taskId: string;
  affectedFiles?: string[];
  /** Skip plan archival (useful for testing) */
  skipArchive?: boolean;
  /** Skip backlog update (useful for testing) */
  skipBacklog?: boolean;
}

// ── Plan Detection ─────────────────────────────────────────────────────────

function isDoneStatus(status: string): boolean {
  return status === "done" || status === "concluído" || status === "concluido" || status === "checked";
}

function listPlanFiles(plansDir: string): string[] {
  try {
    return readdirSync(plansDir).filter((f) => f.endsWith(".md") && !f.startsWith("TEMPLATE"));
  } catch {
    return [];
  }
}

function planIsActive(plansDir: string, file: string, lowerTaskId: string): boolean {
  const id = file.replace(".md", "").toLowerCase();
  if (!matchesTaskId(id, lowerTaskId)) return false;
  const content = readFileSync(join(plansDir, file), "utf-8");
  const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/i);
  if (!statusMatch) return false;
  const status = (statusMatch[1] || "").trim().toLowerCase();
  return !isDoneStatus(status);
}

function findActivePlanForTask(shitennoDir: string, taskId: string): string | null {
  const plansDir = join(shitennoDir, "governance", "plans");
  if (!existsSync(plansDir)) return null;
  const files = listPlanFiles(plansDir);
  const lowerTaskId = taskId.toLowerCase();
  const found = files.find((f) => planIsActive(plansDir, f, lowerTaskId));
  return found ? found.replace(".md", "") : null;
}

// ── Main Pipeline ──────────────────────────────────────────────────────────

/**
 * Run the full task completion pipeline.
 *
 * 1. Validate all 5 completion gates
 * 2. If all pass: publish `task.completed` event
 * 3. Transition backlog item to "concluído"
 * 4. Archive active plan (if found)
 *
 * This function is idempotent — running it multiple times for the same task
 * will not cause errors (backlog transition will fail gracefully if already done).
 */
function validateGates(options: PipelineOptions): { gates: CompletionResult; errors: string[] } {
  const gates = validateCompletionGate({
    projectRoot: options.projectRoot,
    shitennoDir: options.shitennoDir,
    taskId: options.taskId,
    affectedFiles: options.affectedFiles,
  });

  const errors: string[] = [];
  if (!gates.passed) {
    for (const gate of gates.gates.filter((g) => !g.passed)) {
      errors.push(`Gate "${gate.name}" failed: ${gate.message}`);
    }
    logger.warn("task-completion-pipeline", `Completion gates failed for ${options.taskId}: ${errors.join("; ")}`);
  } else {
    logger.info("task-completion-pipeline", `All 5 gates passed for task: ${options.taskId}`);
  }

  return { gates, errors };
}

function publishCompletionEvent(taskId: string, gateCount: number, errors: string[]): boolean {
  try {
    getEventBus().publish("task.completed", {
      taskId, completedAt: new Date().toISOString(), gatesPassed: gateCount,
    });
    logger.info("task-completion-pipeline", `Published task.completed event for: ${taskId}`);
    return true;
  } catch (error) {
    errors.push(`Failed to publish event: ${error instanceof Error ? error.message : String(error)}`);
    logger.warn("task-completion-pipeline", `Event publication failed: ${errors[errors.length - 1]}`);
    return false;
  }
}

function transitionBacklog(shitennoDir: string, taskId: string, skipBacklog: boolean | undefined, errors: string[]): boolean {
  if (skipBacklog) return false;
  try {
    const result = completeTask(shitennoDir, taskId);
    if (result.success) {
      logger.info("task-completion-pipeline", `Backlog updated: ${result.message}`);
      return true;
    }
    errors.push(`Backlog update failed: ${result.message}`);
    logger.warn("task-completion-pipeline", `Backlog update failed: ${result.message}`);
    return false;
  } catch (error) {
    errors.push(`Backlog transition error: ${error instanceof Error ? error.message : String(error)}`);
    logger.warn("task-completion-pipeline", `Backlog transition error: ${errors[errors.length - 1]}`);
    return false;
  }
}

interface ArchiveContext {
  shitennoDir: string;
  taskId: string;
  gates: CompletionResult;
  errors: string[];
}



function archiveActivePlan(
  ctx: ArchiveContext,
  skipArchive: boolean | undefined
): { archived: boolean; planFound: boolean } {
  if (skipArchive) return { archived: false, planFound: false };
  const planId = findActivePlanForTask(ctx.shitennoDir, ctx.taskId);
  if (!planId) {
    logger.info("task-completion-pipeline", `No active plan found for task: ${ctx.taskId}`);
    return { archived: false, planFound: false };
  }

  try {
    const archived = archivePlan(ctx.shitennoDir, planId);
    if (archived) {
      logger.info("task-completion-pipeline", `Plan archived: ${planId}`);
      return { archived: true, planFound: true };
    }
    ctx.errors.push(`Plan archival failed for: ${planId}`);
    return { archived: false, planFound: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.errors.push(`Plan archival failed for ${planId}: ${msg}`);
    logger.warn("task-completion-pipeline", `Plan archival error: ${msg}`);
    return { archived: false, planFound: true };
  }
}

export function runCompletionPipeline(options: PipelineOptions): PipelineResult {
  logger.info("task-completion-pipeline", `Running completion pipeline for task: ${options.taskId}`);

  const { gates, errors } = validateGates(options);

  if (!gates.passed) {
    return {
      success: false, taskId: options.taskId, gates,
      backlogUpdated: false, planArchived: false, eventPublished: false, partialFailure: false, errors,
    };
  }

  const eventPublished = publishCompletionEvent(options.taskId, gates.gates.length, errors);
  const backlogUpdated = transitionBacklog(options.shitennoDir, options.taskId, options.skipBacklog, errors);
  const { archived: planArchived, planFound: planIdWasFound } = archiveActivePlan(
    { shitennoDir: options.shitennoDir, taskId: options.taskId, gates, errors },
    options.skipArchive,
  );
  const partialFailure = backlogUpdated && !planArchived && planIdWasFound;
  const success = errors.length === 0;

  if (partialFailure) {
    try {
      getEventBus().publish("pipeline.partial_failure", {
        taskId: options.taskId, backlogUpdated, planArchived, errors,
      });
    } catch { /* best-effort */ }
  }

  logger.info("task-completion-pipeline", `Pipeline completed for ${options.taskId}: success=${success}, backlog=${backlogUpdated}, plan=${planArchived}, event=${eventPublished}, partialFailure=${partialFailure}`);

  return { success, taskId: options.taskId, gates, backlogUpdated, planArchived, eventPublished, partialFailure, errors };
}

/**
 * Convenience function to run pipeline with automatic task ID detection.
 * Reads the current task from context_buffer.yaml.
 */
export function runCurrentTaskPipeline(
  projectRoot: string,
  shitennoDir: string
): PipelineResult | null {
  const bufferPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");
  if (!existsSync(bufferPath)) {
    logger.warn("task-completion-pipeline", "No context_buffer.yaml found");
    return null;
  }

  try {
    const content = readFileSync(bufferPath, "utf-8");
    const taskIdMatch = content.match(/id:\s*"([^"]+)"/);
    if (!taskIdMatch) {
      logger.warn("task-completion-pipeline", "No task ID found in context_buffer.yaml");
      return null;
    }

    const taskId = taskIdMatch[1]!;
    return runCompletionPipeline({ projectRoot, shitennoDir, taskId });
  } catch (error) {
    logger.warn("task-completion-pipeline", `Failed to read task ID: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
