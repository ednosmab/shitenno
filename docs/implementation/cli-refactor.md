---
category: implementation
lifecycle: Active
---

# 23 — CLI REFACTOR

> Plan to refactor CLI commands using shared infrastructure.

## Current State

13 commands with ~280 lines of duplicated code:
- Initialization guard (8 commands × ~20 lines = ~160 lines)
- Banner display (9 commands × ~5 lines = ~45 lines)
- JSON output boilerplate (9 commands × ~10 lines = ~90 lines)
- Report writing (4 modules × ~20 lines = ~80 lines)

## Target State

Shared infrastructure in `src/shared.ts`:
- `resolveProjectContext()` — replaces init guard
- `createCommand()` — wraps command creation with banner + JSON
- `writeReport()` — replaces duplicated report writing
- `withCache()` — wraps cache read/write

## Refactor Plan

### Step 1: Create `src/shared.ts`

```typescript
// ~200 lines
// Contains: resolveProjectContext, createCommand, writeReport, withCache
```

### Step 2: Refactor commands one by one

| Command | Lines Before | Lines After | Reduction |
|---------|-------------|-------------|-----------|
| status.ts | 521 | ~350 | ~33% |
| detect.ts | 182 | ~120 | ~34% |
| audit.ts | 180 | ~120 | ~33% |
| validate.ts | 504 | ~350 | ~31% |
| assess.ts | 301 | ~200 | ~34% |
| upgrade.ts | 281 | ~180 | ~36% |
| doctor.ts | 390 | ~280 | ~28% |
| clean.ts | 111 | ~80 | ~28% |
| sync.ts | 382 | ~280 | ~27% |

### Step 3: Add rendering functions to `formatting.ts`

- `renderDimensionBars()` — extract from init/assess/status
- `renderCapabilityList()` — extract from init/upgrade/assess
- `renderCheckResults()` — extract from status/validate

### Step 4: Verify

- All 164 tests pass
- TypeCheck passes
- CLI integration tests pass

## Estimated Impact

| Metric | Before | After |
|--------|--------|-------|
| Total command lines | ~3,037 | ~2,000 |
| Duplicated code | ~280 lines | ~0 lines |
| Shared infrastructure | 0 | ~200 lines |
| Net reduction | — | ~837 lines |

## Implementation Order

1. Create `src/shared.ts`
2. Add rendering functions to `src/formatting.ts`
3. Refactor `status.ts` (largest command)
4. Refactor `validate.ts` (second largest)
5. Refactor remaining commands
6. Update tests if needed
7. Run full test suite
