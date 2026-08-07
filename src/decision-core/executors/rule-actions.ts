/**
 * Decision Core — Rule Actions Executor
 *
 * The nine rule-engine action types (update_context_buffer, update_quick_board,
 * log_event, trigger_assessment, trigger_health_check, update_backlog,
 * update_backlog_status, archive_plan, auto_populate_next_p0) migrated from
 * rule-engine/actions.ts into the unified execution core (ADR-009).
 *
 * Exposes both the ActionExecutor interface (used by invoke.ts) and the
 * standalone executeAction() function (re-exported by rule-engine/actions.ts
 * for backward compatibility).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { SHITENNO_DIR_NAME } from "../../domain/types/constants.js";
import { escapeRegex } from "../../shared/validation-utils.js";
import { transitionTask, type BacklogState } from "../../application/backlog-state-machine.js";
import { resolveBacklogPaths, parseBacklogItems, findItem } from "../../application/backlog-core.js";
import { replaceSectionField, updateNextP0 } from "../../application/context-buffer-writer.js";
import { getEventBus } from "../../infrastructure/event-bus.js";
import type { RuleAction, RuleContext } from "../../domain/rules/rule.js";
import { resolveField } from "../../shared/conditions.js";
import type { ActionExecutor, ExecutorContext } from "./types.js";

/** Resolve template variables in action params (e.g., "${eventData.planId}" → actual value). */
function resolveParam(value: unknown, context: RuleContext): string {
  if (typeof value !== "string") return String(value ?? "");
  const templateMatch = value.match(/^\$\{(.+)\}$/);
  if (templateMatch && templateMatch[1]) {
    const resolved = resolveField(templateMatch[1], context);
    return String(resolved ?? "");
  }
  return value;
}

/** Ensures governance/context/context_buffer.yaml exists, creating it if needed. */
function ensureContextBuffer(shitennoDir: string): string {
  const bufferPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");
  if (!existsSync(bufferPath)) {
    const contextDir = join(shitennoDir, "governance", "context");
    if (!existsSync(contextDir)) {
      mkdirSync(contextDir, { recursive: true });
    }
    writeFileSync(bufferPath, "reminders:\n\nproximo:\n\nsession:\n  id: \"auto-created\"\n  status: \"in_progress\"\n", "utf-8");
  }
  return bufferPath;
}

function executeUpdateContextBuffer(action: RuleAction, context: RuleContext): { success: boolean; message: string } {
  const field = String(action.params.field || "");
  const value = String(action.params.value || "");
  if (!field || !value) return { success: false, message: "No field or value specified" };
  const bufferFile = join(context.shitennoDir, "governance", "context", "context_buffer.yaml");
  const result = replaceSectionField(readFileSync(bufferFile, "utf-8"), field, value);
  if (result.updated) {
    writeFileSync(bufferFile, result.content, "utf-8");
    return { success: true, message: `Updated ${field} = ${value}` };
  }
  return { success: false, message: `Field "${field}" not found in buffer` };
}

function executeUpdateQuickBoard(action: RuleAction, context: RuleContext): { success: boolean; message: string } {
  const bufferPath = ensureContextBuffer(context.shitennoDir);
  try {
    let content = readFileSync(bufferPath, "utf-8");
    const item = String(action.params.item || "");
    const section = String(action.params.section || "proximo");
    if (item) {
      content = content.replace(new RegExp(`(${escapeRegex(section)}:\\s*\\n)`), `$1    - "${item}"\n`);
      writeFileSync(bufferPath, content, "utf-8");
      return { success: true, message: `Updated quick board: ${section}` };
    }
    return { success: false, message: "No item specified" };
  } catch {
    return { success: false, message: "Failed to update quick board" };
  }
}

function executeLogEvent(action: RuleAction, context: RuleContext): { success: boolean; message: string } {
  const historyDir = join(context.shitennoDir, "docs", "history");
  if (!existsSync(historyDir)) mkdirSync(historyDir, { recursive: true });
  try {
    const date = new Date().toISOString().slice(0, 10);
    const event = String(action.params.event || "rule_engine_event").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
    const message = String(action.params.message || "");
    const filename = `${date}-rule-${event}.md`;
    const filepath = join(historyDir, filename);
    const content = `# ${event}\n\nDate: ${context.timestamp}\nRule: ${context.eventData.ruleId || "unknown"}\n\n${message}\n`;
    writeFileSync(filepath, content, "utf-8");
    return { success: true, message: `Logged event: ${event}` };
  } catch {
    return { success: false, message: "Failed to log event" };
  }
}

function executeTriggerAssessment(_action: RuleAction, context: RuleContext): { success: boolean; message: string } {
  const assessBin = join(context.projectRoot, "dist", "shugo.js");
  if (!existsSync(assessBin)) return { success: true, message: "Assessment skipped: shugo binary not found (dev environment)" };
  try {
    execSync("SHITENNO_CHILD=1 node dist/shugo.js assess", { cwd: context.projectRoot, timeout: 60000, encoding: "utf-8", stdio: "pipe" });
    return { success: true, message: "Assessment triggered successfully" };
  } catch (error) {
    return { success: false, message: `Assessment failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function executeTriggerHealthCheck(_action: RuleAction, context: RuleContext): { success: boolean; message: string } {
  const doctorBin = join(context.projectRoot, "dist", "shugo.js");
  if (!existsSync(doctorBin)) return { success: true, message: "Health check skipped: shugo binary not found (dev environment)" };
  try {
    execSync("SHITENNO_CHILD=1 node dist/shugo.js doctor", { cwd: context.projectRoot, timeout: 60000, encoding: "utf-8", stdio: "pipe" });
    return { success: true, message: "Health check triggered successfully" };
  } catch (error) {
    return { success: false, message: `Health check failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function executeUpdateBacklog(action: RuleAction, context: RuleContext): { success: boolean; message: string } {
  const backlogPath = join(context.shitennoDir, "docs", "backlog", "ACTIVE.md");
  if (!existsSync(backlogPath)) return { success: false, message: "BACKLOG.md not found" };
  try {
    let content = readFileSync(backlogPath, "utf-8");
    const item = String(action.params.item || "");
    if (item) {
      content += `\n| ${item} | 🟡 Médio | Backlog | ${new Date().toISOString().slice(0, 10)} | unassigned |`;
      writeFileSync(backlogPath, content, "utf-8");
      return { success: true, message: `Updated backlog: ${item}` };
    }
    return { success: false, message: "No item specified" };
  } catch {
    return { success: false, message: "Failed to update backlog" };
  }
}

const TERMINAL_STATES: Set<string> = new Set(["concluído", "encerrado"]);

/** Resolve the backlog item title for a task ID, falling back to the ID. */
function resolveTaskTitle(shitennoDir: string, taskId: string): string {
  const { active: backlogPath } = resolveBacklogPaths(shitennoDir);
  const item = findItem(parseBacklogItems(backlogPath), taskId);
  return item?.title || taskId;
}

function executeUpdateBacklogStatus(action: RuleAction, context: RuleContext): { success: boolean; message: string } {
  const taskId = String(action.params.taskId || "");
  const fromState = String(action.params.fromState || "");
  const toState = String(action.params.toState || "");
  if (!taskId || !fromState || !toState) return { success: false, message: "Missing required params: taskId, fromState, toState" };
  try {
    const result = transitionTask(context.shitennoDir, taskId, fromState as BacklogState, toState as BacklogState);
    if (result.success && TERMINAL_STATES.has(toState)) {
      getEventBus().publish("task.completed", {
        taskId,
        itemName: resolveTaskTitle(context.shitennoDir, taskId),
        fromState,
        toState,
        timestamp: new Date().toISOString(),
      });
    }
    return { success: result.success, message: result.message };
  } catch (error) {
    return { success: false, message: `Failed to transition backlog: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function executeArchivePlan(action: RuleAction, context: RuleContext): Promise<{ success: boolean; message: string }> {
  const planId = resolveParam(action.params.planId, context);
  if (!planId) return { success: false, message: "No plan ID specified" };
  try {
    const { execFileSync } = await import("node:child_process");
    execFileSync("node", ["dist/shugo.js", "plan", "md", "done", planId], {
      cwd: context.projectRoot, timeout: 30000, encoding: "utf-8", stdio: "pipe",
      env: { ...process.env, SHITENNO_CHILD: "1" },
    });
    return { success: true, message: `Plan archived: ${planId}` };
  } catch (error) {
    return { success: false, message: `Failed to archive plan: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function executeAutoPopulateNextP0(_action: RuleAction, context: RuleContext): { success: boolean; message: string } {
  try {
    const shitennoDir = join(context.projectRoot, SHITENNO_DIR_NAME);
    const backlogPath = join(shitennoDir, "docs", "backlog", "ACTIVE.md");
    if (!existsSync(backlogPath)) return { success: false, message: "BACKLOG.md not found" };
    const backlogContent = readFileSync(backlogPath, "utf-8");
    const p0Match = backlogContent.match(/^- \[ \] \((P0|high)\)\s+(.+)/m);
    if (!p0Match) return { success: true, message: "No P0 items in backlog to populate" };
    const taskDesc = p0Match[2]!.trim();
    const result = updateNextP0(shitennoDir, taskDesc);
    return { success: result.success, message: result.message };
  } catch (error) {
    return { success: false, message: `auto_populate_next_p0 failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** Executes a rule action. */
export async function executeAction(
  action: RuleAction,
  context: RuleContext
): Promise<{ success: boolean; message: string }> {
  switch (action.type) {
    case "update_context_buffer":
      return executeUpdateContextBuffer(action, context);
    case "update_quick_board":
      return executeUpdateQuickBoard(action, context);
    case "log_event":
      return executeLogEvent(action, context);
    case "trigger_assessment":
      return executeTriggerAssessment(action, context);
    case "trigger_health_check":
      return executeTriggerHealthCheck(action, context);
    case "update_backlog":
      return executeUpdateBacklog(action, context);
    case "update_backlog_status":
      return executeUpdateBacklogStatus(action, context);
    case "archive_plan":
      return executeArchivePlan(action, context);
    case "auto_populate_next_p0":
      return executeAutoPopulateNextP0(action, context);
    default:
      return { success: false, message: `Unknown action type: ${action.type}` };
  }
}

/** Bridges a rule action type into the ActionExecutor interface. */
export class RuleActionsExecutor implements ActionExecutor {
  name: string;

  constructor(actionType: string) {
    this.name = actionType;
  }

  async execute(params: Record<string, unknown>, context: ExecutorContext): Promise<Record<string, unknown>> {
    const action: RuleAction = {
      type: this.name as RuleAction["type"],
      params: params as RuleAction["params"],
    };

    const ruleContext: RuleContext = {
      trigger: "manual",
      eventData: {},
      projectRoot: context.projectRoot,
      shitennoDir: context.shitennoDir,
      timestamp: new Date().toISOString(),
    };

    const result = await executeAction(action, ruleContext);
    return { success: result.success, message: result.message };
  }
}
