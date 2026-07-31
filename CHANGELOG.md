# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.8.0] — 2026-07-30

### Fixed

- **Notification: plan.archived payload mismatch** — `handlePlanArchived` checked `newStatus` but payload published `finalStatus`; now accepts both for backward compat
- **Notification: backlog done silent** — `shugo backlog done` published no event; now publishes `task.completed` to trigger desktop notification and daemon audit
- **Notification: health check missing** — No handler for `health.checked`; added `handleHealthChecked` that notifies on critical (<40) or recovered (>=80) scores
- **Notification: direct calls bypassing cooldown** — `plan.ts` and `reminders.ts` called `sendDesktopNotification` directly; replaced with `user.notification` event to respect global cooldown
- **Notification: duplicate audit runs** — `cmdDone` published both `task.completed` and `backlog.updated`, causing daemon audit to run twice; removed redundant `backlog.updated` publish
- **Notification: recursive event loop** — `backlog.updated` handler republished `backlog.updated` inside itself; removed recursive publish
- **Event bus: missing type** — Added `user.notification` to `ShitennoEventType` union and `EVENT_VERSIONS` registry

### Added

- **Notification: health monitoring** — Desktop notifications for health score changes (critical alert + recovery confirmation)
- **Notification: backlog sync** — Desktop notifications when daemon moves completed backlog items to done
- **Notification: user.notification event** — Dedicated event type for direct CLI notifications (bypasses `challenge.generated` rate-limiting)
- **E2E notification tests** — 17 end-to-end tests covering all notification scenarios: backlog done, daemon sync, health check, plan archived, user notification, cooldown, and event isolation

### Changed

- **Notification routing** — `plan.ts` and `reminders.ts` now use event bus (`user.notification`) instead of direct `sendDesktopNotification` calls
- **Daemon event handlers** — `subscribeTier2Events` no longer takes `runPeriodicAuditFn` parameter (audit only via `task.completed`)

## [1.2.0] — 2026-07-18

### Added

- **PUBLIC_API.md:** Formal documentation of public stable surface — CLI commands, MCP tools, schemas (`docs/PUBLIC_API.md`)
- **FRZ-01 rule:** Engine creation freeze rule in FORBIDDEN_OPERATIONS until Phase 2 of consolidation complete

### Changed

- **Architecture consolidation:** Merge 4 prioritization engines (goal, decision, recommendation, proactive) into `src/prioritization/` module
- **Engineering state consolidation:** Merge 8 engineering-state fragment files into `src/engineering-state/` directory (core, access, discovery, evolved, history, io, mutations, subscription)
- **Plan engine deprecation:** Remove legacy JSON plan-engine and 8 bare CLI commands (`plan create/execute/rollback/cancel/list/show/stats/delete`). Markdown plan engine is now the sole plan system

### Removed

- **plan-engine.ts:** Legacy JSON plan system (superseded by markdown-plan-engine)
- **plan CLI commands:** `plan create`, `plan execute`, `plan rollback`, `plan cancel`, `plan list`, `plan show`, `plan stats`, `plan delete` (use `plan md *` instead)
- **4 top-level engine files:** `goal-engine.ts`, `decision-engine.ts`, `recommendation-engine.ts`, `proactive-engine.ts` (moved to `src/prioritization/`)
- **7 engineering-state fragments:** `-access`, `-discovery`, `-evolved`, `-history`, `-io`, `-mutations`, `-subscription` (moved to `src/engineering-state/`)

## [1.1.0] — 2026-07-18

### Added

- **Rule manifest + positional injection:** Governance rule manifest with positional injection and F-06 enforcement (`e4e0e78`)
- **Decision core unification:** Unified execution core across 4 engines (planner, executor, reviewer, orchestrator) (`8523427`)
- **Knowledge bridge:** ADR/skill runtime access via MCP + governance briefing (`855585d`)
- **System resilience:** Complete resilience plans including log rotation and daemon CLI integration (`25ca494`)
- **Audit engine hardening:** Detector isolation, AST complexity analysis, confidence calibration (`ba03da5`)
- **Audit edge features:** Verified autofix, incremental scan, health card (`ad9d711`)
- **Event-driven architecture gaps:** Integration of missing event-driven patterns (`f278b0b`)
- **Markdown plan engine:** YAML frontmatter support with legacy fallback (`2af6591`)
- **Daemon optimization:** Audit intervals optimized with event-driven triggers (`62d772e`)
- **Context mechanism P0-P4:** Context index builder, tier detectors, buffer checkpoints (`3e5cb2d`)
- **Daemon proactive scan:** Startup scan and adaptive periodic audit (`eaa7b29`)
- **Daemon CLI expansion:** IPC queries and PT help text (`e2ba213`)

### Changed

- **Rebranding completo:** shitenno-go → shitenno across entire codebase (`fa1b5e0`)
- **Structural refactoring:** SA4/SA10/SA11 completed — file size limits enforced, monolithic scripts split (`92da896`, `7c73fb5`)
- **CI/CD:** Upgraded actions/checkout and actions/setup-node to v7.0.0 (`614ca75`)

### Fixed

- **Test failures:** Resolve 4 pre-existing test failures and cleanup stale governance files (`28adeec`)
- **Security:** Consolidate safeJsonParse into validation.ts (`6e5a3fc`)
- **Security:** Remediate security findings per PLAN-2026-07-16 (`bcf0c22`)
- **Lint:** Suppress no-restricted-imports for daemon log viewer (`2f740ab`)
- **Audit bugs:** Resolve 7 bugs in file scanning and reporting infrastructure (`5cf35d3`)
- **Audit security:** Apply Phase 1-4 security and governance fixes (`edf2eeb`)
- **Logger pollution:** Redirect logger.info/debug to stderr to prevent JSON stdout pollution (`de39dee`)

### Tests

- **Audit regression:** Add regression tests for collectSourceFiles Bug #1-4 fixes (`9f2f3b9`)

### Documentation

- **Knowledge bridge:** Mark knowledge-bridge plan as Done in BACKLOG (`4f15616`)
- **Project assessment:** Revise project assessment with event-driven architecture understanding (`6c90157`, `e59d388`)
- **Honest assessment:** Add honest project assessment report + archive completed plans (`896d980`)

### Removed

- **Watch command:** Remove watch command and file-watcher (superseded by daemon daemon-aware banner) (`dcced33`)

## [1.0.0] — 2026-07-15

### Added

- **Rebranding completo:** nexus-system → shitenno (package name, binary, docs, templates, all references)
- **Structural refactoring:** Split 10+ god modules into domain modules (rule-engine, knowledge-debt, maturity-profile, capability-engine, health-auditor, mcp-server, knowledge-graph, doc-lifecycle-auditor, feedback-engine, engineering-state)
- **Domain layer:** New `src/domain/` with entities, rules, and scoring modules (Clean Architecture)
- **Semantic drift detector:** Keywords + AST-based documentation drift detection with golden tests
- **Doc semantic sync:** Bridge between semantic-drift-detector and context_buffer.yaml
- **Git hooks installer:** Auto-install post-commit and post-merge hooks
- **Plan backlog sync:** Cooldown and lock mechanisms for concurrent syncs
- **Session context:** Session tracker with state machine transitions
- **CLI global flags:** `--quiet`, `--no-color`, `--compact` for terminal output control

### Changed

- **Architecture:** 99 flat files restructured into domain/infrastructure/commands/layers
- **Test suite:** Expanded to 2000+ tests across 80+ files with full coverage
- **Audit detectors:** Expanded to 180+ enterprise-level security, supply chain, and configuration analysis
- **CLI commands:** 38 total commands with centralized output helpers
- **Documentation:** Massive rename across all docs, updated all references to shitenno
- **CI/CD:** Updated to Node.js 22, fixed corepack enable ordering for pnpm
- **Governance:** Moved plans to `governance/plans/`, new pipeline templates, agent contracts

### Fixed

- Rebrand nexus-system → shitenno across entire codebase
- Semantic drift detector — FP filter, scanner fix, golden set tests
- Handbook TUI path resolution + text wrap + docs sync
- Daemon script path resolution via relative path
- Watch infinite loop — excluded reports/ from watcher, added plan-backlog cooldown
- Race condition in retroactive scan — added lock + cooldown mechanism
- CI failures — Node.js 20 deprecated, pnpm not found in PATH
- Hand scroll bleed in handbook TUI

## [0.8.0] — 2026-07-13

### Added

- **Event-driven architecture:** Central event bus with 40+ event types and reactive subscribers
- **Daemon system:** Background process with IPC socket, circuit breaker, and auto-recovery
- **File watcher:** Chokidar-based governance artifact monitoring with significance detection
- **Plan lifecycle:** Auto-archive done plans, backlog sync, format validation, animated progress
- **Handbook TUI:** Interactive terminal UI with keyboard/mouse navigation, 3-level content hierarchy
- **Feedback engine:** Session feedback with user ratings, comments, tags, and summary computation
- **Knowledge graph + capability engine:** Dynamic capability unlocking and dependency tracking
- **Task pipeline:** Automated task completion with validation gates and state machine
- **Engineering state:** Reactive state management with snapshots, history, and mutations
- **MCP server:** Model Context Protocol tools (getBriefing, getRiskMap, getRules)
- **20+ new CLI commands:** `watch`, `daemon`, `hooks`, `events`, `context`, `reminders`, `history`, `handbook`, `mcp`, `plan`, `act`, `decide`, `policy`, `console`, `digest`, `bench`, `briefing`, `feedback`, `profile`, `dashboard`, `docs-audit`
- **180+ audit detectors:** Enterprise-level security, supply chain, and configuration analysis
- **Global flags:** `--quiet`, `--no-color`, `--compact` for terminal output control
- **2000+ tests** across 80+ files with full coverage
- **Daemon path resolution fix:** Correctly resolves daemon script in both dev and bundled modes
- **CI/CD fix:** Updated to Node.js 22, fixed corepack enable ordering for pnpm

### Changed

- Expanded test suite from 1045 to 2000+ tests
- Updated all CLI commands to use centralized output helpers
- Migrated from console.log to structured logging across codebase
- Moved governance plans to `governance/plans/` directory

### Fixed

- `shugo watch` command not found — corrected bin path in package.json
- `shugo daemon start` — daemon script path resolution via relative path
- Version read path in bundled output — uses package root discovery
- CI failures — Node.js 20 deprecated, pnpm not found in PATH
- Watch infinite loop — excluded reports/ from watcher, added plan-backlog cooldown
- Race condition in retroactive scan — added lock + cooldown mechanism
- Hand scroll bleed in handbook TUI

## [0.2.0] — 2026-07-04

### Added

- **Audit levels:** `--level quick|full` for granular audit depth control
- **33 audit detectors:** Expanded from basic checks to comprehensive governance analysis
- **Taint analysis:** Track data flow through governance rules and detect contamination
- **13 new CLI commands:** `act`, `plan`, `goal`, `decide`, `policy`, `console`, `digest`, `bench`, `briefing`, `feedback`, `profile`, `dashboard`, `shell-init`
- **`shugo docs-audit`:** Validate documentation synchronization with codebase
- **Dashboard command:** Visual governance overview with real-time metrics
- **Shell integration:** Auto-completion setup for bash/zsh/fish

### Changed

- Expanded test suite from 484 to 1045+ tests across 63 files
- Updated all documentation to reflect 26 CLI commands
- Improved audit coverage from 79% to 93%

### Fixed

- Documentation sync issues across 6 critical files
- Broken reference to `Requisitos_plataforma.md` in AGENTS.md
- Incorrect test and command counts in README

## [0.1.0] — 2026-06-26

### Added

- **CLI commands:** `init`, `status`, `detect`, `audit`, `upgrade`, `validate`, `sync`, `clean`
- **Scoring engine** (`scorer.ts`):
  - Static metrics: packages, apps, files, dependencies, monorepo
  - Behavioral metrics: validate failures, ADRs, branches, commits/week, sessions, bug fixes, agents, skills
  - Per-area scoring with churn, violations, sensitive surface, dependency depth, incident-free age, context pressure
  - Report writer: JSON reports saved to `shitenno/reports/`
- **Pattern detector** (`pattern-detector.ts`):
  - Recurring error detection (3+ occurrences in same area)
  - Reverted decision detection (rollback patterns)
  - Hot area detection (consistently high scores across reports)
  - Candidate rule proposals (FORBIDDEN_OPERATIONS / AGENTS.md)
- **Health auditor** (`health-auditor.ts`):
  - Dead rule detection (never mentioned in history)
  - Violation hotspot detection (50%+ violation rate)
  - Missing docs detection (critical files)
  - Orphan directory detection
  - Stale buffer detection
  - Governance optimization proposals
- **Project analyzer** (`analyser.ts`):
  - Stack detection (React, Next.js, Vue, Svelte, Angular, etc.)
  - Package manager detection (pnpm, yarn, npm)
  - Monorepo detection
  - Source file counting
  - CI/linter/test detection
- **Scaffolder** (`scaffolder.ts`):
  - Three-tier governance levels (Junior / Pleno / Senior)
  - 21 engineering skills
  - Template customization with project-specific placeholders
  - Area auto-detection
- **Disk cache** (`cache.ts`):
  - SHA256 checksums for key files (.git/HEAD, package.json, opencode.json, shitenno-profile/, shitenno/)
  - Cache invalidation on init/upgrade/sync
  - `--no-cache` flag on status/detect/audit commands
  - Cache hit: <1ms vs 15-106ms without cache
- **Performance optimizations:**
  - Batch git log (single call for all areas)
  - Parallel area scoring (Promise.all + setImmediate)
  - Shared FileContentCache for keyword scanning
  - Pre-read history (single pass for all areas)
  - Benchmarks: Large project 223ms → 106ms (-52%)
- **Interactive prompts** (`prompts.ts`): AI model selection, stack, database, styling, team level
- **Test suite:** 105 unit tests + 24 CLI integration tests
- **CLI integration tests** (`cli-integration.test.ts`): End-to-end tests for all commands
- **Performance benchmarks** (`benchmarks.bench.ts`): Scaling tests for all engines
- **`--json` flag** on all commands (`status`, `detect`, `audit`, `validate`, `sync`, `upgrade --list`, `clean`): Structured JSON output for CI/scripting
- **Health bar visualization** (`formatting.ts`): ASCII progress bars for complexity scores and health scores
- **`shugo clean` command**: Explicitly clear cache and temporary files
- **GitHub Actions CI** (`.github/workflows/ci.yml`): Typecheck + build + test on Node 18/20/22
- **GitHub Actions Release** (`.github/workflows/release.yml`): Automated npm publish on git tags
- **Formatting utilities** (`formatting.ts`): `healthBar`, `miniBar`, `outputJson`, `statusIcon` — shared across all commands
- **Unit tests for formatting** (`formatting.test.ts`): 18 tests covering healthBar, miniBar, outputJson, statusIcon
- **README.md**: Full project documentation with architecture, commands, development guide
- **CHANGELOG.md**: Version history with all features documented
- **`.npmignore`**: Clean npm publish configuration
- **`vitest.config.ts`**: Test configuration with coverage and excluded benchmarks
- **`package.json`**: Added `exports` field, `bench`/`lint`/`clean` scripts

### Fixed

- Batch git log index alignment bug (shortAreas vs otherAreas)
- Cache indentation bug in `invalidateCache` else branch
- Unused `countSourceFilesInDir` import removal
- Dead comment cleanup in scorer.ts
- Version consistency: reads from `package.json` instead of hardcoded string
- Removed unused `fseReadFileSync` import from sync.ts
- Removed unused `coloredScore` export from formatting.ts
