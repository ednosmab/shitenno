---
category: engineering
lifecycle: Active
---

# Engineering Standards

> Single source of truth for code quality rules. Referenced by AGENTS.md, DESDO.md, and MANDATORY_CONTEXT.md.
> **Read-only** — no auto-generator writes to this file.

---

## 1. Code Quality

- **Legibility > Conciseness** — declarative, simple, self-explanatory code
- **DRY** — no repeated logic across 3+ locations
- **KISS** — prefer simple solutions over premature abstractions
- **Early Return** — avoid nested if/else; return as early as possible

## 2. SOLID

- **S** — Single Responsibility: one reason to change per function/class
- **O** — Open/Closed: open for extension, closed for modification
- **L** — Liskov Substitution: subclasses substitutable without breaking
- **I** — Interface Segregation: small, specific interfaces
- **D** — Dependency Inversion: depend on abstractions, not implementations

## 3. TDD — Test-Driven Development

### Cycle: Red → Green → Refactor
1. **RED** — Write a failing test
2. **GREEN** — Implement minimum to pass
3. **REFACTOR** — Clean without changing behavior

### Test Pyramid
- **Unit** — Many, fast, business logic
- **Integration** — Medium, cross-service flows
- **E2E** — Few, slow, critical paths

## 4. Size Limits

| Limit | Value | ESLint Rule | Exceptions |
|-------|-------|-------------|------------|
| File | 300 lines | max-lines-per-file | `__tests__/`, `src/templates/` |
| Function | 50 lines | max-lines-per-function | — |
| Depth | 4 levels | max-depth | — |
| Params | 4 per function | max-params | — |
| Complexity | 15 | complexity | — |

> Ref: ADR-007 (`docs/adrs/ADR-007-file-size-limits.md`)

## 5. Security

1. Sanitize all dynamic input
2. Never `dangerouslySetInnerHTML` without sanitization
3. Validate all data at entry (Zod, Yup, etc.)
4. RLS on all tables (if applicable)
5. Sanitize output (prevent XSS)

## 6. Documentation

- **JSDoc** mandatory on all exported functions
- **ADRs** for architectural decisions (`docs/adrs/`)
- **Commit messages** in English, Conventional Commits (`feat:`, `fix:`, `chore:`)

## 7. Performance

- No premature optimization
- Measure first with profiling tools
- Define metrics before optimizing
