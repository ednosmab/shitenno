# ENGINE_REGISTRY.md — Unified Executor Registry

> Single source of truth for action executors across the codebase.

## Overview

Two execution paths exist:

| Path | Module | Entry point | Executors |
|---|---|---|---|
| **invokeAction** | `src/decision-core/invoke.ts` | `invokeAction()` | Primary — all rule engine actions |
| **ActionEngine** | `src/action-engine/engine.ts` | `ActionEngine.execute()` | Orchestrator — uses its own executor registry |

`ActionEngine.execute()` uses `runPolicyGate` from `decision-core/invoke.ts` for policy checks and `claimResource`/`releaseResource` for resource arbitration — no code duplication.

---

## invokeAction Executors (primary)

Registered in `src/decision-core/invoke.ts` → `EXECUTORS` map.

| Type | Class | File | Notes |
|---|---|---|---|
| `run_script` | `RunScriptExecutor` | `executors/run-script.ts` | Runs shell scripts |
| `run_local_script` | `RunLocalScriptExecutor` | `executors/run-script.ts` | Runs local scripts only |
| `run_shugo_command` | `RunShugoCommandExecutor` | `executors/run-script.ts` | Runs shugo subcommands |
| `create_reminder` | `CreateReminderExecutor` | `executors/create-reminder.ts` | Creates reminders |
| `apply_autofix` | `ApplyAutofixExecutor` | `executors/apply-autofix.ts` | Applies auto-fixes |
| `*` (default) | `GenericRuleActionExecutor` | `executors/generic-rule-action.ts` | Wraps `executeAction()` from `rule-engine/actions.ts` for: `update_context_buffer`, `log_event`, `update_quick_board`, `trigger_assessment`, `trigger_health_check`, `update_backlog`, `update_backlog_status`, `archive_plan`, `auto_populate_next_p0` |

---

## ActionEngine Executors (orchestrator)

Registered in `src/action-engine/engine.ts` constructor.

| Type | Class | File | Notes |
|---|---|---|---|
| `log_event` | `LogEventExecutor` | `action-engine/executors.ts` | Logs events |
| `notify` | `NotifyExecutor` | `action-engine/executors.ts` | Console notifications |
| `create_reminder` | `CreateReminderExecutor` | `decision-core/executors/index.ts` | Shared with invokeAction |
| `run_script` | `RunScriptExecutor` | `decision-core/executors/index.ts` | Shared with invokeAction |
| `*` (default) | `GenericRuleActionExecutor` | `decision-core/executors/generic-rule-action.ts` | Shared with invokeAction |

---

## Resource Arbitration

Both paths use the same resource arbitration:

- `claimResource(resourceId, claimType)` — acquires claim
- `releaseResource(resourceId, sessionId)` — releases claim
- `getResourceId(actionType, params)` — derives resource ID

Resource IDs are derived from action type and params (e.g., `plan:PLAN-xxx` for plan-related actions).

---

## Adding New Executors

1. Create executor class implementing `ActionExecutor` interface
2. For **invokeAction**: add to `EXECUTORS` map in `src/decision-core/invoke.ts`
3. For **ActionEngine**: add `this.registerExecutor()` call in constructor
4. If both paths should handle it: register in both places
5. Update this file

---

## Dead Code Removal

- `evaluatePolicyGate` — removed in Phase C (duplicate of `runPolicyGate`)
- `findIdempotentMatch` — removed in Phase C (now inline in `invokeAction`)
- `runWithResources` — removed in Phase C (now inline in `invokeAction`)
