# Shitenno

> Engineering knowledge governance — the context bridge between you, your team, and the AI agents that work on your project.

## What it is

**Shitenno** is an engineering knowledge governance system. It observes your project, maintains a persistent and verifiable model of what is already known about it — decisions, risks, test coverage, patterns, knowledge gaps — and serves that state as trustworthy context to both humans and AI agents working in the repository. Every intervention produces an outcome, and that outcome feeds back into future recommendations.

It exists to solve a specific problem: work sessions (human or AI) that start from zero, with no memory of what was already decided, tested, or broken before. Shitenno calls this **Knowledge Debt** — knowledge that exists but is disconnected, unverified, or never reaches whoever (or whatever) needs it at the moment of acting.

**The three components:**

| Component | What it is |
|---|---|
| **Shugo** | The binary/CLI — single entry point (`shugo init`, `audit`, `briefing`, `plan`, `daemon`, `mcp`, among ~35 commands) |
| **`.shitenno/`** | Artifact generated per project when running `shugo init` — where state, cache, history, and that repository's daemon live |
| **Daemon** | Background process, one per project, started by the CLI (automatically or via `shugo daemon start`). Once started it runs isolated — watches files, listens to the event bus, triggers checks — but the CLI never depends on it: there's always a disk-based fallback path |

**The AI bridge:** the MCP server (`shugo mcp`) exposes the project's state as tools an LLM agent can query before and during work — `getBriefing`, `getRiskMap`, `getRules`, `getEngineeringState`, `getBacklog`, `getADRs`, `getSkills` — and receives the outcome back via `submitFeedback`, closing the loop between recommendation and reality.

**What it is not:** not a linter/formatter (it recommends, it doesn't apply code changes on its own); not a framework you import into your application code; not an AI wrapper (it doesn't call any LLM — it's the context layer an external LLM queries); not hosted or multi-tenant — every instance is local and isolated per project.

**Status:** built and validated for solo use. Team usage (2+ people on the same project) has not been tested with real users yet — see [Known Limitations](docs/KNOWN_LIMITATIONS.md) before relying on it in a shared repository. Part of the architecture described above (advanced autonomy phases, third-party extensibility) is design direction documented in [`docs/evolution/`](docs/evolution/), not current state.

---

## Quick Start

### 1. Install

```bash
npm install -g shitenno
```

Or run directly with npx:

```bash
npx shitenno status
```

### 2. Initialize your project

```bash
shugo init
```

```
╔══════════════════════════════════════════╗
║  shugo init — Maturity-Based Discovery   ║
╚══════════════════════════════════════════╝

- Analysing project...
✔ Project analysis complete

  Detected:
    Stack:     typescript
    Packages:  3
    Apps:      2
    Source:    255 files
    Manager:   pnpm
    TypeScript: yes
    Tests:     yes
    CI/CD:     yes
```

Shugo detects your stack, generates a maturity profile, and creates the governance structure (`opencode.json`, `shitenno/`, skills, scripts).

### 3. Check status

```bash
shugo status
```

```
╔══════════════════════════════════════╗
║      shugo status — Health Check     ║
╚══════════════════════════════════════╝

  Governance Health:
    ✔ opencode.json: Configured with 4 agents
    ✔ AGENTS.md: 45 rules configured
    ✔ skills/: 22 skills installed
    ✔ context_buffer.yaml: Valid
  Summary: ✔ 7 passed  ⚠ 0 warnings  ✘ 0 failed

  🎯 Maturity Profile:
    Overall Score: 59/100 ████████████░░░░░░░░ 59%
    Quality       ████████████████ 100%
    Automation    ████████████████ 100%
    AI            ████████████░░░░  75%

  📊 Complexity Score: 12/20
```

That's it. Your project now has governed context for you and your AI agents.

---

## All Commands (38)

### Core Commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `shugo init` | Initialize governance in a project | First time setup |
| `shugo status` | Health check + complexity scoring | During development, before commits |
| `shugo run` | Full 5-stage pipeline | Periodic health audits |
| `shugo upgrade` | Add governance capabilities | When you need more features |
| `shugo validate` | Session integrity check | Before important commits |

### Analysis Commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `shugo detect` | Pattern detection from history | Find recurring errors |
| `shugo audit` | Self-evaluation of governance | Find dead rules, hotspots |
| `shugo evolve` | Adaptive recommendations | Get next-step suggestions |
| `shugo assess` | Re-evaluate maturity profile | After major changes |
| `shugo doctor` | System diagnostics | When something feels off |
| `shugo scheduled-check` | Check uncommitted drift | Detect stale uncommitted changes |

### Governance Commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `shugo plan` | Generate execution plans | Create step-by-step plans |
| `shugo goal` | Set and track goals | Define project objectives |
| `shugo decide` | Decision tracking | Record and manage decisions |
| `shugo policy` | Manage governance policies | Configure rules and policies |
| `shugo act` | Execute agent actions | Run agent-driven tasks |

### Context Commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `shugo context` | Full project context for AI agents | Load context for AI sessions |
| `shugo briefing` | Pre-session briefing | Context loading before sessions |
| `shugo digest` | Generate digest summaries | Quick status overviews |
| `shugo feedback` | Submit session feedback | Record session outcomes |
| `shugo history` | View engineering state history | Review past snapshots |
| `shugo handbook` | Reference handbook for Shugo | Quick reference lookup |
| `shugo backlog` | Manage backlog items with states and priorities | Track work items and tasks |

### Utility Commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `shugo sync` | Sync governance from external source | Multi-project setups |
| `shugo clean` | Clean cache and temp files | Housekeeping |
| `shugo report` | Generate reports | Sharing status with stakeholders |
| `shugo bench` | Run benchmarks | Performance testing |
| `shugo console` | Interactive console | Real-time governance monitoring |
| `shugo dashboard` | Open governance dashboard | Visual project overview |
| `shugo profile` | View maturity profile | Detailed maturity analysis |
| `shugo reminders` | Track pending tasks and follow-ups | Never forget action items |
| `shugo mcp` | MCP server for AI integration | Connect AI agents |
| `shugo update` | Update Shugo system | Keep governance current |
| `shugo shell-init` | Shell integration setup | Configure shell completions |
| `shugo docs-audit` | Audit documentation sync | Validate docs match code |
| `shugo events` | Show rule engine execution trace | Debug rule engine behaviour |
| `shugo hooks` | Manage Git hooks for auto-detection | Setup post-commit/merge hooks |

---

## Who Is This For

Today, Shugo is built and used by a single developer to preserve engineering context across their own AI-assisted sessions. It has not been run by a team yet, so claims about team size or onboarding time would be speculation — this section will be filled in with real numbers once that's actually tested.

If you use AI agents (Claude Code, Cursor, opencode, etc.) and lose context between sessions on solo projects, that's the validated use case today.

---

## Token Economy

Shugo caches a project briefing on disk (`briefing-cache.ts`) and reuses it via a content hash instead of recomputing on every session, which mechanically means fewer tokens spent re-reading project state when the cache is warm. We have not run controlled measurements of how much this saves in practice — no percentage numbers are published until they come from actual measured sessions, not projections.

---

## Architecture

```
shitenno-cli/
├── bin/shugo.ts              # CLI entry point (Commander.js)
├── src/
│   ├── analyser.ts           # Project analysis & stack detection
│   ├── scorer.ts             # Complexity scoring engine
│   ├── pattern-detector.ts   # Pattern extraction from history
│   ├── health-auditor.ts     # Governance health auditing
│   ├── rule-engine.ts        # Declarative rule engine
│   ├── event-bus.ts          # Pub/sub system for modules
│   ├── plugin-system.ts      # Extensibility system
│   ├── cache.ts              # Disk cache with SHA256 checksums
│   ├── logger.ts             # Centralized logging
│   ├── constants.ts          # Shared constants
│   ├── errors.ts             # Typed errors
│   ├── utils.ts              # Shared utilities
│   ├── shared.ts             # CLI infrastructure
│   ├── engineering-state.ts  # Single source of truth
│   ├── knowledge-graph.ts    # Knowledge graph
│   ├── knowledge-debt.ts     # Knowledge debt detection
│   ├── maturity-profile.ts   # Maturity profiling
│   ├── feedback-engine.ts    # Personalized feedback
│   ├── recommendation-engine.ts  # Smart recommendations
│   ├── action-engine.ts      # Action execution
│   ├── capability-engine.ts  # Capability management
│   ├── decision-engine.ts    # Decision tracking
│   ├── goal-engine.ts        # Goal management
│   ├── policy-engine.ts      # Policy enforcement
│   ├── trend-engine.ts       # Trend prediction
│   ├── inference-engine.ts   # Inference engine
│   ├── proactive-engine.ts   # Proactive suggestions
│   ├── commands/             # CLI command implementations
│   │   ├── init.ts
│   │   ├── status.ts
│   │   ├── audit.ts
│   │   ├── ... (32 commands)
│   │   └── mcp.ts
│   ├── audit/                # Audit detectors
│   │   ├── engineering-detectors.ts
│   │   ├── governance-detectors.ts
│   │   ├── architecture-detectors.ts
│   │   ├── security-detectors.ts
│   │   ├── suggestion-engine.ts
│   │   └── ... (100+ detectors)
│   ├── templates/            # Scaffolding templates
│   └── __tests__/            # 111 test files
├── docs/                     # Documentation
└── shitenno/             # Governance data (per-project)
```

### Key Statistics

| Metric | Count |
|--------|-------|
| CLI Commands | 38 |
| Source Files | 269 |
| Test Files | 157 |
| Audit Detectors | 100+ |
| Engine Modules | 12 |

*(Counts as of the last README update — likely to drift; run `shugo docs-audit` to check against current code before quoting these elsewhere.)*

### How It Works

Shugo operates on three layers:

```
┌─────────────────────────────────────────────┐
│              GOVERNANCE LAYER                │
│  Rules, Workflows, Contracts, Premortem     │
│  "How we work"                              │
├─────────────────────────────────────────────┤
│              KNOWLEDGE LAYER                │
│  ADRs, Skills, Runbooks, Scripts            │
│  "What we know"                             │
├─────────────────────────────────────────────┤
│              ANALYSIS LAYER                 │
│  Scoring, Patterns, Health, Debt            │
│  "What we measure"                          │
└─────────────────────────────────────────────┘
```

---

## Security

Shugo implements multiple security measures:

| Measure | Description |
|---------|-------------|
| **Script allowlist** | Only approved scripts can be executed via rules |
| **Rule ID validation** | IDs restricted to alphanumeric, hyphens, underscores |
| **Regex protection** | Patterns validated against complexity excess |
| **Prototype pollution guard** | Access to `__proto__`, `constructor` blocked |
| **Plugin validation** | Hooks and names validated before registration |
| **Atomic cache writes** | Temp file + rename prevents corruption |
| **Cache permissions** | `.shitenno-cache.json` created with `chmod 0o600` |
| **Supply chain security** | Pinned action SHAs in CI/CD workflows |

---

## Configuration

### `opencode.json` (Project Root)

```json
{
  "model": "mimo-v2.5-free",
  "agent": {
    "plan": { "role": "planner", "model": "mimo-v2.5-free" },
    "build": { "role": "executor", "model": "deepseek-v4-flash-free" },
    "review": { "role": "auditor", "model": "mimo-v2.5-free" }
  }
}
```

### `shitenno/` (Project Directory)

Created automatically during `shugo init`. Contains:
- `engineering-state.json` — Canonical project state
- `maturity-profile.json` — Maturity assessment
- `governance/` — Rules, policies, workflows
- `docs/` — ADRs, skills, runbooks
- `reports/` — Generated reports
- `telemetry/` — Session tracking

---

## Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev status

# Build
npm run build

# Test
npm test

# Type check
npm run typecheck

# Lint
npm run lint

# Benchmarks
npm run bench
```

### Testing

- **~2000 tests** across 130 test files (written after implementation, not TDD — see [Known Limitations](docs/KNOWN_LIMITATIONS.md))
- **24 CLI integration tests** (end-to-end)
- **Performance benchmarks** for scoring, detection, and audit engines

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run bench         # Run benchmarks
```

### CI/CD

- **Lint job** — ESLint + TypeScript + npm audit (fast fail)
- **Test job** — Build + test across Node 18/20/22
- **Coverage job** — Code coverage report
- **Release job** — Version verification + npm publish + GitHub release

---

## Requirements

- Node.js >= 18.0.0
- Git (recommended, for behavioral metrics)

## License

MIT — See [LICENSE](LICENSE) for details.
