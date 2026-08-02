---
category: product
lifecycle: Active
---

# Testing Patterns — Console Error/Warning Convention

## The Problem

Tests that intentionally trigger errors (plugin failures, handler errors, invalid input)
produce `console.error` / `console.warn` output. This output clutters the terminal,
makes real failures harder to spot, and creates a culture where error output is ignored.

## The Solution: `vitest-fail-on-console`

We use [`vitest-fail-on-console`](https://www.npmjs.com/package/vitest-fail-on-console)
to make any **unexpected** `console.error` or `console.warn` fail the test.

**Setup:** `src/__tests__/setup.ts`
```ts
import failOnConsole from "vitest-fail-on-console";

failOnConsole({
  shouldFailOnError: true,
  shouldFailOnWarn: true,
});
```

This is loaded globally via `vitest.config.ts → setupFiles`.

## The Rule

> **If a test intentionally produces `console.error` or `console.warn`, it MUST mock
> the console method explicitly.**

This makes the intent visible and prevents accidental error output from going unnoticed.

## How to Fix a Failing Test

When a test fails with `vitest-fail-on-console > Expected test not to call console.error()`,
it means the test triggers a `logger.error()` or `logger.warn()` call without mocking.

**Add a mock at the top of the test:**

```ts
// For console.error (logger.error calls)
vi.spyOn(console, "error").mockImplementation(() => {});

// For console.warn (logger.warn calls)
vi.spyOn(console, "warn").mockImplementation(() => {});
```

**Example:**

```ts
it("handler errors do not affect other handlers", () => {
  // This test intentionally triggers logger.error → console.error
  vi.spyOn(console, "error").mockImplementation(() => {});

  const bus = getEventBus();
  bus.subscribe("validation.completed", () => {
    throw new Error("handler error");
  });
  // ... rest of test
});
```

## Logger Level Mapping

The logger (`src/logger.ts`) maps levels to console methods:

| Level | Console Method | failOnConsole catches? |
|-------|---------------|----------------------|
| `debug` | `console.debug` | No |
| `info` | `console.log` | No |
| `warn` | `console.warn` | **Yes** |
| `error` | `console.error` | **Yes** |

## Tests That Commonly Need Mocks

- **Error injection tests** — tests that throw inside handlers/hooks
- **Validation rejection tests** — tests that trigger `logger.warn` for invalid input
- **Circuit breaker tests** — tests that trigger `logger.warn` on trip
- **Rule engine tests** — tests that load invalid JSON rules

## Checklist for New Tests

When writing a test that might trigger `logger.error` or `logger.warn`:

- [ ] Does the code path call `logger.error()` or `logger.warn()`?
- [ ] If yes, is `vi.spyOn(console, "error").mockImplementation(() => {})` present?
- [ ] Does the test still validate the behavior (not just suppress the output)?
