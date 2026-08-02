---
category: architecture
lifecycle: Active
---

# 12 — CONTEXT MANAGEMENT

> P0-P4 hierarchy, context buffer, loading profiles.

## The Problem

AI agents need context to work effectively. But context is expensive:

- **Too little context:** Agent makes wrong decisions
- **Too much context:** Agent is slow, expensive, confused
- **Wrong context:** Agent optimizes for the wrong thing

Shugo solves this with a hierarchical context system.

## The P0-P4 Hierarchy

```
P0: Global Rules (always loaded)
    ├── AGENTS.md
    ├── src/templates/base/docs/FORBIDDEN_OPERATIONS.md
    └── DESDO.md

P1: Session State (always loaded)
    ├── context_buffer.yaml
    ├── current task
    └── blockers

P2: Task Plan (per-task)
    ├── Current plan
    ├── ADR references
    └── Related skills

P3: Source Code (during execution)
    ├── Files being modified
    ├── Related files
    └── Test files

P4: History (on-demand)
    ├── Session history
    ├── Feedback
    └── Patterns
```

## Loading Profiles

Agents can load context at different levels:

| Profile | P0 | P1 | P2 | P3 | P4 | Tokens (est.) |
|---------|----|----|----|----|----|----|
| **Minimal** | ✓ | ✓ | — | — | — | ~2K |
| **Lite** | ✓ | ✓ | ✓ | — | — | ~8K |
| **Full** | ✓ | ✓ | ✓ | ✓ | ✓ | ~25K |

### When to Use Each Profile

| Profile | Use Case |
|---------|----------|
| **Minimal** | Quick questions, status checks, simple changes |
| **Lite** | Feature implementation, bug fixes, refactoring |
| **Full** | Architecture decisions, complex debugging, major refactors |

## The Context Buffer

The context buffer is the RAM of the session. It tracks:

```yaml
session:
  id: "session-2026-06-27"
  branch: "feature/new-engine"
  operation_type: "FEATURE"

current_task:
  id: "TASK-001"
  type: "feature"
  description: "Implement event bus"
  status: "in_progress"

quick_board:
  emCurso: "Event bus implementation"
  parado:
    - "Waiting for design review"
  proximo:
    - "Connect rule engine to event bus"

reminders:
  - "Run tests before commit"
  - "Update ADR after decision"

next_steps:
  - "Implement pub/sub interface"
  - "Add type-safe event definitions"

blockers:
  - "Need to decide: inline vs separate module"

documents_loaded:
  - "03-DESIGN-PRINCIPLES.md"
  - "15-EVENT-BUS.md"
```

## Context Flow

```
┌─────────────────────────────────────────────┐
│              AGENT STARTS                   │
│                                             │
│  1. Load P0 (global rules)                  │
│  2. Load P1 (session state)                 │
│  3. Determine task type                     │
│  4. Load P2 (task plan)                     │
│  5. Execute task                            │
│  6. Load P3 (source code) as needed         │
│  7. Load P4 (history) on demand             │
│  8. Update context buffer                   │
│  9. Session close → archive memory          │
└─────────────────────────────────────────────┘
```

## The Context Buffer as State Memory

The context buffer maps directly to `SessionMemory` in the three-tier state model:

| Buffer Field | Memory Field |
|-------------|--------------|
| `session.id` | `sessionId` |
| `session.branch` | `branch` |
| `session.operation_type` | `operationType` |
| `current_task` | `currentTask` |
| `quick_board` | `quickBoard` |
| `reminders` | `reminders` |
| `next_steps` | `nextSteps` |
| `blockers` | `blockers` |
| `documents_loaded` | `documentsLoaded` |

## Implementation

- **Context hierarchy:** `src/templates/base/cognition/context/CONTEXT_HIERARCHY.md`
- **Context buffer template:** `src/templates/base/governance/context/context_buffer.yaml`
- **State reader:** `readSessionMemory()` in `src/state-manager.ts:311`
- **Loading profiles:** Defined in CONTEXT_HIERARCHY.md, consumed by agents
