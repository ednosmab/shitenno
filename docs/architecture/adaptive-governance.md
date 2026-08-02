---
category: architecture
lifecycle: Active
---

# 13 — ADAPTIVE GOVERNANCE

> Rule engine formal specification.

## The Rule Engine

Shugo includes a declarative rule engine that automates governance behaviors. Rules are defined as data, not code.

## Rule Structure

```typescript
interface Rule {
  id: string;
  description: string;
  trigger: TriggerType;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;      // 1 (highest) to 5 (lowest)
  dependencies: string[]; // Rule IDs that must execute first
  enabled: boolean;
  tags: string[];
}
```

## Trigger Types (17)

| Trigger | When It Fires |
|---------|--------------|
| `session_start` | A new session begins |
| `session_end` | A session closes |
| `file_change` | A governance file is modified |
| `git_commit` | A commit is made |
| `git_push` | Code is pushed |
| `assessment` | Maturity is re-assessed |
| `health_check` | Health audit runs |
| `capability_install` | A capability is installed |
| `capability_remove` | A capability is removed |
| `adr_created` | A new ADR is created |
| `skill_created` | A new skill is created |
| `contract_created` | A new contract is created |
| `validation_fail` | Session validation fails |
| `validation_pass` | Session validation passes |
| `maturity_change` | Maturity score changes |
| `knowledge_debt_detected` | Knowledge debt is detected |
| `pattern_detected` | A pattern is detected |
| `manual` | Manually triggered |

## Condition Operators (9)

| Operator | Description |
|----------|-------------|
| `equals` | Field equals value |
| `not_equals` | Field does not equal value |
| `contains` | Field contains value |
| `not_contains` | Field does not contain value |
| `greater_than` | Field is greater than value |
| `less_than` | Field is less than value |
| `exists` | Field exists (non-null) |
| `not_exists` | Field does not exist |
| `matches_regex` | Field matches regex pattern |

## Action Types (14)

| Action | Description | Status |
|--------|-------------|--------|
| `update_context_buffer` | Modify context buffer | Implemented |
| `create_reminder` | Add reminder to buffer | Implemented |
| `remove_reminder` | Remove reminder from buffer | Stub |
| `update_quick_board` | Modify quick board | Implemented |
| `create_adr` | Create a new ADR | Stub |
| `create_skill` | Create a new skill | Stub |
| `log_event` | Write to history | Implemented |
| `send_notification` | Send notification | Stub |
| `trigger_assessment` | Run maturity assessment | Stub |
| `trigger_health_check` | Run health audit | Stub |
| `update_backlog` | Add item to backlog | Implemented |
| `run_script` | Execute shell command | Implemented |
| `update_file` | Modify a file | Stub |
| `create_file` | Create a new file | Stub |

## Condition Evaluation

Conditions are evaluated using dot-notation field resolution:

```typescript
function resolveField(path: string, context: RuleContext): unknown {
  const parts = path.split(".");
  let current: unknown = context;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
```

All conditions must be true (AND logic).

## Default Rules

### RULE-001: Log Session Start
- **Trigger:** `session_start`
- **Action:** `log_event`
- **Priority:** 5

### RULE-002: Log Session End
- **Trigger:** `session_end`
- **Action:** `log_event`
- **Priority:** 5

### RULE-003: Validation Failure Response
- **Trigger:** `validation_fail`
- **Conditions:** `validation.failCount > 3`
- **Actions:** `trigger_health_check`, `create_reminder`
- **Priority:** 2

### RULE-004: Maturity Change Suggestion
- **Trigger:** `maturity_change`
- **Conditions:** `maturity.scoreDelta > 10`
- **Action:** `create_reminder` (suggest upgrade)
- **Priority:** 3

### RULE-005: Knowledge Debt Response
- **Trigger:** `knowledge_debt_detected`
- **Conditions:** `debt.severity == "critical" || debt.severity == "high"`
- **Actions:** `update_backlog`, `create_reminder`
- **Priority:** 2

### RULE-006: Pattern Detection Logging
- **Trigger:** `pattern_detected`
- **Action:** `log_event`
- **Priority:** 4

## Execution Flow

```
1. Filter rules by trigger type and enabled flag
2. Sort by priority (ascending — lower number = higher priority)
3. For each rule:
   a. Check dependencies (must have succeeded first)
   b. Evaluate all conditions (AND logic)
   c. Execute actions sequentially
   d. Track success/failure per action
4. Aggregate results into EngineResult
```

## Storage

Rules are stored as JSON files in `governance/rules/`. Each file contains one rule.

```json
{
  "id": "RULE-001",
  "description": "Log session start",
  "trigger": "session_start",
  "conditions": [],
  "actions": [
    { "type": "log_event", "params": { "eventType": "session_start" } }
  ],
  "priority": 5,
  "dependencies": [],
  "enabled": true,
  "tags": ["logging"]
}
```

## Implementation

- **Engine:** `executeRules()` in `src/rule-engine.ts:359`
- **Condition evaluator:** `evaluateCondition()` in `src/rule-engine.ts:196`
- **Action executor:** `executeAction()` in `src/rule-engine.ts:246`
- **Default rules:** `getDefaultRules()` in `src/rule-engine.ts:455`
- **Initialization:** `initializeRules()` in `src/rule-engine.ts:551`
