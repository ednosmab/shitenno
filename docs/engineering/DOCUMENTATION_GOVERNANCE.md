---
category: engineering
lifecycle: Active
---

# Documentation Governance

> Official governance rules for all documentation maintained by the Shugo project.

## Documentation Principles

1. Documentation is a first-class deliverable.
2. Every architectural change updates documentation.
3. Documentation evolves incrementally.
4. Avoid duplicated knowledge.
5. Prefer a single canonical source.
6. Documentation must be navigable to be useful.
7. Documentation without an audience is documentation without a purpose.

## Documentation Domains

| Domain | Purpose |
|--------|---------|
| architecture | System design |
| domain | Business knowledge |
| implementation | Technical implementation |
| engineering | Development process |
| evolution | Future roadmap |
| philosophy | Engineering principles |
| adr | Architecture Decision Records |
| reference | Reference material |
| product | Scaffolded template docs |

## Documentation Lifecycle

| State | Description |
|-------|-------------|
| Draft | Under development, not yet authoritative |
| Active | Current and maintained |
| Deprecated | Superseded by another document |
| Historical | No longer current, preserved for archival |
| Archived | Frozen, not maintained |

## Canonical Sources

| Subject | Canonical Document |
|---------|-------------------|
| Project identity ("what is Shitenno") | docs/domain/identity.md |
| Problem it solves | docs/domain/problem-statement.md |
| Domain glossary | docs/domain/ubiquitous-language.md |
| Engineering principles | docs/handbook/philosophy/principles.md |
| Module validation | docs/architecture/validation-matrix.md |
| Active work | shitenno/docs/backlog/ACTIVE.md |

## Quality Gates

Documentation changes shall not be merged unless:

- [ ] Navigation is valid (README exists, links resolve)
- [x] References are valid (no broken links) — enforced via `sync:docs` + `check-broken-refs`
- [x] Document category is defined — enforced via `sync:docs` + `check-docs-frontmatter`
- [x] Lifecycle is declared — enforced via `sync:docs` + `check-docs-frontmatter`
- [ ] Duplicated content is avoided
- [ ] Language is consistent (English)

> Gates 2–4 are automated in the pre-commit hook (`sync:docs`). Run `pnpm run sync:docs:fix` to auto-fix.

## Language Policy

- **Canonical language:** English
- **Legacy content:** Portuguese remains valid until modified
- **Code:** Always English

---

*Last updated: 2026-07-22*
