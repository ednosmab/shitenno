---
category: reference
lifecycle: Active
---

# Daemon

Background automation service for Shugo governance.

---

## `shugo daemon`

Manages the Shugo daemon lifecycle. The daemon watches governance files and automatically reacts to changes (e.g., archiving completed plans).

### Subcommands

#### `shugo daemon start`

Start the daemon as a detached background process.

```bash
shugo daemon start
```

**What it does:**
- Spawns `src/daemon.ts` as a background process
- Creates a Unix domain socket at `shitenno/daemon/daemon.sock`
- Writes PID to `shitenno/daemon/daemon.pid`
- Starts file watcher on `shitenno/governance/` and `shitenno/docs/`
- Auto-archives completed plans

**Behaviour:**
- Respects `SHITENNO_NO_DAEMON=1` or `CI=true` (skips startup)
- Waits up to 3s for socket to appear before returning
- Circuit breaker: if 5 crashes happen within 60s, daemon refuses to start
- First successful start creates `shitenno/daemon/daemon.approved`

#### `shugo daemon stop`

Stop the daemon gracefully.

```bash
shugo daemon stop
```

**What it does:**
- Sends `SIGTERM` to the PID in `daemon.pid`
- Waits for clean shutdown (socket closed, PID file removed)

#### `shugo daemon status`

Show daemon status and diagnostics.

```bash
shugo daemon status
```

**Output includes:**
- Running state (running/stopped)
- Responsiveness (IPC ping)
- PID and uptime
- Circuit breaker state (tripped, crash count, last crash)
- Environment overrides (`SHITENNO_NO_DAEMON`, `CI`)
- Approval state

#### `shugo daemon restart`

Restart the daemon (stop + wait 1s + start).

```bash
shugo daemon restart
```

### Circuit Breaker

The circuit breaker protects against crash loops:

| Threshold | Behaviour |
|-----------|-----------|
| 5 crashes in 60s | Circuit breaker trips |
| When tripped | `daemon start` and `daemon restart` refuse to start |
| Reset | After 30s of stable uptime, or delete `shitenno/daemon/circuit-breaker.json` |

### Runtime Files

| File | Purpose |
|------|---------|
| `shitenno/daemon/daemon.pid` | Current daemon PID |
| `shitenno/daemon/daemon.sock` | Unix domain socket for IPC |
| `shitenno/daemon/daemon.log` | Daemon log output |
| `shitenno/daemon/circuit-breaker.json` | Crash tracking state |
| `shitenno/daemon/daemon.approved` | First-start approval flag |

### IPC Protocol

The daemon exposes a Unix domain socket server with these message types:

| Message | Response |
|---------|----------|
| `ping` | `pong` |
| `handshake` | Version check |
| `status` | Uptime, PID, socket state |
| `stop` | Graceful self-termination |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SHITENNO_NO_DAEMON=1` | Disable daemon auto-start |
| `CI=true` | Disable daemon in CI environments |
| `SHITENNO_CHILD=1` | Internal: marks child processes |
