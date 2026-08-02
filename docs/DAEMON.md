---
category: product
lifecycle: Active
---

# DAEMON — Shitenno Background Daemon

> **Version:** 1.0
> **Status:** Active
> **Purpose:** Reference documentation for the Shitenno background daemon

---

## Overview

The Shitenno daemon is an optional background process that provides continuous governance for AI-assisted projects. It operates as an event-driven hub, monitoring the project and generating proactive insights without requiring human intervention.

**Key Principle:** The daemon observes, classifies, and informs — it does not take autonomous actions. All governance decisions remain with the human or AI agent.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Shitenno Daemon                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │  Event Bus   │◄───│  File Watcher │                  │
│  │  (76 events) │    │  (governance, │                  │
│  └──────┬───────┘    │   source, git)│                  │
│         │            └──────────────┘                   │
│         ▼                                               │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │  Rule Engine │───►│  Proactive   │                   │
│  │  (policies)  │    │  Engine      │                   │
│  └──────────────┘    └──────┬───────┘                   │
│                             │                           │
│         ┌───────────────────┼───────────────────┐       │
│         ▼                   ▼                   ▼       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │  Challenges  │    │  Desktop     │    │  Digest  │  │
│  │  (rated)     │    │  Notifier    │    │  (30min) │  │
│  └──────────────┘    └──────────────┘    └──────────┘  │
│                                                         │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │  IPC Server  │    │  State       │                   │
│  │  (socket)    │    │  Persistence │                   │
│  └──────────────┘    └──────────────┘                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Event Bus

The central publish/subscribe system with 76 typed event types. All components communicate through events.

**Key Events:**
- `session.start` / `session.end` — Session lifecycle
- `health.checked` — Health audit completed
- `challenge.generated` — Proactive challenge created
- `engineering_state.consolidated` — State consolidation completed
- `source.changed` — Source code file modified (opt-in)
- `git.branch_changed` — Git branch switch detected (opt-in)
- `briefing.generated` — Briefing auto-generated

### 2. File Watcher

Monitors file system changes using chokidar.

**Default Watch Paths:**
- `.shitenno/governance/` — Governance artifacts
- `.shitenno/docs/` — Documentation

**Optional Watch Paths (opt-in via environment variables):**
- `SHITENNO_WATCH_SOURCE=1` — Watches `src/` directory for source code changes
- `SHITENNO_WATCH_GIT=1` — Watches `.git/HEAD` and `.git/refs/` for branch changes

### 3. Rule Engine

Subscribes to events and applies governance policies. Validates actions against FORBIDDEN_OPERATIONS and other rules.

### 4. Proactive Engine

Generates challenges based on engineering state analysis:

| Challenge Type | Trigger | Severity |
|---|---|---|
| `entropy_reduction` | High entropy score | medium/high |
| `knowledge_gap` | Knowledge debt detected | medium/high |
| `capability_stale` | Capability drift | medium |
| `next_step` | Plan completed | low |
| `health_critical` | Health score < 40 | high |
| `maturity_regression` | Maturity level dropped | high |

**Rate Limiting:**
- 5-minute cooldown between same challenge type
- Maximum 3 challenges of same type per hour
- Deduplication prevents redundant alerts

### 5. Desktop Notifier

Sends system notifications for important events:

| Event | Notification |
|---|---|
| `challenge.generated` | New challenge available |
| `workdir.large_uncommitted_drift` | Large uncommitted changes |
| `plan.inconsistency_detected` | Plan inconsistency found |
| `briefing.generated` | Briefing auto-generated |

**Platform Support:**
- Linux: `notify-send`
- macOS: `osascript`
- Windows: PowerShell

**Persistence:** All notifications logged to `.shitenno/daemon/notifications.jsonl`

### 6. Proactive Digest

Generates periodic summaries every 30 minutes (configurable via `SHITENNO_PROACTIVE_INTERVAL_MS`).

**Output:** `.shitenno/daemon/proactive-digest.md`

**Content:**
- Pending challenges
- Health status
- Uncommitted drift
- Knowledge debt

### 7. Auto-Briefing

Generates `BRIEFING.md` on `session.start` if:
- File doesn't exist, OR
- Last generation was > 30 minutes ago

**Integration:**
- Daemon: Generates on session start event
- CLI: Generates as fallback when daemon is not running

### 8. IPC Server

Unix domain socket for inter-process communication.

**Commands:**
- `status` — Full daemon status
- `stop` — Graceful shutdown
- `query_events` — Event history
- `query_health` — Health status
- `query_drift` — Working directory drift
- `query_sessions` — Session history
- `query_challenges` — Pending challenges
- `query_debt` — Knowledge debt
- `query_briefing` — Cached briefing
- `query_riskmap` — Risk map

---

## Commands

### `shugo daemon start`

Start the daemon in the background.

```bash
shugo daemon start
```

**Behavior:**
- Checks for existing daemon (prevents duplicates)
- Claims verification lock
- Initializes all engines
- Starts IPC server
- Begins file watching

### `shugo daemon stop`

Stop the daemon gracefully.

```bash
shugo daemon stop
```

**Behavior:**
- Sends SIGTERM to daemon process
- Daemon persists state before exiting
- Cleans up PID file and socket

### `shugo daemon status`

Show daemon status with detailed information.

```bash
shugo daemon status
```

**Output includes:**
- Running status and uptime
- PID and version
- Active sessions
- Working directory drift
- Health score
- Pending challenges
- Knowledge debt
- Proactive engine state (last check, challenges triggered)
- Audit state (last audit, total audits)
- Circuit breaker status

### `shugo daemon restart`

Restart the daemon.

```bash
shugo daemon restart
```

### `shugo daemon logs`

Stream daemon log in real time.

```bash
shugo daemon logs --lines 100
```

### `shugo daemon notifications`

Show recent desktop notifications.

```bash
shugo daemon notifications --lines 20
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SHITENNO_WATCH_SOURCE` | `0` | Set to `1` to watch source code changes |
| `SHITENNO_WATCH_GIT` | `0` | Set to `1` to watch git branch changes |
| `SHITENNO_PROACTIVE_INTERVAL_MS` | `1800000` | Proactive digest interval (30min) |
| `SHITENNO_SKIP_DAEMON` | `0` | Set to `1` to skip daemon auto-start |

### Daemon State

Persisted to `.shitenno/daemon/state.json`:

```json
{
  "drift": { "filesChanged": 5, "minutesSinceLastCommit": 30 },
  "sessions": [...],
  "health": { "score": 75, "checkedAt": "2026-07-23T10:00:00Z" },
  "challenges": [...],
  "debt": { "gapCount": 3, "healthScore": 80 },
  "events": [...],
  "proactiveEngine": { "lastCheck": "...", "challengesTriggered": 5 },
  "audit": { "lastAuditTime": "...", "auditCount": 10 }
}
```

---

## File Structure

```
.shitenno/daemon/
├── state.json              # Daemon state
├── daemon.pid              # Process ID
├── daemon.sock             # IPC socket
├── daemon.log              # Log file
├── notifications.jsonl     # Notification history
├── proactive-digest.md     # Periodic digest
└── verification.lock       # Verification lock
```

---

## Event Flow

```
User starts session
       │
       ▼
  session.start event
       │
       ├──► Auto-briefing generates BRIEFING.md
       │
       ├──► File watcher monitors governance + source
       │
       └──► Daemon records session

User works
       │
       ▼
  File changes detected
       │
       ├──► Rule engine validates against policies
       ├──► Proactive engine analyzes state
       └──► Challenges generated (rate-limited)

Consolidation timer (15min)
       │
       ▼
  engineering_state.consolidated
       │
       ├──► Proactive engine evaluates trends
       ├──► Health checks triggered
       └──► Digest generated (30min)

Session ends
       │
       ▼
  session.end event
       │
       ├──► Session recorded
       ├──► State persisted
       └──► Drift recalculated
```

---

## Rate Limiting

The proactive engine implements rate limiting to prevent alert fatigue:

- **Cooldown:** 5 minutes between same challenge type
- **Hourly limit:** Maximum 3 challenges of same type per hour
- **Deduplication:** Identical challenges are suppressed

**Configuration:** Modify `COOLDOWN_MS` and `MAX_SAME_CHALLENGE_PER_HOUR` in `src/prioritization/triggers.ts`.

---

## Troubleshooting

### Daemon won't start

1. Check if another daemon is running: `shugo daemon status`
2. Check PID file: `.shitenno/daemon/daemon.pid`
3. Check log: `.shitenno/daemon/daemon.log`

### Notifications not working

1. Verify desktop notifications are enabled on your system
2. Check notification log: `shugo daemon notifications`
3. Verify notify-send (Linux) or osascript (macOS) is available

### High CPU usage

1. Check file watcher paths — exclude unnecessary directories
2. Verify `SHITENNO_WATCH_SOURCE` is not set unnecessarily
3. Check for rapid file changes in governance directory

---

## Integration with AI Agents

The daemon provides context to AI agents through:

1. **Briefing:** Auto-generated before each session
2. **Challenges:** Proactive suggestions surfaced in briefing
3. **Status:** Available via `shugo daemon status`
4. **MCP Server:** Real-time access via `shugo mcp`

**Recommended Workflow:**
1. Agent starts session
2. Reads auto-generated briefing
3. Sees proactive alerts and challenges
4. Decides which to address
5. Records feedback at session end
