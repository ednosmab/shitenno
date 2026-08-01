---
category: engineering
lifecycle: Active
---

# AI Agent Rules

> Rules for AI agents working on the Shitenno CLI codebase.

## Session State (mandatory, start of every session)

Before any operational response, call the MCP tool `shitenno_getBriefing`
with `{"format":"markdown","depth":"minimal"}` and display the "Quick Board"
section from the response. Do NOT read files inside `.shitenno/` directly — session
state (buffer, mandatory rules/skills, active backlog) always comes from
`shitenno_*` tools, never from file reads.

## Repository Structure

```
shitenno-cli/
├── src/              # Source code
│   ├── commands/     # CLI commands (13 commands)
│   ├── __tests__/    # Test suite
│   └── templates/    # Scaffold templates
├── docs/             # Documentation
├── plans/            # Historical plans (archived)
└── package.json
```

## Code Rules

1. **English only** — All code, variable names, comments, and commit messages in English
2. **No `any` types** — Use proper TypeScript types
3. **No `console.log`** — Use the centralized logger
4. **No domain logic in CLI** — Commands delegate to modules
5. **TDD required** — Write tests before implementation (RED-GREEN-REFACTOR)

## Git Rules

1. **Never commit without authorization** — Ask user to test locally first
2. **Short commits in English** — Follow Conventional Commits spec
3. **Post-commit integrity** — After commit: `pnpm run lint`, `pnpm ls <core-deps>`, `pnpm run test`

## Skills via MCP (mandatory)

Project skills are in `.shitenno/docs/skills/` and are accessed EXCLUSIVELY via MCP shitenno.
Load skills with `shitenno_getSkills(name="<name>")` or `shitenno_getSkills(task="<type>")`.
The opencode `skill` tool does NOT recognise these skills. VIOLATION = invalid session.

## Documentation Rules

1. **Follow governance** — Read `docs/engineering/DOCUMENTATION_GOVERNANCE.md`
2. **Update docs with code** — Documentation evolves with implementation
3. **Use canonical sources** — Don't duplicate, reference
4. **Declare lifecycle** — Every document must have a status

## Architecture Rules

1. **Follow design principles** — Read `docs/architecture/design-principles.md`
2. **Respect invariants** — Domain doesn't depend on infrastructure
3. **Use event bus** — For inter-module communication
4. **Create ADRs** — For architectural decisions

## Context Loading

| Task Type | Load |
|-----------|------|
| Bug fix | Architecture: affected module + design-principles.md |
| Feature | Philosophy: principles.md + Architecture: affected module |
| Refactor | Architecture: command-architecture.md + affected module |
| Documentation | INDEX.md + affected area README |

## Forbidden Operations

- Never commit without authorization
- Never modify tests to make them pass
- Never bypass type-check or lint
- Never add `// @ts-ignore` without justification
- Never commit secrets or keys

## MCP Tools (mandatory)

- The `.shitenno` directory is **hidden**. To access files in `.shitenno/` (plans, governance, rules, skills), ALWAYS use the MCP `shitenno` (`getPlans`, `getRules`, `getSkills`, `getBacklog`, etc.) — NEVER `local-filesystem`. VIOLATION = invalid session.
- Project skills are in `.shitenno/docs/skills/` and are accessed EXCLUSIVELY via MCP shitenno. Load via `shitenno_getSkills(name="<name>")` or `shitenno_getSkills(task="<type>")`. The opencode `skill` tool does NOT recognise these skills. VIOLATION = invalid session.

## Session Blockers

1. **Session Invariant:** No session may be declared "completed" without first running `pnpm run close:session`, pruning the buffer (≤ 50 active lines), updating the backlog, and confirming tests pass.
2. **Quick Board Enforcement:** NO response may be sent to the user WITHOUT first displaying the Quick Board. On ANY message (including "hi", "hello", etc.), the agent MUST: (a) call `shitenno_getBriefing`, (b) display the Quick Board section, (c) only then process the message. VIOLATION = INVALID SESSION.

---

*Last updated: 2026-08-01*
