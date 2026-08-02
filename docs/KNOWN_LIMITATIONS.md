---
category: product
lifecycle: Active
---

# Known Limitations — Shitenno

> Documented limitations and known workarounds for the Shugo CLI.

---

## Cache

### Race condition in briefing cache
- **Impact:** Low (last-writer-wins)
- **Description:** Multiple concurrent `shugo briefing` calls can overwrite each other's cache. The `writeCache()` uses atomic writes (tmp + rename), so data corruption is impossible, but a stale cache may be served briefly.
- **Workaround:** Wait for the first briefing call to complete before starting another. In practice, this is a non-issue because the CLI is used interactively (one session at a time).

### Cache invalidation is coarse-grained
- **Impact:** Low
- **Description:** The snapshot cache invalidates when git HEAD changes or any file in `shitenno/` is modified. This means unrelated changes can trigger a full recomputation.
- **Workaround:** None needed — recomputation is fast (< 100ms for most projects).

---

## Git

### Projects without Git
- **Impact:** Medium
- **Description:** Several features depend on `git` being available: fingerprint hashing (uses `git rev-parse HEAD`), risk map (uses `git log`), and some audit detectors.
- **Workaround:** Run `git init` before using Shugo. For projects that intentionally avoid Git, the CLI still functions but with degraded accuracy in risk detection and fingerprint staleness checks.

### Monorepo support is partial
- **Impact:** Medium
- **Description:** Shugo treats the project root as a single package. In monorepos with workspaces (pnpm, yarn), it may detect packages from multiple workspaces or miss package-specific context.
- **Workaround:** Run `shugo init` in the specific workspace directory you want to govern, not at the monorepo root.

---

## File System

### Large projects (> 1000 files)
- **Impact:** Low-Medium
- **Description:** The analyser scans all files under `src/` to detect the technology stack. For very large projects, this can take a few seconds on first run.
- **Workaround:** The fingerprint cache (`shitenno/fingerprint.json`) ensures this only happens once. Subsequent runs use the cached fingerprint.

### symlinks not followed
- **Impact:** Low
- **Description:** The analyser does not follow symbolic links. If project files are symlinked from external directories, they will be invisible to Shugo.
- **Workaround:** Avoid symlinking source files. If unavoidable, copy the files instead.

---

## CLI

### Commander state persistence (SA17)
- **Impact:** Low
- **Description:** Commander.js singleton retains `_optionValues` between `.parse()` calls. This can cause stale options in tests or when using Shugo as a library.
- **Workaround:** For programmatic use, create fresh Commander instances. The CLI itself is unaffected because it runs as a standalone process.

### `--json` mode excludes some commands
- **Impact:** Low
- **Description:** Not all commands support `--json` output. Commands like `shugo evolve` and `shugo run` always produce human-readable output.
- **Workaround:** Check `shugo <command> --help` for `--json` support.

---

## Dashboard

### Terminal size sensitivity
- **Impact:** Medium
- **Description:** The interactive dashboard (TUI) is designed for terminals ≥ 80 columns wide. In narrower terminals, the layout may overflow or truncate.
- **Workaround:** Maximize the terminal window, or use `shugo dashboard --json` for machine-readable output.

### Ink/React dependency
- **Impact:** Low
- **Description:** The TUI dashboard requires `ink` and `react` as runtime dependencies. This adds ~2MB to `node_modules`. The JSON mode (`--json`) does not load these dependencies.
- **Workaround:** None — this is a trade-off for the interactive experience.

---

## Event Bus

### 10 of 34 declared events are never published
- **Impact:** Low
- **Description:** The event bus declares 34 event types, but only 24 are actually published. The unpublished events (including `knowledge_debt.detected`) are dead declarations from the original architecture.
- **Workaround:** None needed. The rule engine gracefully handles events that are never emitted.

### In-memory only (no persistence in dev)
- **Impact:** Low
- **Description:** Event history is kept in memory during a session. `shugo audit` can enable disk persistence, but by default events are lost when the process exits.
- **Workaround:** Run `shugo audit` to persist events to `shitenno/docs/history/`.

---

## Testing

### Test-after, not TDD
- **Impact:** Process
- **Description:** All 1200+ tests were written after the implementation. While coverage is high (~82% functions), there are no tests that were written before the code they test.
- **Workaround:** Adopt TDD workflow for new features going forward.

### Console output testing
- **Impact:** Low
- **Description:** Commands that produce CLI output (banner, status display) are tested indirectly via integration tests. Direct assertion on console output format is limited.
- **Workaround:** Use `shugo <command> --json` for deterministic, testable output.

---

*Last updated: 2026-07-08*
