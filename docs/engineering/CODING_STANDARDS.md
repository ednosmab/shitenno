---
category: engineering
lifecycle: Active
---

# Coding Standards

> Code style and quality rules for the Shugo CLI codebase.

## TypeScript

- **Strict mode** enabled
- **No `any` types** — Use proper types
- **No `@ts-ignore`** — Fix the issue instead
- **Explicit return types** on public functions
- **Interface over type** for object shapes

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `capability-engine.ts` |
| Functions | camelCase | `calculateComplexityScore()` |
| Classes | PascalCase | `ShitennoEventBus` |
| Interfaces | PascalCase | `ProjectContext` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Enums | PascalCase | `LifecycleState` |

## Imports

```typescript
// 1. Node.js built-ins
import { join } from "path";
import { existsSync } from "fs";

// 2. External packages
import { Command } from "commander";

// 3. Internal modules
import { resolveProjectContext } from "./shared.js";
import { getEventBus } from "./event-bus.js";
```

## Error Handling

```typescript
// Use structured errors
const error = { error: "not_initialized", message: "Run `shugo init` first" };

// Never swallow errors silently
try {
  await doSomething();
} catch (error) {
  logger.error("Operation failed", error);
  throw error;
}
```

## Logging

```typescript
// Use the centralized logger
import { logger } from "./logger.js";

logger.info("Processing started");
logger.warn("Cache miss detected");
logger.error("Operation failed", error);
```

## Testing

- **TDD** — Write tests before implementation
- **Arrange-Act-Assert** pattern
- **One assertion per test** when possible
- **Descriptive test names** — `should calculate complexity score correctly`

## Documentation

- **JSDoc** on public functions
- **Comments** for non-obvious logic
- **No comments** for obvious code
- **Update docs** with code changes

---

*Last updated: 2026-06-29*
