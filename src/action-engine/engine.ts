/**
 * engine.ts — ActionEngine with idempotency, policy gates, and resource arbitration.
 */

import { randomUUID, createHash } from "node:crypto";
import { getResourceId } from "../decision-core/precedence.js";
import { runPolicyGate } from "../decision-core/invoke.js";
import { claimResource, releaseResource } from "../resource-claims.js";
import type { RuleAction, RuleContext } from "../domain/rules/rule.js";
import { RunScriptExecutor, CreateReminderExecutor } from "../decision-core/executors/index.js";
import type { ActionRequest, ExecutionRecord, ActionFilter, ExecutionRepository, ActionExecutor, ActionStatus } from "./types.js";
import { LogEventExecutor, NotifyExecutor } from "./executors.js";

/**
 * Compute execution hash for idempotency check.
 * SHA-256 of action type + params (sorted keys for consistency).
 */
export function computeExecutionHash(type: string, params: Record<string, unknown>): string {
  const sortedParams: Record<string, unknown> = {};
  for (const key of Object.keys(params).sort()) {
    sortedParams[key] = params[key];
  }
  const payload = JSON.stringify({ type, params: sortedParams });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export class ActionEngine {
  private executors = new Map<string, ActionExecutor>();
  private shitennoDir: string;

  constructor(private repo: ExecutionRepository, shitennoDir?: string) {
    this.shitennoDir = shitennoDir ?? "";
    // Register built-in executors (real implementations from decision-core)
    this.registerExecutor(new LogEventExecutor());
    this.registerExecutor(new NotifyExecutor());
    this.registerExecutor(new CreateReminderExecutor());
    this.registerExecutor(new RunScriptExecutor());
  }

  /** Register an action executor. */
  registerExecutor(executor: ActionExecutor): void {
    this.executors.set(executor.name, executor);
  }

  private findIdempotentMatch(request: ActionRequest, executionHash: string): ExecutionRecord | undefined {
    const existing = this.repo.findByActionId(request.id);
    if (existing && existing.status === "completed") {
      return existing;
    }
    const hashMatch = this.repo.findByHash(executionHash);
    if (hashMatch && hashMatch.status === "completed") {
      return hashMatch;
    }
    return undefined;
  }

  private createFailedRecord(request: ActionRequest, executionHash: string, error: string): ExecutionRecord {
    return {
      executionId: `EXE-${randomUUID().slice(0, 8).toUpperCase()}`,
      request,
      executionHash,
      status: "failed",
      result: "failure",
      error,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      duration: 0,
    };
  }

  private evaluatePolicyGate(request: ActionRequest, executionHash: string): ExecutionRecord | undefined {
    if (!this.shitennoDir) return undefined;
    const action: RuleAction = { type: request.type as RuleAction["type"], params: request.params as RuleAction["params"] };
    const context: RuleContext = {
      trigger: "manual",
      eventData: {},
      projectRoot: "",
      shitennoDir: this.shitennoDir,
      timestamp: new Date().toISOString(),
    };
    const policyBlock = runPolicyGate(action, context);
    if (policyBlock) {
      const record = this.createFailedRecord(request, executionHash, policyBlock.message);
      this.repo.save(record);
      return record;
    }
    return undefined;
  }

  private async runWithResources(executor: ActionExecutor, request: ActionRequest, record: ExecutionRecord): Promise<void> {
    const resourceId = getResourceId(request.type as RuleAction["type"], request.params);
    const claimType: "plan" | "task" | undefined = resourceId?.startsWith("plan:")
      ? "plan"
      : resourceId?.startsWith("task:")
      ? "task"
      : undefined;
    const claimSessionId = resourceId && claimType ? claimResource(resourceId, claimType) : undefined;

    try {
      const startTime = Date.now();
      const output = await executor.execute(request.params, {
        projectRoot: "",
        shitennoDir: this.shitennoDir,
      });
      const duration = Date.now() - startTime;

      record.status = "completed";
      record.result = "success";
      record.output = output;
      record.completedAt = new Date().toISOString();
      record.duration = duration;
    } catch (error) {
      record.status = "failed";
      record.result = "failure";
      record.error = error instanceof Error ? error.message : String(error);
      record.completedAt = new Date().toISOString();
      record.duration = Date.now() - new Date(record.startedAt).getTime();
    } finally {
      if (resourceId && claimSessionId) {
        releaseResource(resourceId, claimSessionId);
      }
    }
  }

  /** Execute an action with idempotency guarantees. */
  async execute(request: ActionRequest): Promise<ExecutionRecord> {
    const executionHash = computeExecutionHash(request.type, request.params);

    const idempotentMatch = this.findIdempotentMatch(request, executionHash);
    if (idempotentMatch) return idempotentMatch;

    const policyBlock = this.evaluatePolicyGate(request, executionHash);
    if (policyBlock) return policyBlock;

    const executor = this.executors.get(request.type);
    if (!executor) {
      const record = this.createFailedRecord(request, executionHash, `No executor registered for type: ${request.type}`);
      this.repo.save(record);
      return record;
    }

    const record: ExecutionRecord = {
      executionId: `EXE-${randomUUID().slice(0, 8).toUpperCase()}`,
      request,
      executionHash,
      status: "running",
      startedAt: new Date().toISOString(),
    };
    this.repo.save(record);

    await this.runWithResources(executor, request, record);

    this.repo.save(record);
    return record;
  }

  /** Rollback a completed action. */
  async rollback(executionId: string): Promise<ExecutionRecord | undefined> {
    const record = this.repo.findById(executionId);
    if (!record) return undefined;
    if (record.status !== "completed") return undefined;

    const executor = this.executors.get(record.request.type);
    if (!executor || !executor.rollback) {
      record.status = "failed";
      record.error = "No rollback executor available";
      this.repo.save(record);
      return record;
    }

    try {
      await executor.rollback(record.request.params, record.output ?? {});
      record.status = "rolled_back";
      record.result = "rolled_back";
      record.rollback = {
        rollbackId: `RBK-${randomUUID().slice(0, 8).toUpperCase()}`,
        status: "completed",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      record.rollback = {
        rollbackId: `RBK-${randomUUID().slice(0, 8).toUpperCase()}`,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }

    this.repo.save(record);
    return record;
  }

  /** Get an execution record by ID. */
  get(executionId: string): ExecutionRecord | undefined {
    return this.repo.findById(executionId);
  }

  /** Get execution by action ID (idempotency lookup). */
  getByActionId(actionId: string): ExecutionRecord | undefined {
    return this.repo.findByActionId(actionId);
  }

  /** List executions. */
  list(filter?: ActionFilter): ExecutionRecord[] {
    return this.repo.findAll(filter);
  }

  /** Count executions. */
  count(filter?: ActionFilter): number {
    return this.repo.count(filter);
  }

  /** Get execution statistics. */
  stats(): {
    total: number;
    byStatus: Record<ActionStatus, number>;
    avgDuration: number;
    successRate: number;
  } {
    const all = this.repo.findAll();
    const byStatus: Record<ActionStatus, number> = {
      pending: 0, running: 0, completed: 0, failed: 0, rolled_back: 0,
    };
    let totalDuration = 0;
    let successCount = 0;

    for (const r of all) {
      byStatus[r.status]++;
      if (r.duration) totalDuration += r.duration;
      if (r.result === "success") successCount++;
    }

    return {
      total: all.length,
      byStatus,
      avgDuration: all.length > 0 ? Math.round(totalDuration / all.length) : 0,
      successRate: all.length > 0 ? Math.round((successCount / all.length) * 100) : 100,
    };
  }
}
