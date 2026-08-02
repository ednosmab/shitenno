---
category: engineering
lifecycle: Active
---

# Contributing to Shugo CLI

> How to contribute to the Shitenno.

## Prerequisites

- Node.js >= 18
- pnpm >= 8
- Git

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `pnpm install`
4. Create a branch: `git checkout -b feat/my-feature`

## Development Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start development mode |
| `pnpm build` | Build the project |
| `pnpm test` | Run tests |
| `pnpm typecheck` | Type-check the codebase |
| `pnpm lint` | Run ESLint |

## Code Style

- **Language:** English for all code, variable names, and comments
- **TypeScript:** Strict mode enabled
- **Formatting:** Prettier (configured in project)
- **Linting:** ESLint flat config (v10)

## Commit Messages

Follow conventional commits:

```
feat: add new capability detection
fix: resolve lifecycle gate inconsistency
docs: update architecture documentation
refactor: extract shared command infrastructure
test: add tests for knowledge graph
```

## Pull Request Process

1. Ensure all tests pass: `pnpm test`
2. Ensure type-check passes: `pnpm typecheck`
3. Ensure lint passes: `pnpm lint`
4. Update documentation if needed
5. Submit PR with clear description
6. Wait for review approval

## Architecture Guidelines

- Follow the 10 design principles in `docs/architecture/design-principles.md`
- Never add domain logic to CLI commands
- Use the event bus for inter-module communication
- Write tests for all new functionality
- Document architectural decisions as ADRs

## Reporting Issues

Use GitHub Issues with the appropriate template:

- **Bug:** Steps to reproduce, expected vs actual behavior
- **Feature:** Use case, expected behavior, alternatives considered
- **Documentation:** What's missing or unclear

---

*Last updated: 2026-06-29*
