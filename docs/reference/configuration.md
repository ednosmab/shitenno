---
category: reference
lifecycle: Active
---

# Configuration Reference

> How Shugo CLI reads and writes configuration.

## opencode.json

The AI agent configuration file, created by `shugo init` at the project root.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode/[modelo-principal]",
  "default_agent": "plan",
  "agent": {
    "plan": { ... },
    "build": { ... },
    "orchestrator": { ... },
    "review": { ... }
  },
  "instructions": [ ... ],
  "skills": { ... },
  "mcp": { ... },
  "permission": {
    "*": "allow",
    "edit": {
      "*": "allow",
      "*.env": "deny",
      "*.env.*": "deny"
    }
  }
}
```

### Top-level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `$schema` | string | No | JSON schema URL for validation |
| `model` | string | Yes | Default model for all agents |
| `default_agent` | string | Yes | Agent invoked on startup (`plan`) |
| `agent` | object | Yes | Agent definitions (plan, build, review, orchestrator) |
| `instructions` | string[] | Yes | File paths loaded as system context |
| `skills` | object | No | Skills directory configuration |
| `mcp` | object | No | MCP server configurations |
| `permission` | object | No | Global permission rules for all agents |

### Agent Definitions

Each agent under `agent` supports:

| Field | Type | Description |
|-------|------|-------------|
| `role` | string | Agent role (`planner`, `executor`, `auditor`, `orchestrator`) |
| `model` | string | Model override for this agent |
| `description` | string | System prompt / behavior description |
| `permission` | object | Tool permission rules (review agent only) |

#### Permission Rules (review agent)

```json
{
  "permission": {
    "edit": "deny",
    "bash": {
      "pnpm run test": "allow",
      "pnpm run lint": "allow",
      "git status": "allow",
      "*": "ask"
    }
  }
}
```

### Skills Configuration

```json
{
  "skills": {
    "paths": ["shitenno/docs/skills"]
  }
}
```

---

## shitenno/ Directory

Created by `shugo init`. Structure:

```
shitenno/
├── docs/              # Documentation, skills, ADRs, plans
│   ├── skills/        # Engineering skills (21+)
│   ├── plans/         # Execution plans (archived)
│   ├── feedback/      # Session feedback (private)
│   └── history/       # Migrated legacy docs
├── governance/        # Governance structure
│   ├── contracts/     # AI role contracts
│   ├── context/       # context_buffer.yaml
│   ├── knowledge/     # ADRs, workflows
│   ├── quality/       # Quality rules
│   └── metrics/       # Metrics definitions
├── scripts/           # Session scripts (validate, close)
├── cognition/         # AI context memory
├── reports/           # Generated reports
├── maturity-profile.json
└── complexity-report.json
```

---

## shitenno/profile/ ProjectProfile

Defines how Shugo adapts to your project type.

```json
{
  "projectType": "fullstack",
  "complexity": "medium",
  "teamSize": "small",
  "lifecycle": "active",
  "governanceLevel": "standard"
}
```

### Fields

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `projectType` | string | `frontend`, `backend`, `fullstack`, `library`, `mobile` | Project category |
| `complexity` | string | `simple`, `medium`, `complex` | Structural complexity |
| `teamSize` | string | `solo`, `small`, `medium`, `large` | Team size |
| `lifecycle` | string | `new`, `active`, `mature`, `legacy` | Project lifecycle phase |
| `governanceLevel` | string | `minimal`, `standard`, `strict` | Governance strictness |

---

## Loading Profiles

Control how much context AI agents load per session.

| Profile | Rules | Use Case | Tokens |
|---------|-------|----------|--------|
| **minimal** | #1-11, FORBIDDEN_OPERATIONS, DESDO | Quick tasks, typo fixes | ~3-4K |
| **lite** (default) | minimal + #12-16 | Feature implementation, bug fixes | ~5-6K |
| **full** | lite + #17-22 | Architecture decisions, complex debugging | ~8-10K |

Override with `loading_profile` field in `opencode.json`.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SHITENNO_HOME` | Shugo home directory | `~/.shugo` |
| `SHITENNO_PLUGINS` | Plugin directory | `shitenno/plugins/` |
| `SHITENNO_LOG_LEVEL` | Log level (`debug`, `info`, `warn`, `error`) | `info` |
| `SHITENNO_NO_DAEMON` | Set to `1` to disable daemon auto-start | unset |
| `SHITENNO_DAEMON` | Force daemon mode | unset |
| `CI` | Disables daemon in CI environments | unset |

---

## Configuration Precedence

1. CLI flags (`--dir`, `--json`, `--force`)
2. Environment variables
3. `opencode.json`
4. `shitenno/profile/<project>.config.ts`
5. Defaults

---

*Last updated: 2026-06-29*
