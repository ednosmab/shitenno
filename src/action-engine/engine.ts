/**
 * engine.ts — ActionEngine with unified orchestration.
 *
 * Uses runPolicyGate from decision-core (shared policy logic) and
 * claimResource/releaseResource for resource arbitration (previously
 * duplicated only in ActionEngine, now unified with invokeAction path).
 */

import { randomUUID, createHash } from "node:crypto";
import { runPolicyGate } from "../decision-core/invoke.js";
import { getResourceId } from "../decision-core/precedence.js";
import { claimResource, releaseResource } from "../application/resource-claims.js";
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

function resourceIdToClaimType(resourceId: string): "plan" | "task" {
  return resourceId.startsWith("plan:") ? "plan" : "task";
}

export class ActionEngine {
  private executors = new Map<string, ActionExecutor>();

  constructor(private repo: ExecutionRepository, private shitennoDir: string) {
    this.registerExecutor(new LogEventExecutor());
    this.registerExecutor(new NotifyExecutor());
    this.registerExecutor(new CreateReminderExecutor());
    this.registerExecutor(new RunScriptExecutor());
  }

  registerExecutor(executor: ActionExecutor): void {
    this.executors.set(executor.name, executor);
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

  private checkIdempotency(request: ActionRequest, executionHash: string): ExecutionRecord | undefined {
    const existingByAction = this.repo.findByActionId(request.id);
    if (existingByAction?.status === "completed") return existingByAction;
    const existingByHash = this.repo.findByHash(executionHash);
    if (existingByHash?.status === "completed") return existingByHash;
    return undefined;
  }

  private checkPolicy(request: ActionRequest, executionHash: string): ExecutionRecord | undefined {
    if (!this.shitennoDir) return undefined;
    const action: RuleAction = { type: request.type as RuleAction["type"], params: request.params as RuleAction["params"] };
    const context: RuleContext = {
      trigger: "manual", eventData: {}, projectRoot: "",
      shitennoDir: this.shitennoDir, timestamp: new Date().toISOString(),
    };
    const policyBlock = runPolicyGate(action, context);
    if (policyBlock) {
      const record = this.createFailedRecord(request, executionHash, policyBlock.message);
      this.repo.save(record);
      return record;
    }
    return undefined;
  }

  private async runExecutor(request: ActionRequest, executor: ActionExecutor, executionHash: string): Promise<ExecutionRecord> {
    const resourceId = getResourceId(request.type as RuleAction["type"], request.params);
    const claimSessionId = resourceId ? claimResource(resourceId, resourceIdToClaimType(resourceId)) : undefined;
    const record: ExecutionRecord = {
      executionId: `EXE-${randomUUID().slice(0, 8).toUpperCase()}`,
      request, executionHash, status: "running", startedAt: new Date().toISOString(),
    };
    this.repo.save(record);
    try {
      const startTime = Date.now();
      const output = await executor.execute(request.params, { projectRoot: "", shitennoDir: this.shitennoDir });
      record.status = "completed"; record.result = "success"; record.output = output;
      record.completedAt = new Date().toISOString(); record.duration = Date.now() - startTime;
    } catch (error) {
      record.status = "failed"; record.result = "failure";
      record.error = error instanceof Error ? error.message : String(error);
      record.completedAt = new Date().toISOString();
      record.duration = Date.now() - new Date(record.startedAt).getTime();
    } finally {
      if (resourceId && claimSessionId) releaseResource(resourceId, claimSessionId);
    }
    this.repo.save(record);
    return record;
  }

  async execute(request: ActionRequest): Promise<ExecutionRecord> {
    const executionHash = computeExecutionHash(request.type, request.params);
    const idempotent = this.checkIdempotency(request, executionHash);
    if (idempotent) return idempotent;
    const policyBlocked = this.checkPolicy(request, executionHash);
    if (policyBlocked) return policyBlocked;
    const executor = this.executors.get(request.type);
    if (!executor) {
      const record = this.createFailedRecord(request, executionHash, `No executor registered for type: ${request.type}`);
      this.repo.save(record);
      return record;
    }
    return this.runExecutor(request, executor, executionHash);
  }

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

  get(executionId: string): ExecutionRecord | undefined {
    return this.repo.findById(executionId);
  }

  getByActionId(actionId: string): ExecutionRecord | undefined {
    return this.repo.findByActionId(actionId);
  }

  list(filter?: ActionFilter): ExecutionRecord[] {
    return this.repo.findAll(filter);
  }

  count(filter?: ActionFilter): number {
    return this.repo.count(filter);
  }

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
