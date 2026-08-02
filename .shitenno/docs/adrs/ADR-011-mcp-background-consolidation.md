---
category: engineering
lifecycle: Active
---

# ADR-011: MCP Background Consolidation for Fast Handshake

**Status:** Accepted
**Date:** 2026-08-02
**Implemented:** 2026-08-02
**Deciders:** Tech Lead, AI Agent

## Context

The MCP (Model Context Protocol) server is the primary interface between AI agents and the Shitenno governance system. It communicates over stdio using JSON-RPC and must respond to the client's `initialize` handshake quickly.

### The Problem

On the **first session** (cold cache), the MCP server would fail to start because:

1. `mcp` was listed in `HEAVY_COMMANDS` in `bin/shugo.ts`
2. The heavy bootstrap (`ensureHeavyBootstrap()`) ran during the `preAction` hook before the MCP server could respond
3. This bootstrap includes: rule-engine, knowledge-graph, capability-engine, engineering-state consolidation, proactive-engine, model-config, doc-sync, and plan-backlog-sync
4. On a cold cache, `consolidateEngineeringState()` alone could exceed 30 seconds (it walks the entire project tree, analyses complexity, detects knowledge debt, discovers assets, builds the knowledge graph, and calculates entropy)
5. The MCP client's default timeout is 10 seconds — the handshake would timeout before the server could respond

**Result:** The MCP server would not start on the first session. It only worked on subsequent sessions when the engineering state was cached on disk.

### Why Second Session Worked

On subsequent sessions, the disk cache (`engineering-state.json`) was fresh enough to skip full consolidation, making the bootstrap fast enough to complete within the timeout window.

## Decision

**Move engineering-state consolidation out of the MCP server's critical path by scheduling it in a detached background child process.**

### Implementation

#### 1. Remove `mcp` from `HEAVY_COMMANDS` (`bin/shugo.ts`)

The MCP command no longer triggers `ensureHeavyBootstrap()`. The server starts immediately without loading rule-engine, knowledge-graph, or other heavy subsystems in the main process.

#### 2. Background Consolidation (`src/mcp-consolidation.ts`)

A new module `scheduleConsolidation()` spawns a detached child process that runs:

```bash
node dist/bin/shugo.js mcp --consolidate-only --dir <projectRoot> <shitennoDir>
```

Key properties:
- **Detached**: The child process runs independently of the parent MCP server
- **`stdio: "ignore"`**: No I/O capture — the child is fire-and-forget
- **Timeout**: 30-second maximum wait; the parent resolves the ready gate regardless
- **Error handling**: Spawn failures are caught and logged; the server continues

#### 3. Ready Gate (`src/mcp-server.ts`)

A `readyPromise` parameter is added to `createMcpServer()` and `startMcpServer()`. Tool dispatch awaits this promise before executing:

```typescript
if (readyPromise) await readyPromise;
return await dispatchTool(name, projectRoot, resolvedShitennoDir, toolArgs);
```

This ensures:
- The MCP handshake completes immediately (no blocking)
- Tool calls wait for consolidation to finish before returning data
- The 30-second timeout prevents indefinite blocking

#### 4. Consolidate-Only Mode (`src/commands/mcp.ts`)

The `--consolidate-only` flag runs only `consolidateEngineeringState()` and exits. This is the internal command used by the background child process.

#### 5. Lightweight Init Check (`src/engineering-state/access.ts`)

A new `isInitialized()` function checks if `.shitenno/` exists — a cheap alternative to full consolidation that prevents unnecessary work in the MCP command.

### Flow Diagram

```
Client                    MCP Server (parent)              Background Child
  │                              │                              │
  │──── initialize ─────────────>│                              │
  │                              │── spawn child ──────────────>│
  │<─── handshake response ──────│                              │
  │                              │                              │── consolidateEngineeringState()
  │──── callTool(getBriefing) ──>│                              │
  │     (waits for readyGate)    │                              │
  │                              │<──── child exits ────────────│
  │<─── tool response ───────────│                              │
```

## Consequences

### Positive

- **First session works**: The MCP handshake completes in ~6 seconds (module loading overhead) instead of 30+ seconds
- **No blocking**: The server responds to `initialize` immediately
- **Data freshness**: Tool calls still wait for consolidation via the ready gate
- **Backward compatible**: The MCP protocol behavior is unchanged from the client's perspective
- **Graceful degradation**: If the background child fails, the 30-second timeout ensures the server continues

### Negative

- **Dual-process overhead**: The background child adds a second Node.js process (~50MB RSS)
- **Race condition potential**: If a tool is called before consolidation completes, it waits up to 30 seconds
- **Complexity**: The `readyPromise` gate adds a synchronization point in the tool dispatch path

## Alternatives Considered

### Option A: Lazy Bootstrap in Main Process

- **Description**: Keep `mcp` in HEAVY_COMMANDS but make `ensureHeavyBootstrap()` async and non-blocking
- **Pros**: Simpler, single process
- **Cons**: Still blocks the event loop during consolidation; the handshake would still timeout on cold cache

### Option B: Pre-warm Cache on `shugo init`

- **Description**: Run `consolidateEngineeringState()` during `shugo init` so the cache is always warm
- **Pros**: No runtime overhead; cache is always available
- **Cons**: `init` becomes slower; doesn't help if cache is invalidated between sessions; doesn't solve the fundamental problem of blocking the MCP handshake

### Option C: In-Process Timeout with Lazy Dispatch

- **Description**: Start consolidation in the main process but set a timeout; if it doesn't complete, serve stale cache
- **Pros**: Single process; handles stale data gracefully
- **Cons**: Still blocks the event loop during consolidation; stale data may confuse agents

### Option D: Separate MCP Daemon (Long-Running Process)

- **Description**: Run the MCP server as a persistent daemon that consolidates once on startup
- **Pros**: Consolidation cost paid once; subsequent connections are instant
- **Cons**: Requires daemon lifecycle management; adds operational complexity; conflicts with the existing daemon architecture

## References

- `src/mcp-consolidation.ts` — Background consolidation scheduler
- `src/mcp-server.ts` — Ready gate in tool dispatch
- `src/commands/mcp.ts` — `--consolidate-only` mode
- `bin/shugo.ts` — HEAVY_COMMANDS exclusion
- `src/engineering-state/access.ts` — `isInitialized()` function
- MCP Protocol Specification — JSON-RPC over stdio
- Issue: MCP server timeout on first session (2026-08-02)
