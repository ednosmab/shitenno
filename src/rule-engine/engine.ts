/**
 * Rule engine orchestrator.
 *
 * Loads rules from disk, evaluates conditions, executes actions,
 * and integrates with the event bus for automatic trigger mapping.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { InvalidRuleError } from "../domain/types/errors.js";
import { logger } from "../shared/logger.js";
import { loadMaturityProfile } from "../application/maturity-profile.js";
import type { Rule, RuleContext, RuleResult, EngineResult, TriggerType } from "../domain/rules/rule.js";
import { validateRule } from "./validation.js";
import { isValidRuleId } from "../shared/security.js";
import { evaluateCondition } from "../shared/conditions.js";
import { getDefaultRules } from "./defaults.js";
import { invokeAction } from "../decision-core/invoke.js";

// ── Rule Storage ─────────────────────────────────────────────────────────────

const RULES_DIR = "governance/rules";

/** Lê todas as regras de um directório. */
export function loadRules(shitennoDir: string): Rule[] {
  const rulesPath = join(shitennoDir, RULES_DIR);
  if (!existsSync(rulesPath)) return [];

  const files = readdirSync(rulesPath).filter(
    (f) => f.endsWith(".json") && !f.startsWith("_")
  );

  const rules: Rule[] = [];
  for (const file of files) {
    try {
      const content = readFileSync(join(rulesPath, file), "utf-8");
      const parsed = JSON.parse(content);
      const validation = validateRule(parsed);

      if (!validation.valid) {
        logger.warn("RuleEngine", `Invalid rule in ${file}: ${validation.errors.join(", ")}`);
        continue;
      }

      rules.push(parsed as Rule);
    } catch {
      logger.warn("RuleEngine", `Failed to parse ${file}`);
    }
  }

  return rules;
}

/** Grava uma regra no directório. */
export function saveRule(shitennoDir: string, rule: Rule): void {
  if (!isValidRuleId(rule.id)) {
    throw new InvalidRuleError(`Rule ID: "${rule.id}". Only alphanumeric, hyphens and underscores allowed.`);
  }

  const rulesPath = join(shitennoDir, RULES_DIR);
  if (!existsSync(rulesPath)) {
    mkdirSync(rulesPath, { recursive: true });
  }

  const filepath = join(rulesPath, `${rule.id}.json`);
  writeFileSync(filepath, JSON.stringify(rule, null, 2), "utf-8");
}

// ── Engine ───────────────────────────────────────────────────────────────────

function filterApplicableRules(rules: Rule[], context: RuleContext): Rule[] {
  return rules
    .filter((r) => {
      if (!r.enabled) return false;
      if (r.trigger !== context.trigger) return false;
      if (r.requiredCapability && context.installedCapabilities) {
        if (!context.installedCapabilities.includes(r.requiredCapability)) {
          logger.debug("rule-engine", `Skipping ${r.id}: requires capability "${r.requiredCapability}" (not installed)`);
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => a.priority - b.priority);
}

async function processRule(
  rule: Rule,
  context: RuleContext,
  results: RuleResult[],
  startTime: number
): Promise<{ executed: boolean }> {
  if (rule.dependencies.length > 0) {
    const depsMet = rule.dependencies.every((depId) =>
      results.some((r) => r.ruleId === depId && r.success)
    );
    if (!depsMet) {
      results.push({
        ruleId: rule.id, success: false, message: "Dependencies not met",
        actionsExecuted: 0, duration: Date.now() - startTime,
      });
      return { executed: false };
    }
  }

  const conditionsMet = rule.conditions.every((cond) => evaluateCondition(cond, context));
  if (!conditionsMet) {
    results.push({
      ruleId: rule.id, success: false, message: "Conditions not met",
      actionsExecuted: 0, duration: Date.now() - startTime,
    });
    return { executed: false };
  }

  let actionsExecuted = 0;
  let allSuccess = true;
  for (const action of rule.actions) {
    const invokeResult = await invokeAction({
      action, context, mode: "autonomous",
      ruleAutonomousFlag: rule.autonomous ?? false,
      resourceClaimed: context.isResourceClaimed,
    });
    if (invokeResult.success) actionsExecuted++;
    else allSuccess = false;
  }

  results.push({
    ruleId: rule.id, success: allSuccess,
    message: allSuccess ? `${actionsExecuted} action(s) executed` : "Some actions failed",
    actionsExecuted, duration: Date.now() - startTime,
  });
  return { executed: true };
}

function writeTelemetry(ctx: { context: RuleContext; total: number; executed: number; skipped: number; failed: number; results: RuleResult[] }): void {
  try {
    const telemetryDir = join(ctx.context.shitennoDir, "telemetry");
    if (!existsSync(telemetryDir)) mkdirSync(telemetryDir, { recursive: true });
    const traceEntry = {
      timestamp: ctx.context.timestamp, trigger: ctx.context.trigger,
      eventType: ctx.context.eventData?.type || "unknown",
      rulesEvaluated: ctx.total, rulesExecuted: ctx.executed, rulesSkipped: ctx.skipped, rulesFailed: ctx.failed,
      results: ctx.results.map((r) => ({ ruleId: r.ruleId, success: r.success, actionsExecuted: r.actionsExecuted, duration: r.duration })),
    };
    appendFileSync(join(telemetryDir, "rule-trace.jsonl"), JSON.stringify(traceEntry) + "\n", "utf-8");
  } catch {
    logger.debug("rule-engine", "Failed to write audit trail — best-effort");
  }
}

/**
 * Executa o engine de regras para um determinado trigger.
 */
export async function executeRules(
  rules: Rule[],
  context: RuleContext
): Promise<EngineResult> {
  const results: RuleResult[] = [];
  let executed = 0;
  let skipped = 0;
  let failed = 0;

  const applicableRules = filterApplicableRules(rules, context);

  for (const rule of applicableRules) {
    const startTime = Date.now();
    const result = await processRule(rule, context, results, startTime);
    if (!result.executed) skipped++;
    else {
      const lastResult = results[results.length - 1];
      if (lastResult?.success) executed++;
      else failed++;
    }
  }

  const total = rules.filter((r) => r.enabled && r.trigger === context.trigger).length;
  writeTelemetry({ context, total, executed, skipped, failed, results });

  return {
    rulesEvaluated: total, rulesExecuted: executed, rulesSkipped: skipped, rulesFailed: failed,
    results,
    summary: `${executed}/${total} rules executed, ${skipped} skipped, ${failed} failed`,
  };
}

// ── Engine Initialization ────────────────────────────────────────────────────

/** Inicializa o directório de regras com regras padrão se vazio. */
export function initializeRules(shitennoDir: string): void {
  const rulesPath = join(shitennoDir, RULES_DIR);
  if (!existsSync(rulesPath)) {
    mkdirSync(rulesPath, { recursive: true });
  }

  const existingRules = loadRules(shitennoDir);
  if (existingRules.length > 0) return;

  const defaultRules = getDefaultRules();
  for (const rule of defaultRules) {
    saveRule(shitennoDir, rule);
  }
}

// ── Event Bus Integration ───────────────────────────────────────────────────

import { getEventBus, type ShitennoEventType } from "../infrastructure/event-bus.js";

/** Map event bus events to rule engine triggers. */
const EVENT_TO_TRIGGER: Partial<Record<ShitennoEventType, TriggerType>> = {
  "session.start": "session_start",
  "session.end": "session_end",
  "analysis.complete": "file_change",
  "score.calculated": "file_change",
  "pattern.detected": "pattern_detected",
  "health.checked": "health_check",
  "debt.detected": "knowledge_debt_detected",
  "capability.installed": "capability_install",
  "capability.unlocked": "capability_install",
  "maturity.changed": "maturity_change",
  "rule.triggered": "manual",
  "evolution.recommended": "file_change",
  "adr.created": "adr_created",
  "skill.created": "skill_created",
  "asset.created": "file_change",
  "asset.updated": "file_change",
  "asset.archived": "file_change",
  "validation.completed": "validation_pass",
  "task.completed": "task_completed",
  "pipeline.complete": "pipeline_complete",
  "lifecycle.state_changed": "file_change",
  "plan.archived": "plan_archived",
  "plan.created": "plan_created",
  "plan.file_changed": "plan_file_changed",
  "plan.status_changed": "plan_status_changed",
  "knowledge.analyzed": "file_change",
  "knowledge_debt.detected": "knowledge_debt_detected",
  "engineering_state.updated": "file_change",
  "engineering_state.consolidated": "file_change",
  "recommendation.accepted": "file_change",
  "recommendation.rejected": "file_change",
  "governance.policy_applied": "file_change",
  "entropy.calculated": "file_change",
  "command.completed": "command_completed",
  "doc.lifecycle.audited": "file_change",
  "system.updated": "file_change",
  "challenge.generated": "file_change",
  "docs.sync.triggered": "file_change",
  "state.mutated": "file_change",
};

/** Subscribe to event bus events and execute matching rules. */
export function initializeRuleEngine(
  projectRoot: string,
  shitennoDir: string,
  resourceClaimChecker?: (resourceId: string) => boolean
): void {
  const bus = getEventBus();

  for (const [eventType, trigger] of Object.entries(EVENT_TO_TRIGGER)) {
    bus.subscribe(eventType as ShitennoEventType, async (payload: unknown) => {
      const rules = loadRules(shitennoDir);
      if (rules.length === 0) {
        logger.debug(
          "rule-engine",
          `No rules loaded for event "${eventType}" — seed rules via governance/rules/ or see docs/adr/`
        );
        return;
      }

      let actualTrigger = trigger;
      if (eventType === "validation.completed") {
        const p = payload as Record<string, unknown>;
        actualTrigger = p.passed === false ? "validation_fail" : "validation_pass";
      }

      const context: RuleContext = {
        trigger: actualTrigger,
        eventData: payload as Record<string, unknown>,
        projectRoot,
        shitennoDir,
        timestamp: new Date().toISOString(),
        installedCapabilities: loadMaturityProfile(shitennoDir)?.installedCapabilities ?? ["core"],
        isResourceClaimed: resourceClaimChecker,
      };

      await executeRules(rules, context);
    });
  }
}
