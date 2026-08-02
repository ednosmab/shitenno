/**
 * Default rule definitions for the rule engine.
 */

import type { Rule } from "../domain/rules/rule.js";
import type { Capability } from "../domain/entities/engineering-state.js";

function r(def: {
  id: string; description: string; trigger: Rule["trigger"];
  actions: Rule["actions"]; priority: number;
  conditions?: Rule["conditions"]; tags?: string[];
  requiredCapability?: string; dependencies?: string[];
}): Rule {
  return {
    id: def.id, description: def.description, trigger: def.trigger,
    conditions: def.conditions ?? [],
    actions: def.actions, priority: def.priority,
    dependencies: def.dependencies ?? [],
    enabled: true,
    tags: def.tags ?? [],
    requiredCapability: def.requiredCapability as Capability | undefined,
  };
}

function ruleSessionStart(): Rule[] {
  return [
    r({ id: "RULE-001", description: "Log session start in history", trigger: "session_start",
      actions: [{ type: "log_event", params: { event: "session_start", message: "Session started" } }], priority: 1,
      tags: ["session", "logging"], requiredCapability: "metrics" }),
    r({ id: "RULE-007", description: "Remind to improve health when pipeline score is low", trigger: "session_start",
      actions: [{ type: "create_reminder", params: { message: "Health score is below 50 — run 'shugo audit' to improve" } }], priority: 2,
      conditions: [{ field: "eventData.healthScore", operator: "less_than", value: 50 }],
      tags: ["health", "reminder", "pipeline"], requiredCapability: "governance" }),
    r({ id: "RULE-010", description: "Remind about knowledge debt on session start", trigger: "session_start",
      actions: [{ type: "create_reminder", params: { message: "Knowledge debt is high — address gaps in ADRs and skills" } },
       { type: "update_backlog", params: { item: "Reduce knowledge debt" } }], priority: 1,
      conditions: [{ field: "eventData.knowledgeDebt", operator: "greater_than", value: 5 }],
      tags: ["knowledge", "debt", "session"], requiredCapability: "governance" }),
  ];
}

function ruleSessionEnd(): Rule[] {
  return [
    r({ id: "RULE-002", description: "Log session end in history", trigger: "session_end",
      actions: [{ type: "log_event", params: { event: "session_end", message: "Session ended" } }], priority: 1,
      tags: ["session", "logging"], requiredCapability: "metrics" }),
    r({ id: "RULE-015", description: "Archive active plans on session end", trigger: "session_end",
      actions: [{ type: "log_event", params: { event: "session_end_plans", message: "Session ended — run 'shugo plan md lifecycle' to archive active plans" } }], priority: 3,
      tags: ["session", "plans", "verification"] }),
  ];
}

function ruleValidation(): Rule[] {
  return [
    r({ id: "RULE-003", description: "Trigger health check on validation failure", trigger: "validation_fail",
      actions: [{ type: "trigger_health_check", params: {} },
       { type: "create_reminder", params: { message: "Multiple validation failures detected — run 'shugo audit'" } }], priority: 2,
      conditions: [{ field: "eventData.failCount", operator: "greater_than", value: 3 }],
      tags: ["validation", "health"], requiredCapability: "governance" }),
    r({ id: "RULE-009", description: "Log successful full validation", trigger: "validation_pass",
      actions: [{ type: "log_event", params: { event: "validation_complete", message: "All validations passed — system is healthy" } }], priority: 4,
      conditions: [{ field: "eventData.passRate", operator: "equals", value: 100 }],
      tags: ["validation", "logging", "success"], requiredCapability: "metrics" }),
    r({ id: "RULE-014", description: "Create reminder when validation fails", trigger: "validation_fail",
      actions: [{ type: "create_reminder", params: { message: "Validation failed — review issues and fix" } },
       { type: "update_quick_board", params: { item: "Fix validation failures", section: "parado" } }], priority: 2,
      tags: ["validation", "reminder", "fix"] }),
  ];
}

function ruleMaturityHealth(): Rule[] {
  return [
    r({ id: "RULE-004", description: "Recommend capability upgrade on maturity increase", trigger: "maturity_change",
      actions: [{ type: "update_quick_board", params: { item: "Run 'shugo upgrade --accept-recommended'", section: "proximo" } }], priority: 3,
      conditions: [{ field: "eventData.delta", operator: "greater_than", value: 10 }],
      tags: ["maturity", "upgrade"], requiredCapability: "governance" }),
    r({ id: "RULE-012", description: "Update context buffer on significant maturity change", trigger: "maturity_change",
      actions: [{ type: "update_context_buffer", params: { field: "current_task.description", value: "Maturity changed significantly" } },
       { type: "log_event", params: { event: "maturity_shift", message: "Significant maturity change detected" } }], priority: 2,
      conditions: [{ field: "eventData.delta", operator: "greater_than", value: 5 }],
      tags: ["maturity", "context", "tracking"] }),
    r({ id: "RULE-011", description: "Auto-audit when health status is critical", trigger: "health_check",
      actions: [{ type: "run_shugo_command", params: { command: "validate" } },
       { type: "create_reminder", params: { message: "Health status is CRITICAL — immediate action required" } }], priority: 1,
      conditions: [{ field: "eventData.status", operator: "equals", value: "critical" }],
      tags: ["health", "critical", "auto-audit"] }),
  ];
}

function ruleKnowledgePattern(): Rule[] {
  return [
    r({ id: "RULE-005", description: "Update backlog when knowledge debt is detected", trigger: "knowledge_debt_detected",
      actions: [{ type: "update_backlog", params: { item: "Address knowledge debt gaps" } },
       { type: "create_reminder", params: { message: "Knowledge debt detected — review gaps" } }], priority: 2,
      conditions: [{ field: "eventData.gapCount", operator: "greater_than", value: 0 }],
      tags: ["knowledge", "debt", "backlog"], requiredCapability: "governance" }),
    r({ id: "RULE-013", description: "Create backlog item when knowledge debt gaps exceed threshold", trigger: "knowledge_debt_detected",
      actions: [{ type: "update_backlog", params: { item: "Address critical knowledge debt (3+ gaps detected)" } },
       { type: "create_reminder", params: { message: "High knowledge debt detected — create ADRs and skills" } }], priority: 1,
      conditions: [{ field: "eventData.gapCount", operator: "greater_than", value: 3 }],
      tags: ["knowledge", "debt", "backlog", "critical"] }),
    r({ id: "RULE-006", description: "Log pattern detection results", trigger: "pattern_detected",
      actions: [{ type: "log_event", params: { event: "pattern_detected", message: "Patterns detected in project history" } }], priority: 3,
      conditions: [{ field: "eventData.patternCount", operator: "greater_than", value: 0 }],
      tags: ["pattern", "logging"], requiredCapability: "metrics" }),
  ];
}

function ruleTaskPlan(): Rule[] {
  return [
    r({ id: "RULE-008", description: "Log ADR creation and suggest skill extraction", trigger: "adr_created",
      actions: [{ type: "log_event", params: { event: "adr_created", message: "New ADR created — consider extracting skills" } }], priority: 3,
      tags: ["adr", "skill", "logging"], requiredCapability: "metrics" }),
    r({ id: "RULE-016", description: "Auto-transition backlog to em validacao on task completion", trigger: "task_completed",
      actions: [{ type: "update_backlog_status", params: { taskId: "${eventData.taskId}", fromState: "em implementação", toState: "em validação" } }], priority: 1,
      tags: ["backlog", "automation", "completion"] }),
    r({ id: "RULE-017", description: "Update context buffer on task completion", trigger: "task_completed",
      actions: [{ type: "update_context_buffer", params: { field: "current_task.status", value: "completed" } }], priority: 1,
      tags: ["buffer", "automation", "completion"] }),
  ];
}

function rulePlanArchive(): Rule[] {
  return [
    r({ id: "RULE-018", description: "Update context buffer when a plan is archived", trigger: "plan_archived",
      actions: [{ type: "update_context_buffer", params: { field: "current_task.status", value: "completed" } },
       { type: "update_context_buffer", params: { field: "session.status", value: "completed" } },
       { type: "log_event", params: { event: "plan_archived", message: "Plan archived — buffer updated automatically" } }], priority: 1,
      tags: ["buffer", "automation", "plan", "completion"] }),
    r({ id: "RULE-019", description: "Auto-populate next_p0 from BACKLOG.md when a plan is archived", trigger: "plan_archived",
      actions: [{ type: "auto_populate_next_p0", params: {} }], priority: 2,
      dependencies: ["RULE-018"], tags: ["buffer", "automation", "plan", "backlog", "next_p0"] }),
    r({ id: "RULE-020", description: "Auto-prepare new plans: log creation and notify user", trigger: "plan_created",
      actions: [{ type: "log_event", params: { event: "plan_created", message: "New plan detected — run 'shugo plan prepare <planId>' to format header, extract checklist, and sync backlog" } },
       { type: "create_reminder", params: { message: "New plan detected — run 'shugo plan prepare' to prepare it", priority: "medium", category: "plan" } }], priority: 1,
      tags: ["plan", "automation", "pipeline", "preparation"] }),
  ];
}

/** Gera regras padrão para o Shitenno. */
export function getDefaultRules(): Rule[] {
  return [
    ...ruleSessionStart(),
    ...ruleSessionEnd(),
    ...ruleValidation(),
    ...ruleMaturityHealth(),
    ...ruleKnowledgePattern(),
    ...ruleTaskPlan(),
    ...rulePlanArchive(),
  ];
}
