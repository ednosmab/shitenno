import type { Capability } from "../entities/engineering-state.js";

export type TriggerType =
  | "session_start"
  | "session_end"
  | "file_change"
  | "git_commit"
  | "git_push"
  | "assessment"
  | "health_check"
  | "capability_install"
  | "capability_remove"
  | "adr_created"
  | "skill_created"
  | "contrato_created"
  | "validation_fail"
  | "validation_pass"
  | "maturity_change"
  | "knowledge_debt_detected"
  | "pattern_detected"
  | "pipeline_complete"
  | "task_completed"
  | "command_completed"
  | "plan_archived"
  | "plan_created"
  | "plan_file_changed"
  | "plan_status_changed"
  | "manual";

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "exists"
  | "not_exists"
  | "matches_regex";

export type ActionType =
  | "update_context_buffer"
  | "create_reminder"
  | "remove_reminder"
  | "update_quick_board"
  | "create_adr"
  | "create_skill"
  | "log_event"
  | "send_notification"
  | "trigger_assessment"
  | "trigger_health_check"
  | "update_backlog"
  | "run_local_script"
  | "run_script"
  | "run_shugo_command"
  | "update_file"
  | "create_file"
  | "remove_file"
  | "update_backlog_status"
  | "archive_plan"
  | "auto_populate_next_p0"
  | "apply_autofix";

/** Canonical list of valid action types — single source of truth. */
export const VALID_ACTION_TYPES: readonly ActionType[] = [
  "update_context_buffer", "create_reminder", "remove_reminder",
  "update_quick_board", "create_adr", "create_skill", "log_event",
  "send_notification", "trigger_assessment", "trigger_health_check",
  "update_backlog", "run_local_script", "run_script", "run_shugo_command",
  "update_file", "create_file", "remove_file", "update_backlog_status",
  "archive_plan", "auto_populate_next_p0", "apply_autofix",
];

export interface Rule {
  id: string;
  description: string;
  trigger: TriggerType;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  dependencies: string[];
  enabled: boolean;
  tags: string[];
  requiredCapability?: Capability;
  /** Opt-in for Tier 3 actions to execute autonomously. Default false (Tier 3 requires human confirmation). */
  autonomous?: boolean;
}

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value: string | number | boolean;
}

export interface RuleAction {
  type: ActionType;
  params: Record<string, string | number | boolean>;
}

export interface RuleContext {
  trigger: TriggerType;
  eventData: Record<string, unknown>;
  projectRoot: string;
  shitennoDir: string;
  timestamp: string;
  installedCapabilities?: Capability[];
  /**
   * Optional resource-claim checker injected by the daemon.
   * Returns true if the given resourceId is currently claimed by an active CLI session.
   * When set, Tier 2 actions targeting a claimed resource are deferred (ADR-008).
   */
  isResourceClaimed?: (resourceId: string) => boolean;
}

export interface RuleResult {
  ruleId: string;
  success: boolean;
  message: string;
  actionsExecuted: number;
  duration: number;
}

export interface EngineResult {
  rulesEvaluated: number;
  rulesExecuted: number;
  rulesSkipped: number;
  rulesFailed: number;
  results: RuleResult[];
  summary: string;
}
