---
category: engineering
lifecycle: Active
---

# Release Process

> How releases are managed for the Shugo CLI.

## Version Numbering

Follow Semantic Versioning (semver):

```
MAJOR.MINOR.PATCH

MAJOR — Breaking changes
MINOR — New features (backward compatible)
PATCH — Bug fixes (backward compatible)
```

## Release Checklist

### Pre-Release

- [ ] All tests pass
- [ ] Type-check passes
- [ ] Lint passes
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json

### Release

- [ ] Create release branch: `git checkout -b release/v0.2.0`
- [ ] Final test run
- [ ] Commit: `git commit -m "chore: release v0.2.0"`
- [ ] Merge to main: `git merge main`
- [ ] Tag: `git tag v0.2.0`
- [ ] Push: `git push origin main --tags`
- [ ] CI publishes to npm

### Post-Release

- [ ] Verify npm package: `npm view shitenno-cli`
- [ ] Test installation: `npm install -g shitenno-cli`
- [ ] Update GitHub release notes
- [ ] Merge back to develop

## Hotfix Process

1. Create hotfix branch from main: `git checkout -b hotfix/fix-critical-bug`
2. Fix the issue
3. Add regression test
4. Update CHANGELOG.md
5. Merge to main and develop
6. Tag: `git tag v0.2.1`

## Rollback

If a release has critical issues:

1. Revert the commit on main
2. Tag the revert: `git tag v0.2.1`
3. Publish hotfix if needed
4. Document in CHANGELOG.md

---

*Last updated: 2026-06-29*
