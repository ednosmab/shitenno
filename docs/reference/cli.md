---
category: reference
lifecycle: Active
---

# CLI Reference

> Complete reference for all Shugo CLI commands.

## Global Options

| Option | Description |
|--------|-------------|
| `-d, --dir <path>` | Project directory (default: current directory) |
| `--json` | Output as JSON (where supported) |
| `--help` | Show help |
| `--version` | Show version |

## Commands

### shugo init

Initialize Shugo in a project.

```bash
shugo init [--dir <path>] [--answers-file <path>] [--force]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--answers-file <path>` | JSON file with pre-filled answers (skips interactive prompts) |
| `--force` | Force creation even inside shitenno-cli directory |

**What it does:**
- Analyzes project structure (stack, packages, apps, TypeScript, tests, CI)
- Runs interactive questionnaire to assess maturity (or loads from `--answers-file`)
- Calculates maturity profile across 7 dimensions
- Scaffolds governance structure: `shitenno/`, `opencode.json`, `shitenno/profile/`
- Installs core capability + recommended capabilities based on maturity

**Exit codes:** 0 (success), 1 (error)

---

### shugo status

Health check, complexity scoring, and maturity overview.

```bash
shugo status [--dir <path>] [--json] [--no-cache]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--no-cache` | Skip cache and recalculate |

**What it does:**
- Runs 7 health checks (opencode.json, AGENTS.md, skills, governance, context buffer, scripts, agent contracts)
- Calculates complexity score with per-area breakdown
- Displays maturity profile with dimension bars
- Detects installed capabilities
- Generates complexity report in `reports/`

**Exit codes:** 0 (success), 1 (error)

---

### shugo detect

Detect patterns from project history and session logs.

```bash
shugo detect [--dir <path>] [--json] [--no-cache]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--no-cache` | Skip cache and recalculate |

**What it does:**
- Analyzes session history for recurring errors and reverted decisions
- Detects hot areas (consistently high complexity)
- Generates candidate rules (requires Tech Lead approval)
- Writes pattern report to `reports/`

**Exit codes:** 0 (success), 1 (error)

---

### shugo audit

Audit governance health and knowledge graph.

```bash
shugo audit [--dir <path>] [--json] [--no-cache]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--no-cache` | Skip cache and recalculate |

**What it does:**
- Detects dead rules, violation hotspots, missing docs, orphan directories, stale buffers
- Analyzes knowledge graph (artifacts, relations, orphans, hubs)
- Runs custom check hooks from plugins
- Generates health report with governance optimization proposals

**Exit codes:** 0 (success), 1 (error)

---

### shugo evolve

Show evolution recommendations with dual paths.

```bash
shugo evolve [--dir <path>] [--json] [--accept <id>] [--reject <id>] [--reason <text>] [--comfortable] [--challenging]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--accept <id>` | Accept a recommendation (record feedback) |
| `--reject <id>` | Reject a recommendation (record feedback) |
| `--reason <text>` | Reason for accept/reject |
| `--comfortable` | Choose the comfortable path (within current thinking) |
| `--challenging` | Choose the challenging path (beyond current thinking) |

**What it does:**
- Generates recommendations across 4 categories: capability, knowledge, governance, automation
- Shows dual paths for each recommendation (comfortable vs challenging)
- Integrates growth profile for challenge calibration
- Records feedback and adjusts confidence based on history
- Suppresses recommendations rejected 5+ times

**Exit codes:** 0 (success), 1 (error)

---

### shugo run

Execute the full 5-stage analysis pipeline.

```bash
shugo run [--dir <path>] [--json]
```

**Stages:**

| # | Stage | What it does |
|---|-------|-------------|
| 1 | `analyze` | Analyze project structure |
| 2 | `score` | Calculate complexity score |
| 3 | `detect` | Detect patterns in history |
| 4 | `audit` | Audit governance health |
| 5 | `evolve` | Generate evolution recommendations (conditional) |

**Exit codes:** 0 (success), 1 (error)

---

### shugo upgrade

Install or upgrade governance capabilities.

```bash
shugo upgrade [--dir <path>] [--capability <name>] [--list] [--accept-recommended] [--json]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--capability <cap>` | Capability to add (`knowledge`, `architecture`, `governance`, `ai`, `quality`, `metrics`, `operations`, `compliance`) |
| `--list` | List all capabilities and their status |
| `--accept-recommended` | Install all recommended capabilities from maturity profile |

**What it does:**
- Detects currently installed capabilities
- Resolves dependencies between capabilities
- Copies template files from `templates/base/`
- Publishes `capability.installed` event
- If no `--capability` specified, launches interactive selection

**Exit codes:** 0 (success), 1 (error)

---

### shugo validate

Validate configuration files and session state.

```bash
shugo validate [--dir <path>] [--json] [--fix]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--fix` | Attempt to fix issues automatically |

**What it does:**
- Validates context buffer, ADR directory, opencode.json consistency
- Checks agent contracts validity (plan, build, review roles required)
- Verifies session status and git status
- If `--fix`: creates default opencode.json and context_buffer.yaml

**Exit codes:** 0 (success), 1 (error)

---

### shugo sync

Synchronize files from a local shitenno directory.

```bash
shugo sync [--dir <path>] --shitenno-path <path> [--dry-run] [--force] [--json]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--shitenno-path <path>` | Path to source shitenno directory (or `SHITENNO_GO_PATH` env) |
| `--dry-run` | Show what would be changed without making changes |
| `--force` | Overwrite all files without asking |

**What it does:**
- Copies files from source shitenno to target project
- Preserves project-specific customizations during merge
- Supports JSON merge for opencode.json (preserves agent models/permissions)
- Supports Markdown section merge for AGENTS.md, opencode-context.md, Shitenno_GUIDE.md

**Exit codes:** 0 (success), 1 (error)

---

### shugo assess

Re-evaluate maturity profile and show deltas.

```bash
shugo assess [--dir <path>] [--json]
```

**What it does:**
- Runs full maturity questionnaire (or synthesizes from previous profile in JSON mode)
- Calculates new maturity profile across 7 dimensions
- Compares to previous assessment with delta display
- Shows evolution sparkline
- Records feedback for recommended capabilities

**Exit codes:** 0 (success), 1 (error)

---

### shugo clean

Clean cache and temporary files.

```bash
shugo clean [--dir <path>] [--json]
```

**What it does:**
- Removes `.shitenno-cache.json` from project root
- Removes `*.tsbuildinfo` files
- Invalidates internal cache

**Exit codes:** 0 (success), 1 (error)

---

### shugo doctor

System diagnostics with risks, improvements, and teaching moments.

```bash
shugo doctor [--dir <path>] [--json]
```

**What it does:**
- Consolidates engineering state from all subsystems
- Detects knowledge debt across 10 gap types
- Analyzes risks (critical debt, low maturity, blockers, no tests)
- Suggests improvements (no CI/CD, few capabilities, knowledge graph issues)
- Shows teaching moments (ADR vs Skill distinction, capability system, knowledge lifecycle)
- Calculates health score (100 - deductions for risks)

**Exit codes:** 0 (success), 1 (error)

---

### shugo report

Generate user performance report with dimensions, trends, and insights.

```bash
shugo report [--dir <path>] [--json] [--period <days>] [--save]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--period <days>` | Period in days (default: 30) |
| `--save` | Save report to `reports/` directory |

**What it does:**
- Generates performance report across 7 metrics (architectural vision, scope management, prompt quality, decision making, risk management, technical communication, sustainable velocity)
- Shows growth profile, session metrics, feedback stats
- Displays maturity and debt trends from telemetry snapshots
- Generates insights (strengths, improvements, patterns, suggestions)
- Provides actionable next steps

**Exit codes:** 0 (success), 1 (error)

---

### shugo daemon

Manage the background automation daemon.

```bash
shugo daemon <start|stop|status|restart>
```

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `start` | Start the daemon in the background |
| `stop` | Stop the daemon gracefully |
| `status` | Show PID, uptime, circuit breaker state |
| `restart` | Stop then start |

**What it does:**
- Watches governance files for changes
- Auto-archives completed plans
- Exposes IPC socket for state queries
- Circuit breaker: 5 crashes in 60s trips the breaker

**Exit codes:** 0 (success), 1 (error)

---

### shugo watch

Real-time event log for governance monitoring.

```bash
shugo watch [--events <types>] [--dir <path>]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--events <types>` | Comma-separated event types to filter (e.g. `plan.*,session.*`) |

**What it does:**
- Subscribes to 44+ event types on the event bus
- Displays events with timestamp, color-coded category, and label
- Shows heartbeat every 30 seconds
- Press Ctrl+C to stop

**Exit codes:** 0 (interrupted), 1 (error)

---

### shugo hooks

Install or uninstall Shugo git hooks.

```bash
shugo hooks [--uninstall] [--dir <path>]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--uninstall` | Remove Shugo hooks from git hooks |

**What it does:**
- Installs `shugo detect --auto` in `.husky/post-commit` and `.husky/post-merge`
- Idempotent: detects if already installed

**Exit codes:** 0 (success), 1 (error)

---

### shugo events

Show rule engine execution trace.

```bash
shugo events [--last <n>] [--trigger <type>] [--json]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--last <n>` | Show last N events (default: 20) |
| `--trigger <type>` | Filter by trigger type |
| `--json` | Output as JSON |

**What it does:**
- Reads `telemetry/rule-trace.jsonl`
- Shows timestamps, triggers, event types, and per-rule results

**Exit codes:** 0 (success), 1 (error)

---

### shugo context

Full project context for AI agents.

```bash
shugo context [--json] [--for-agent <name>]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--for-agent <name>` | Filter context for a specific agent |

**What it does:**
- Outputs project name, stack, engineering state, health, entropy, maturity, capabilities, assets, rules, policies, trend forecast, and active challenges

**Exit codes:** 0 (success), 1 (error)

---

### shugo history

View engineering state history with optional diffs.

```bash
shugo history [--from <date>] [--to <date>] [--diff] [--json]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--from <date>` | Start date (ISO format) |
| `--to <date>` | End date (ISO format) |
| `--diff` | Show diff between consecutive snapshots |
| `--json` | Output as JSON |

**What it does:**
- Lists historical snapshots of the Engineering State
- With `--diff`: shows health score, entropy, assets, and capability changes between snapshots

**Exit codes:** 0 (success), 1 (error)

---

### shugo handbook

Browse the project handbook in the terminal.

```bash
shugo handbook [--print] [--level <1|2|3>] [--list]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--print` | Non-interactive mode: print content as plain text |
| `--level <n>` | Show only a specific level (1, 2, or 3) |
| `--list` | List all available topics |

**What it does:**
- Default: launches interactive TUI (Ink-based)
- `--print`: outputs plain text for screen readers or piping
- Level 1: Fundamentals, Level 2: Commands, Level 3: Architecture

**Exit codes:** 0 (success), 1 (error)

---

### shugo mcp

MCP server management for AI integration.

```bash
shugo mcp [--dir <path>]
shugo mcp install [--check] [--upgrade] [--json]
```

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| (root) | Start MCP server over stdio |
| `install` | Install MCP Filesystem server globally |

**Options (install):**

| Option | Description |
|--------|-------------|
| `--check` | Check installation status without installing |
| `--upgrade` | Upgrade to latest version |
| `--json` | Output as JSON |

**Exit codes:** 0 (success), 1 (error)

---

### shugo briefing

Pre-session briefing for AI agents (Context Pipeline).

```bash
shugo briefing [--summary] [--write] [--json] [--depth <minimal|standard|full>]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--summary` | One-line summary only |
| `--write` | Write briefing to `.shugo/BRIEFING.md` |
| `--depth <level>` | Briefing depth: `minimal`, `standard`, or `full` |

**What it does:**
- Collects project context (fingerprint, risk map, rules, dynamic rules, maturity)
- Computes input hash for cache validation
- Generates briefing markdown with Quick Board, risk areas, test coverage, recommendations
- Caches result to avoid regeneration within same session

**Exit codes:** 0 (success), 1 (error)

---

### shugo feedback

Report session outcome for the Context Pipeline feedback loop.

```bash
shugo feedback --outcome <success|failure|partial> [--areas <list>] [--notes <text>] [--json] [--summary] [--list] [--personalized]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--outcome <type>` | Session outcome: `success`, `failure`, or `partial` |
| `--areas <list>` | Comma-separated modified areas (e.g. `src/auth,src/payments`) |
| `--notes <text>` | Optional notes about the session |
| `--duration <minutes>` | Session duration in minutes |
| `--user-rating <1-5>` | User rating for the session |
| `--user-comment <text>` | User comment about the session |
| `--summary` | Show feedback summary statistics |
| `--list` | List all feedback records |
| `--personalized` | Generate personalized feedback based on user profile |

**Exit codes:** 0 (success), 1 (error)

---

### shugo digest

Daily digest of project health and recent changes.

```bash
shugo digest [--json]
```

**What it does:**
- Reads maturity profile and knowledge debt
- Analyzes recent git changes (last 24h): files modified, lines added/removed
- Generates health assessment and actionable recommendations
- Publishes `analysis.complete` event

**Exit codes:** 0 (success), 1 (error)

---

### shugo bench

Benchmark token economy and Context Pipeline performance.

```bash
shugo bench [--json] [--iterations <n>] [--compare]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--iterations <n>` | Number of benchmark iterations (default: 5) |
| `--compare` | Compare with previous benchmark result |

**What it does:**
- Measures fresh briefing generation time vs cached
- Estimates token savings vs manual discovery
- Projects monthly cost savings
- Saves result to `reports/bench-history.json`

**Exit codes:** 0 (success), 1 (error)

---

### shugo console

Token economy console with session metrics.

```bash
shugo console [--json] [--period <days>]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--period <days>` | Period in days (default: 30) |

**What it does:**
- Shows session overview (total, success rate, outcomes)
- Token economy metrics (tokens saved, cache hit rate)
- Monthly cost projection
- Failure hotspots and session duration
- Session score (0-100)

**Exit codes:** 0 (success), 1 (error)

---

### shugo dashboard

Interactive engineering dashboard with tabs, mouse, and accessibility.

```bash
shugo dashboard [--json] [--live <seconds>] [--screen-reader]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON instead of TUI |
| `--live <seconds>` | Auto-refresh interval (0 = no refresh) |
| `--screen-reader` | Enable screen reader mode |

**What it does:**
- Launches interactive Ink-based TUI dashboard
- Multiple tabs: health, maturity, capabilities, debt
- Mouse and keyboard navigation
- Auto-refresh with `--live`

**Exit codes:** 0 (success), 1 (error)

---

### shugo profile

View and update your user profile for personalized feedback.

```bash
shugo profile [--set] [--name <name>] [--role <role>] [--architecture <level>] [--coding <level>] [--json]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--set` | Interactive profile setup |
| `--name <name>` | Set user name |
| `--role <role>` | Set role description |
| `--architecture <level>` | Architecture skill level (`junior`, `pleno`, `senior`) |
| `--coding <level>` | Coding skill level (`junior`, `pleno`, `senior`) |
| `--leadership <level>` | Leadership skill level |
| `--tone <tone>` | Feedback tone (`mentor`, `peer`, `relatorio`) |
| `--language <lang>` | Language (`pt`, `en`) |
| `--code-free <percent>` | Code-free percentage (0-100) |
| `--focus <areas>` | Comma-separated focus areas |

**Exit codes:** 0 (success), 1 (error)

---

### shugo goal

Manage governance goals.

```bash
shugo goal <subcommand> [options]
```

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `create <title>` | Create a new goal |
| `list` | List goals (filter by `--status`, `--priority`, `--target`, `--tag`) |
| `show <id>` | Show goal details |
| `update <id>` | Update goal (`--progress`, `--title`, `--priority`) |
| `activate <id>` | Activate a draft goal |
| `complete <id>` | Complete an active goal |
| `abandon <id>` | Abandon a goal |
| `stats` | Show goal statistics |
| `delete <id>` | Delete a goal |

**Exit codes:** 0 (success), 1 (error)

---

### shugo decide

Evaluate proposed actions using specialized evaluators.

```bash
shugo decide "<action>" [--category <cat>] [--risk <level>] [--impact <level>] [--json]
shugo decide list [--category <cat>] [--json]
shugo decide show <id> [--json]
shugo decide stats [--json]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--category <cat>` | Action category (`security`, `quality`, `architecture`, etc.) |
| `--risk <level>` | Risk level: `low`, `medium`, `high`, `critical` |
| `--impact <level>` | Impact level: `minimal`, `low`, `medium`, `high`, `critical` |
| `--goal <id>` | Target goal ID |
| `--introduces-debt` | Action introduces technical debt |

**What it does:**
- Evaluates risk, impact, confidence, and goal alignment
- Returns recommendation: `proceed`, `proceed_with_caution`, `defer`, or `block`
- Records decisions for historical analysis

**Exit codes:** 0 (success), 1 (error)

---

### shugo policy

Manage and evaluate declarative governance policies.

```bash
shugo policy <subcommand> [options]
```

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `list` | List all policies (filter by `--mode`, `--category`) |
| `show <id>` | Show policy details |
| `create <name>` | Create a new policy |
| `evaluate` | Evaluate policies against a context |
| `enable <id>` | Enable a policy |
| `disable <id>` | Disable a policy |
| `delete <id>` | Delete a policy |
| `stats` | Show policy statistics |

**Policy modes:** `enforce` (blocking), `advisory` (warning only)
**Policy effects:** `allow`, `deny`, `require`, `notify`

**Exit codes:** 0 (success), 1 (error)

---

### shugo act

Execute actions with idempotency guarantees.

```bash
shugo act <subcommand> [options]
```

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `log-event` | Log an event (`--event`, `--message`) |
| `notify` | Send a notification (`--message`, `--level`) |
| `reminder` | Create a reminder (`--message`, `--priority`) |
| `script` | Run a whitelisted script (`--script`) |
| `list` | List action executions |
| `show <id>` | Show execution details |
| `rollback <id>` | Rollback a completed action |
| `stats` | Show execution statistics |

**Exit codes:** 0 (success), 1 (error)

---

### shugo plan

Manage coordinated action sequences (plans).

```bash
shugo plan <subcommand> [options]
```

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `create <name>` | Create a plan with steps |
| `execute <id>` | Execute a plan |
| `rollback <id>` | Rollback a plan |
| `cancel <id>` | Cancel a plan |
| `list` | List plans (filter by `--status`) |
| `show <id>` | Show plan details |
| `stats` | Show plan statistics |
| `delete <id>` | Delete a plan |
| `md list` | List markdown execution plans |
| `md show <id>` | Show markdown plan details |
| `md status <id> <status>` | Update plan status (`andamento`, `parado`, `done`) |
| `md done <id>` | Mark plan as done |
| `md create <title>` | Create a new markdown plan |
| `md prepare <id>` | Prepare plan: format, checklist, sync backlog, notify |
| `md lifecycle` | Detect, review and archive completed plans |

**Exit codes:** 0 (success), 1 (error)

---

### shugo reminders

List, add, remove, and manage session reminders.

```bash
shugo reminders [add|rm|clear] [options]
```

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| (root) | List all active reminders |
| `add <msg>` | Add reminder |
| `rm <index>` | Remove by index |
| `rm --message <text>` | Remove by partial message match |
| `clear` | Remove all reminders |

**Options (add):**

| Option | Description |
|--------|-------------|
| `--priority <level>` | Priority: `high`, `medium`, `low` (default: `medium`) |
| `--category <cat>` | Category: `bug`, `feature`, `debt`, `security`, `docs`, `infra` |
| `--notify` | Send desktop notification |

**Exit codes:** 0 (success), 1 (error)

---

### shugo update

Detect changes in templates and apply updates.

```bash
shugo update [--apply] [--json]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--apply` | Apply detected updates |

**What it does:**
- Compares current files against template hashes
- Shows diff of changes since last install/upgrade
- Optionally applies updates and updates manifest

**Exit codes:** 0 (success), 1 (error)

---

### shugo docs-audit

Audit documentation lifecycle and propose organization.

```bash
shugo docs-audit [--apply] [--json]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--apply` | Apply proposed moves (requires confirmation) |

**What it does:**
- Classifies docs as: `planned`, `in_progress`, `completed`, `superseded`, `stale`
- Proposes moves to appropriate directories
- Publishes `doc.lifecycle.audited` event

**Exit codes:** 0 (success), 1 (error)

---

### shugo shell-init

Output shell hooks for session tracking.

```bash
shugo shell-init [--shell <type>]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--shell <type>` | Shell type: `bash`, `zsh`, `fish` |

**What it does:**
- Outputs shell integration code for session tracking
- Add to `.bashrc`/`.zshrc`: `eval $(shugo shell-init)`

**Exit codes:** 0 (success), 1 (error)

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |

---

*Last updated: 2026-07-13*
