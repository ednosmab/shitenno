---
category: engineering
lifecycle: Active
---

# Workflow

> Development workflow for Shugo CLI contributors.

## Branch Strategy

```
main          ← production releases
  └── develop ← integration branch
       ├── feat/*   ← features
       ├── fix/*    ← bug fixes
       └── docs/*   ← documentation
```

## Workflow Steps

### 1. Pick a Task

- Check [BACKLOG.md](../BACKLOG.md) for active work
- Check [Task Catalog](../evolution/ai/TASK-CATALOG.md) for evolution tasks
- Assign yourself or create an issue

### 2. Create a Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feat/my-feature
```

### 3. Implement

- Write code following coding standards
- Write tests for new functionality
- Update documentation as needed
- Run checks frequently:

```bash
pnpm test
pnpm typecheck
pnpm lint
```

### 4. Commit

Use conventional commits:

```bash
git add .
git commit -m "feat: add new capability detection"
```

### 5. Push and Create PR

```bash
git push origin feat/my-feature
```

Create a PR targeting `develop` with:
- Clear description of changes
- Reference to related issue
- Test results

### 6. Code Review

- At least one approval required
- Address all review comments
- Ensure CI passes

### 7. Merge

- Squash merge to `develop`
- Delete feature branch

### 8. Release

- Merge `develop` to `main`
- Tag with version: `git tag v0.2.0`
- CI publishes to npm

---

*Last updated: 2026-06-29*
