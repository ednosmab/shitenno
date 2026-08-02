---
category: architecture
lifecycle: Active
---

# 18 — STATE MACHINE

> Shugo lifecycle gates.

## The States

Shugo itself has a lifecycle. It progresses through states:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  uninitialized → discovered → assessed → governed → evolved     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| State | Description | Entry Criteria |
|-------|-------------|---------------|
| `uninitialized` | No Shugo configuration exists | Default state |
| `discovered` | `shugo init` has been run | opencode.json + shitenno/ exist |
| `assessed` | Maturity has been evaluated | maturity-profile.json exists |
| `governed` | Governance rules are in place | WORKFLOW.md + contracts exist |
| `evolved` | System has recommended and implemented improvements | evolution report exists |

## State Definitions

```typescript
type ShitennoLifecycleState = 
  | "uninitialized"
  | "discovered" 
  | "assessed"
  | "governed"
  | "evolved";
```

## State Transitions

```typescript
interface StateTransition {
  from: ShitennoLifecycleState;
  to: ShitennoLifecycleState;
  trigger: string;
  guards: Array<(context: PipelineContext) => boolean>;
}
```

### Valid Transitions

| From | To | Trigger | Guard |
|------|----|---------|-------|
| `uninitialized` | `discovered` | `shugo init` | opencode.json created |
| `discovered` | `assessed` | `shugo assess` or `shugo status` | maturity-profile.json exists |
| `assessed` | `governed` | `shugo upgrade --capability governance` | WORKFLOW.md exists |
| `governed` | `evolved` | `shugo run` pipeline completes | evolution report exists |
| `evolved` | `governed` | `shugo assess` (regression) | maturity decreased |
| `governed` | `assessed` | `shugo assess` (regression) | governance removed |

## Invalid Transitions

These transitions are blocked:

| From | To | Why Blocked |
|------|----|-------------|
| `uninitialized` | `assessed` | Must discover first |
| `uninitialized` | `governed` | Must discover first |
| `uninitialized` | `evolved` | Must discover first |
| `discovered` | `evolved` | Must assess first |
| `discovered` | `governed` | Must assess first |

## The State Machine Interface

```typescript
interface ShitennoStateMachine {
  getState(): ShitennoLifecycleState;
  canTransition(to: ShitennoLifecycleState): boolean;
  transition(to: ShitennoLifecycleState, context: PipelineContext): boolean;
  getHistory(): Array<{ from: ShitennoLifecycleState; to: ShitennoLifecycleState; timestamp: string }>;
}
```

## Implementation

```typescript
class DefaultShitennoStateMachine implements ShitennoStateMachine {
  private current: ShitennoLifecycleState;
  private history: Array<{ from: ShitennoLifecycleState; to: ShitennoLifecycleState; timestamp: string }> = [];

  constructor(initialState: ShitennoLifecycleState = "uninitialized") {
    this.current = initialState;
  }

  getState(): ShitennoLifecycleState {
    return this.current;
  }

  canTransition(to: ShitennoLifecycleState): boolean {
    return isValidTransition(this.current, to);
  }

  transition(to: ShitennoLifecycleState, context: PipelineContext): boolean {
    if (!this.canTransition(to)) return false;

    const from = this.current;
    this.current = to;
    this.history.push({ from, to, timestamp: new Date().toISOString() });

    // Publish event
    getEventBus().publish("lifecycle.state_changed", { from, to });

    return true;
  }

  getHistory() {
    return [...this.history];
  }
}
```

## Detection

The current state is detected from filesystem:

```typescript
function detectLifecycleState(projectRoot: string, shitennoDir: string): ShitennoLifecycleState {
  if (!existsSync(join(projectRoot, "opencode.json"))) return "uninitialized";
  if (!existsSync(join(shitennoDir, "maturity-profile.json"))) return "discovered";
  if (!existsSync(join(shitennoDir, "governance", "WORKFLOW.md"))) return "assessed";
  
  const reportsDir = join(shitennoDir, "reports");
  if (existsSync(reportsDir)) {
    const evolutionReports = readdirSync(reportsDir)
      .filter(f => f.startsWith("evolution-") && f.endsWith(".json"));
    if (evolutionReports.length > 0) return "evolved";
  }
  
  return "governed";
}
```

## Gate Enforcement

Some commands are gated by state:

| Command | Required State |
|---------|---------------|
| `shugo init` | `uninitialized` |
| `shugo status` | `discovered`+ |
| `shugo detect` | `assessed`+ |
| `shugo audit` | `assessed`+ |
| `shugo upgrade` | `assessed`+ |
| `shugo validate` | `discovered`+ |
| `shugo assess` | `discovered`+ |
| `shugo doctor` | `assessed`+ |
| `shugo run` | `assessed`+ |

## Event Integration

State transitions publish events:

```typescript
bus.subscribe("lifecycle.state_changed", ({ from, to }) => {
  console.log(`Shugo lifecycle: ${from} → ${to}`);
});
```

## Implementation

- **File:** `src/shitenno-state-machine.ts` (~220 lines)
- **Detection:** `detectLifecycleState()`
- **State machine:** `DefaultShitennoStateMachine`
- **Integration:** Commands check state before executing
