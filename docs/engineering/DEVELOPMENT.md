---
category: engineering
lifecycle: Active
---

# Development Guide

> Setting up and working on the Shugo CLI development environment.

## Prerequisites

- Node.js >= 18
- pnpm >= 8
- Git

## Setup

```bash
# Clone the repository
git clone https://github.com/shitenno-cli/shitenno-cli.git
cd shitenno-cli

# Install dependencies
pnpm install

# Verify setup
pnpm test
pnpm typecheck
pnpm lint
```

## Project Structure

```
shitenno-cli/
├── src/
│   ├── commands/          # 13 CLI commands
│   │   ├── init.ts        # Project initialization
│   │   ├── status.ts      # Health check + scoring
│   │   ├── detect.ts      # Pattern detection
│   │   ├── audit.ts       # Governance audit
│   │   ├── evolve.ts      # Evolution recommendations
│   │   ├── run.ts         # Full pipeline execution
│   │   ├── upgrade.ts     # Capability installation
│   │   ├── validate.ts    # Validation checks
│   │   ├── sync.ts        # Knowledge synchronization
│   │   ├── assess.ts      # Maturity assessment
│   │   ├── clean.ts       # Cache cleanup
│   │   ├── doctor.ts      # System diagnostics
│   │   └── report.ts      # Report generation
│   ├── __tests__/         # Test suite (484 tests)
│   └── templates/         # Scaffold templates
├── docs/                  # Documentation
├── shitenno/          # Shugo system (governance, plugins, profile)
└── package.json
```

## Key Modules

| Module | Lines | Purpose |
|--------|-------|---------|
| `engineering-state.ts` | 712 | State consolidation |
| `capability-engine.ts` | 542 | Capability installation |
| `scorer.ts` | 936 | Complexity scoring |
| `knowledge-graph.ts` | ~300 | Artifact graph |
| `event-bus.ts` | ~200 | Pub/sub communication |

## Development Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start development mode |
| `pnpm build` | Build for distribution |
| `pnpm test` | Run test suite |
| `pnpm typecheck` | Type-check codebase |
| `pnpm lint` | Run ESLint |
| `pnpm bench` | Run benchmarks |

## Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test -- src/__tests__/scorer.test.ts

# Run with coverage
pnpm test -- --coverage
```

## Debugging

1. Use `pnpm dev` for development mode
2. Check `docs/architecture/` for module documentation
3. Use the event bus history for debugging event flows

---

*Last updated: 2026-06-29*
