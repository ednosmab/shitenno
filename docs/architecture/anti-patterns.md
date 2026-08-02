---
category: architecture
lifecycle: Active
---

# 27 — ANTI-PATTERNS

> What NOT to do when working on Shugo.

## Architecture Anti-Patterns

### 1. Direct Module Coupling

**Bad:** Module A imports and calls Module B directly.
**Good:** Module A publishes an event, Module B subscribes.

```typescript
// BAD
import { detectPatterns } from "./pattern-detector.js";
const patterns = detectPatterns(shitennoDir);

// GOOD
import { getEventBus } from "./event-bus.js";
bus.publish("analysis.complete", { analysis });
// pattern-detector subscribes and reacts
```

### 2. Monolithic Commands

**Bad:** A command with 500+ lines doing everything.
**Good:** Commands delegate to shared infrastructure.

```typescript
// BAD
export const statusCommand = new Command("status")
  .action(async (options) => {
    // 20 lines of init guard
    // 10 lines of banner
    // 30 lines of cache logic
    // 50 lines of business logic
    // 20 lines of display logic
  });

// GOOD
export const statusCommand = createCommand("status", "...", async (ctx) => {
  // Just business logic
});
```

### 3. Hardcoded Configuration

**Bad:** Magic numbers and strings scattered through code.
**Good:** Configuration in one place.

```typescript
// BAD
if (score > 65) { /* ... */ }
if (debt.totalGaps > 5) { /* ... */ }

// GOOD
import { SCORING_THRESHOLDS, DEBT_THRESHOLDS } from "./config.js";
if (score > SCORING_THRESHOLDS.SENIOR) { /* ... */ }
```

### 4. Swallowed Errors

**Bad:** Catching errors and doing nothing.
**Good:** Catching errors and logging/handling them.

```typescript
// BAD
try {
  const content = readFileSync(path, "utf-8");
} catch {
  // skip
}

// GOOD
try {
  const content = readFileSync(path, "utf-8");
} catch (error) {
  console.error(`[ModuleName] Failed to read ${path}:`, error);
}
```

## Testing Anti-Patterns

### 5. Testing Implementation Details

**Bad:** Testing internal function names and private state.
**Good:** Testing public behavior and outputs.

```typescript
// BAD
expect(internalHelper).toBeDefined();
expect(privateState.count).toBe(3);

// GOOD
const result = publicFunction(input);
expect(result.output).toBe("expected");
```

### 6. Shared Test State

**Bad:** Tests that depend on other tests running first.
**Good:** Each test is independent.

```typescript
// BAD
let sharedData;
beforeAll(() => { sharedData = setup(); });
test("uses shared data", () => { expect(sharedData).toBeDefined(); });

// GOOD
let testData;
beforeEach(() => { testData = setup(); });
test("uses fresh data", () => { expect(testData).toBeDefined(); });
```

## Code Anti-Patterns

### 7. Using `any`

**Bad:** `any` type disables type checking.
**Good:** `unknown` with type guards.

```typescript
// BAD
function process(data: any) { return data.foo; }

// GOOD
function process(data: unknown) {
  if (typeof data === "object" && data !== null && "foo" in data) {
    return (data as { foo: string }).foo;
  }
}
```

### 8. String Paths

**Bad:** Hardcoded path separators.
**Good:** Platform-independent path construction.

```typescript
// BAD
const path = shitennoDir + "/docs/adrs/" + filename;

// GOOD
const path = join(shitennoDir, "docs", "adrs", filename);
```

### 9. Synchronous File Operations in Hot Paths

**Bad:** `readFileSync` in loops or performance-critical code.
**Good:** Async I/O or batched reads.

```typescript
// BAD
for (const file of files) {
  const content = readFileSync(file, "utf-8");
}

// GOOD
const contents = await Promise.all(
  files.map(file => readFile(file, "utf-8"))
);
```

## Governance Anti-Patterns

### 10. Auto-Applying Changes

**Bad:** Shugo modifying governance files without human approval.
**Good:** Shugo proposing changes for human review.

```typescript
// BAD
writeFileSync(governancePath, newContent);

// GOOD
console.log("Proposed change:", diff);
console.log("Run `shugo apply` to accept");
```

### 11. Bypassing the Knowledge Lifecycle

**Bad:** Creating contracts without ADRs, skills without decisions.
**Good:** Following the 9-stage lifecycle.

```
BAD: Contract → Decision → ADR
GOOD: Decision → ADR → Skill → Contract
```

### 12. Ignoring the Capability Model

**Bad:** Adding files without mapping them to capabilities.
**Good:** Every file belongs to a capability.

```typescript
// BAD
// Just create files wherever

// GOOD
// Use capability-mapping.ts to define where files go
```
