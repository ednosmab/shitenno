---
category: architecture
lifecycle: Active
---

# 15 — EVENT BUS

> Pub/sub architecture for module communication.

## The Problem

Today, Shugo modules are isolated. `pattern-detector` doesn't know what `health-auditor` found. `knowledge-debt` doesn't feed `auto-evolution`. Each module is an island.

The event bus connects them.

## Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Module A │     │ Module B │     │ Module C │
└────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │
     ▼                ▼                ▼
┌─────────────────────────────────────────────┐
│              EVENT BUS                      │
│                                             │
│  publish(event) → filter → deliver          │
│                                             │
│  subscribers: Map<EventType, Handler[]>     │
└─────────────────────────────────────────────┘
```

## Event Types

### Session Events

| Event | Payload | Published By |
|-------|---------|-------------|
| `session.start` | `{ sessionId, branch }` | init, assess |
| `session.end` | `{ sessionId, summary }` | close-session |
| `lifecycle.state_changed` | `{ previous, current, trigger }` | shitenno-state-machine |

### Analysis Events

| Event | Payload | Published By |
|-------|---------|-------------|
| `analysis.complete` | `{ analysis }` | analyser |
| `score.calculated` | `{ report }` | scorer |
| `pattern.detected` | `{ patterns }` | pattern-detector |
| `health.checked` | `{ report }` | health-auditor |
| `entropy.calculated` | `{ entropyScore, factors }` | scorer |
| `knowledge.analyzed` | `{ knowledgeReport }` | knowledge-graph |

### Knowledge Events

| Event | Payload | Published By |
|-------|---------|-------------|
| `debt.detected` | `{ report }` | knowledge-debt |
| `adr.created` | `{ adr }` | (external) |
| `skill.created` | `{ skill }` | (external) |
| `knowledge.analyzed` | `{ knowledgeReport }` | knowledge-graph |

### Asset Events

| Event | Payload | Published By |
|-------|---------|-------------|
| `asset.created` | `{ asset, type }` | scaffolder, external |
| `asset.updated` | `{ asset, changes }` | external |
| `asset.archived` | `{ asset, reason }` | external |

### Capability Events

| Event | Payload | Published By |
|-------|---------|-------------|
| `capability.installed` | `{ capability }` | upgrade |
| `capability.unlocked` | `{ capability, triggers }` | capability-engine |
| `maturity.changed` | `{ previous, current }` | assess |

### Pipeline Events

| Event | Payload | Published By |
|-------|---------|-------------|
| `pipeline.complete` | `{ pipelineId, results, duration }` | pipeline |

### Governance Events

| Event | Payload | Published By |
|-------|---------|-------------|
| `rule.triggered` | `{ ruleId, result }` | rule-engine |
| `governance.policy_applied` | `{ policyId, scope, outcome }` | rule-engine |

### Recommendation Events

| Event | Payload | Published By |
|-------|---------|-------------|
| `evolution.recommended` | `{ recommendations }` | auto-evolution |
| `recommendation.accepted` | `{ recommendation, userId }` | feedback-loops |
| `recommendation.rejected` | `{ recommendation, reason }` | feedback-loops |

### Validation Events

| Event | Payload | Published By |
|-------|---------|-------------|
| `validation.completed` | `{ results }` | validate |

## The Interface

```typescript
type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

interface EventBus {
  publish<T>(eventType: ShitennoEventType, payload: T): void;
  subscribe<T>(eventType: ShitennoEventType, handler: EventHandler<T>): unsubscribe;
  subscribeOnce<T>(eventType: ShitennoEventType, handler: EventHandler<T>): unsubscribe;
  removeAllListeners(eventType?: ShitennoEventType): void;
  listenerCount(eventType: ShitennoEventType): number;
}
```

## Implementation

```typescript
class ShitennoEventBus implements EventBus {
  private listeners = new Map<string, Set<EventHandler>>();
  private eventHistory: Array<{ type: string; payload: unknown; timestamp: string }> = [];

  publish<T>(eventType: ShitennoEventType, payload: T): void {
    // Record in history
    this.eventHistory.push({
      type: eventType,
      payload,
      timestamp: new Date().toISOString(),
    });

    // Deliver to all subscribers
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload);
        } catch (error) {
          console.error(`Event handler error for ${eventType}:`, error);
        }
      }
    }
  }

  subscribe<T>(eventType: ShitennoEventType, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(handler as EventHandler);
    };
  }
}
```

## Singleton Pattern

The event bus is a singleton — one instance shared across all modules:

```typescript
let globalBus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!globalBus) {
    globalBus = new ShitennoEventBus();
  }
  return globalBus;
}
```

## Usage Examples

### Publishing Events

```typescript
import { getEventBus } from "./event-bus.js";

// After scoring
const bus = getEventBus();
bus.publish("score.calculated", { report: complexityReport });

// After pattern detection
bus.publish("pattern.detected", { patterns: detectedPatterns });
```

### Subscribing to Events

```typescript
import { getEventBus } from "./event-bus.js";

const bus = getEventBus();

// When patterns are detected, check if rules should fire
bus.subscribe("pattern.detected", ({ patterns }) => {
  if (patterns.length > 0) {
    bus.publish("rule.triggered", { ruleId: "RULE-006", patterns });
  }
});

// When maturity changes, suggest upgrade
bus.subscribe("maturity.changed", ({ previous, current }) => {
  if (current.overallScore - previous.overallScore > 10) {
    bus.publish("evolution.recommended", {
      recommendations: [{ type: "capability_upgrade", priority: "high" }]
    });
  }
});
```

## Error Handling

- Handler errors are caught and logged, not propagated
- Failed handlers do not affect other handlers
- Event history is preserved for debugging

## Performance

- Event delivery is synchronous (for simplicity)
- History is unbounded (can be capped in future)
- No async scheduling (handlers should be fast)

## Implementation

- **File:** `src/event-bus.ts` (~200 lines)
- **Singleton:** `getEventBus()`
- **Types:** `ShitennoEventType`, `EventHandler`, `EventBus`
