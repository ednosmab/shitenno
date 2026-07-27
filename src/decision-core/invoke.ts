/**
 * Decision Core — Invoke (Unified Action Dispatcher)
 *
 * The single entry point for ALL action execution.
 * Replaces direct calls to rule-engine/actions.ts, autofix-engine.ts,
 * and action-engine.ts executors.
 *
 * Gate order (ADR-008 + ADR-009):
 *   1. Policy gate — veto before anything (ADR-009)
 *   2. Precedence gate — tier-based in autonomous mode (ADR-008)
 *   3. Execution + audit trail
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ActionType, RuleAction, RuleContext } from "../domain/rules/rule.js";
import { PolicyEngine, FilePolicyRepository } from "../rule-engine/index.js";
import { computeExecutionHash, type ExecutionRecord } from "../action-engine.js";
import { checkPolicyGate } from "./policy-gate.js";
import { checkPrecedence, getResourceId, type InvokeMode } from "./precedence.js";
import { claimResource, releaseResource } from "../resource-claims.js";
import type { ActionExecutor } from "./executors/types.js";
import {
  RunScriptExecutor,
  RunLocalScriptExecutor,
  RunShugoCommandExecutor,
  CreateReminderExecutor,
  ApplyAutofixExecutor,
  GenericRuleActionExecutor,
} from "./executors/index.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface InvokeActionParams {
  action: RuleAction;
  context: RuleContext;
  mode: InvokeMode;
  ruleAutonomousFlag?: boolean;
  sessionId?: string;
  resourceClaimed?: (id: string) => boolean;
  /** Optional repository for idempotency checks. When provided, invokeAction
   *  will check for existing completed executions before running. */
  executionRepo?: {
    findByHash(hash: string): ExecutionRecord | undefined;
    findByActionId(actionId: string): ExecutionRecord | undefined;
  };
  /** Optional external executor. When provided, bypasses the built-in registry.
   *  Used by ActionEngine to delegate execution while keeping its own executors. */
  externalExecutor?: ActionExecutor;
}

export interface InvokeResult {
  success: boolean;
  blocked?: boolean;
  deferred?: boolean;
  message: string;
  executionId?: string;
  /** Output data from the executor (when execution succeeds). */
  output?: Record<string, unknown>;
}

// ── Executor Registry ──────────────────────────────────────────────────────

const EXECUTORS: Record<string, ActionExecutor> = {
  run_script: new RunScriptExecutor(),
  run_local_script: new RunLocalScriptExecutor(),
  run_shugo_command: new RunShugoCommandExecutor(),
  create_reminder: new CreateReminderExecutor(),
  apply_autofix: new ApplyAutofixExecutor(),
};

/** Actions that have dedicated executors above. */
const DEDICATED_EXECUTOR_TYPES = new Set(Object.keys(EXECUTORS));

function getExecutor(actionType: ActionType): ActionExecutor {
  if (DEDICATED_EXECUTOR_TYPES.has(actionType)) {
    return EXECUTORS[actionType]!;
  }
  return new GenericRuleActionExecutor(actionType);
}

// ── Policy Engine Singleton ────────────────────────────────────────────────

let cachedPolicyEngine: PolicyEngine | undefined;

function getPolicyEngine(shitennoDir: string): PolicyEngine {
  if (!cachedPolicyEngine) {
    cachedPolicyEngine = new PolicyEngine(new FilePolicyRepository(shitennoDir));
  }
  return cachedPolicyEngine;
}

// ── Execution Log ──────────────────────────────────────────────────────────

const EXEC_LOG_PATH = "governance/executions";

function getExecLogDir(shitennoDir: string): string {
  const dir = join(shitennoDir, EXEC_LOG_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ── Gate Helpers ─────────────────────────────────────────────────────────────

export function runPolicyGate(
  action: RuleAction,
  context: RuleContext,
): InvokeResult | null {
  const policyEngine = getPolicyEngine(context.shitennoDir);
  const policyResult = checkPolicyGate(action, context, policyEngine);
  if (!policyResult.allowed) {
    return {
      success: false,
      blocked: true,
      message: `Blocked by policy: ${policyResult.reason}`,
    };
  }
  return null;
}

function runPrecedenceGate(params: InvokeActionParams): InvokeResult | null {
  const { action, mode } = params;
  const precedence = checkPrecedence(action.type, mode, {
    ruleAutonomousFlag: params.ruleAutonomousFlag,
    resourceClaimed: params.resourceClaimed ?? params.context.isResourceClaimed,
    params: action.params as Record<string, unknown>,
  });
  if (!precedence.allowed) {
    return {
      success: false,
      deferred: true,
      message: precedence.reason ?? "Deferred by precedence rules",
    };
  }
  return null;
}

function buildSuccessResult(actionType: ActionType, output: Record<string, unknown>, executionId: string): InvokeResult {
  const actionSuccess = output.success === true;
  return {
    success: actionSuccess,
    message: actionSuccess ? `Executed ${actionType}` : (output.message as string ?? `Failed: ${actionType}`),
    executionId,
    output,
  };
}

function buildFailureResult(error: unknown, executionId: string): InvokeResult {
  return {
    success: false,
    message: `Failed: ${error instanceof Error ? error.message : String(error)}`,
    executionId,
  };
}

function writeExecRecord(execPath: string, record: ExecutionRecord): void {
  writeFileSync(execPath, JSON.stringify(record, null, 2), "utf-8");
}

function resourceIdToClaimType(resourceId: string): "plan" | "task" {
  return resourceId.startsWith("plan:") ? "plan" : "task";
}

async function executeWithAudit(
  params: InvokeActionParams,
  executor: ActionExecutor,
): Promise<InvokeResult> {
  const { action, context } = params;
  const executionId = `EXE-${randomUUID().slice(0, 8).toUpperCase()}`;
  const executionHash = computeExecutionHash(action.type, action.params as Record<string, unknown>);

  const resourceId = getResourceId(action.type, action.params as Record<string, unknown>);
  const claimSessionId = resourceId ? claimResource(resourceId, resourceIdToClaimType(resourceId)) : undefined;

  const record: ExecutionRecord = {
    executionId,
    request: {
      id: params.sessionId ?? `invoke-${Date.now().toString(36)}`,
      type: action.type,
      params: action.params as Record<string, unknown>,
    },
    executionHash,
    status: "running",
    startedAt: new Date().toISOString(),
  };

  const execPath = join(getExecLogDir(context.shitennoDir), `${executionId}.json`);
  writeExecRecord(execPath, record);

  try {
    const startTime = Date.now();
    const output = await executor.execute(
      action.params as Record<string, unknown>,
      { projectRoot: context.projectRoot, shitennoDir: context.shitennoDir }
    );

    record.status = "completed";
    record.result = "success";
    record.output = output;
    record.completedAt = new Date().toISOString();
    record.duration = Date.now() - startTime;
    writeExecRecord(execPath, record);

    return buildSuccessResult(action.type, output, executionId);
  } catch (error) {
    record.status = "failed";
    record.result = "failure";
    record.error = error instanceof Error ? error.message : String(error);
    record.completedAt = new Date().toISOString();
    record.duration = Date.now() - new Date(record.startedAt).getTime();
    writeExecRecord(execPath, record);

    return buildFailureResult(error, executionId);
  } finally {
    if (resourceId && claimSessionId) {
      releaseResource(resourceId, claimSessionId);
    }
  }
}

// ── Core Invoke Function ───────────────────────────────────────────────────

/**
 * Unified action dispatcher — the single entry point for all action execution.
 *
 * Gate order:
 *   1. Policy gate (ADR-009) — enforce violations veto the action
 *   2. Precedence gate (ADR-008) — tier-based in autonomous mode
 *   3. Execution + audit trail
 */
export async function invokeAction(params: InvokeActionParams): Promise<InvokeResult> {
  const { action, context } = params;

  // Idempotency check — skip if same action already completed
  if (params.executionRepo) {
    const executionHash = computeExecutionHash(action.type, action.params as Record<string, unknown>);
    const existing = params.executionRepo.findByHash(executionHash);
    if (existing?.status === "completed") {
      return { success: true, message: `Already executed (idempotent): ${action.type}`, executionId: existing.executionId };
    }
    const actionMatch = params.executionRepo.findByActionId(params.sessionId ?? "");
    if (actionMatch?.status === "completed") {
      return { success: true, message: `Already executed (idempotent): ${action.type}`, executionId: actionMatch.executionId };
    }
  }

  const policyBlock = runPolicyGate(action, context);
  if (policyBlock) return policyBlock;

  const precedenceBlock = runPrecedenceGate(params);
  if (precedenceBlock) return precedenceBlock;

  const executor = params.externalExecutor ?? getExecutor(action.type);
  return executeWithAudit(params, executor);
}
