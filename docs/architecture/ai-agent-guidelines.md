---
category: architecture
lifecycle: Active
---

# 26 — AI AGENT GUIDELINES

> Rules for AI agents that collaborate with the Shugo project.

## Reading Order

When working on Shugo, read documents in this order:

### For any task:
1. `03-DESIGN-PRINCIPLES.md` — The 10 immutable principles
2. `27-ANTI-PATTERNS.md` — What NOT to do

### For implementing a feature:
1. The specific capability document (e.g., `07-CAPABILITY-MODEL.md`)
2. `21-COMMAND-ARCHITECTURE.md` — Command patterns

### For fixing a bug:
1. `08-ENGINEERING-STATE.md` — How state is measured
2. The affected module's architecture document

### For adding tests:
1. `03-DESIGN-PRINCIPLES.md` — Principle #5 (Evidence Over Opinion)
2. `25-QUALITY-ATTRIBUTES.md` — Quality requirements

### For reviewing a PR:
1. `03-DESIGN-PRINCIPLES.md` — All principles
2. `27-ANTI-PATTERNS.md` — Check for anti-patterns
3. `28-VALIDATION-CHECKLIST.md` — Validation criteria

## The SÓ PROPÕE Principle

**The most important rule:** Shugo proposes. Humans decide.

When writing code for Shugo:
- Generate recommendations, never auto-apply
- Produce candidate rules, never auto-register
- Suggest optimizations, never auto-modify
- Output proposals, never execute them

## Code Conventions

### TypeScript
- ESM modules (`.js` extensions in imports)
- Strict mode enabled
- Interfaces over type aliases for object shapes
- camelCase for functions and variables
- PascalCase for types and interfaces
- UPPER_SNAKE_CASE for constants

### File Organization
- One module per file
- Types at the top
- Main function in the middle
- Helpers at the bottom
- Export at the end

### Error Handling
- Catch specific errors, not generic ones
- Log errors, don't swallow them
- Provide context in error messages
- Never crash the process

### Testing
- One test file per source file
- Describe blocks for each function
- It blocks for each behavior
- Use temp directories for filesystem tests
- Clean up in afterEach

## Common Mistakes to Avoid

1. **Don't modify governance files directly** — Use the scaffolder or upgrade command
2. **Don't hardcode paths** — Use `join()` and configuration
3. **Don't assume file existence** — Always check with `existsSync()`
4. **Don't use `any` type** — Use `unknown` and type guards
5. **Don't add comments** — Code should be self-documenting
6. **Don't create documentation unless asked** — Follow the plan

## Architecture Decision Records

When making a significant change:
1. Check if an ADR already exists for this decision
2. If not, create one using `docs/adrs/ADR-TEMPLATE.md`
3. Reference the ADR in your commit message
4. Update affected architecture documents

## Testing Requirements

Before submitting code:
1. `npx tsc --noEmit` passes
2. `npm test` passes (all 164+ tests)
3. No new TypeScript warnings
4. Test coverage for new code
5. Existing tests still pass
