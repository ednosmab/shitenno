# Shitenno — Documentation

> Knowledge organization for the Shugo governance system.

## Quick Start

| I want to... | Read |
|--------------|------|
| Understand why Shugo exists | [Philosophy](./handbook/philosophy/) |
| Learn the domain model | [Domain](./domain/) |
| See how it's built | [Architecture](./architecture/) |
| Understand implementation | [Implementation](./implementation/) |
| Know where it's heading | [Evolution](./evolution/) |
| Contribute to Shugo | [Engineering](./engineering/) |
| Find the active work tracker | [BACKLOG.md](./BACKLOG.md) |

## Documentation Structure

```
docs/
├── handbook/
│   ├── philosophy/    Why Shugo exists
│   ├── 01-fundamentals/  Getting started
│   ├── 02-commands/      CLI reference
│   └── 03-architecture/  Internal design
├── domain/          Business knowledge
├── architecture/    System design
├── implementation/  Technical plans
├── evolution/       Future roadmap
├── engineering/     Development process
├── adr/             Decision records [Planned]
├── reference/       Reference material [Planned]
└── history/         Archived documents [Planned]
```

## For AI Agents

Read only what you need:

| Task | Read |
|------|------|
| Implement a feature | Philosophy: principles.md + Architecture: the specific module |
| Fix a bug | Architecture: engineering-state-architecture.md + the affected module |
| Add a capability | Domain: capability-model.md + Architecture: capability-engine.md |
| Review a PR | Philosophy: principles.md + Architecture: anti-patterns.md |

## Master Index

For the complete documentation index, see [INDEX.md](./INDEX.md).

---

*Last updated: 2026-06-29*
