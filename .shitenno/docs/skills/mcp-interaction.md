---
category: engineering
lifecycle: Active
---

# Skill: MCP Server Interaction

## ⚡ Mandatory Rule

- **Sempre** usar o MCP (`node scripts/mcp-client.mjs <tool> <args>`) para obter dados do projecto (briefing, regras, estado, backlog, etc.)
- **Nunca** ler ficheiros raw quando o MCP está disponível — o servidor aplica governance e transformações
- Se o build não existir, o client faz build automático

## Purpose
Interact with the Shitenno MCP server via JSON-RPC over stdio to retrieve project intelligence data.

## When to Use
- Need project briefing, risk map, engineering state, rules, backlog, or ADRs
- Need to query or modify backlog items
- Need knowledge debt analysis or challenge generation
- Any time project data is needed from the governed context

## MCP Client

The reusable client is at `scripts/mcp-client.mjs`.

### Usage

```bash
# List all available tools
node scripts/mcp-client.mjs --list

# Call a tool with JSON args
node scripts/mcp-client.mjs <toolName> '<jsonArgs>'
```

### Available Tools

| Tool | Description | Example Args |
|------|-------------|--------------|
| `getBriefing` | Pre-session briefing | `{"format":"summary","depth":"minimal"}` |
| `getRiskMap` | Risk analysis | `{"format":"summary"}` |
| `getRules` | Governance rules | `{"type":"context","format":"json"}` |
| `getEngineeringState` | Current state | `{}` |
| `getKnowledgeDebt` | Knowledge debt analysis | `{"format":"summary"}` |
| `getChallenges` | Challenge alternatives | `{"format":"summary"}` |
| `getBacklog` | Backlog items | `{"format":"summary","includeDone":false}` |
| `getPlans` | Architectural plans | `{"planName":"PLAN-file-refactor-64-overloaded.md"}` |
| `getADRs` | Architecture decisions | `{"id":"ADR-008"}` |
| `getSkills` | Mandatory skills | `{"task":"implementation"}` |
| `submitFeedback` | Task feedback | `{"outcome":"success","notes":"..."}` |
| `addBacklogItem` | Add item | `{"title":"...","priority":"P1"}` |
| `transitionBacklogItem` | Transition state | `{"id":"...","toState":"done"}` |
| `deleteBacklogItem` | Delete item | `{"id":"..."}` |
| `getAuditReport` | Latest health audit report | `{"format":"summary"}` |
| `getEvolution` | Maturity evolution history | `{"format":"summary"}` |
| `getMandatoryContext` | Full mandatory context for session | `{"format":"markdown","task":"implementation"}` |

### Examples

```bash
# Quick project overview
node scripts/mcp-client.mjs getBriefing '{"format":"summary","depth":"minimal"}'

# Check knowledge debt
node scripts/mcp-client.mjs getKnowledgeDebt '{"format":"summary"}'

# Get challenge alternatives
node scripts/mcp-client.mjs getChallenges '{"format":"summary"}'

# Check what skills are mandatory for a refactor task
node scripts/mcp-client.mjs getSkills '{"task":"refactor"}'

# Get current engineering state
node scripts/mcp-client.mjs getEngineeringState '{}'

# View a specific plan
node scripts/mcp-client.mjs getPlans '{"planName":"PLAN-file-refactor-64-overloaded.md"}'

# Check latest audit report
node scripts/mcp-client.mjs getAuditReport '{"format":"summary"}'

# View maturity evolution over time
node scripts/mcp-client.mjs getEvolution '{"format":"summary"}'
```

## Integration with Freebuff

When Buffy (Freebuff agent) needs project data, it can:
1. Use `basher` agent to run `node scripts/mcp-client.mjs <tool> <args>`
2. Parse the JSON output
3. Use the data for context

This is preferred over reading raw files when the MCP server is available, as the server applies governance rules and context transformations.

## Notes
- Server starts in ~5 seconds
- Each invocation starts a fresh server process
- Output is newline-delimited JSON from the MCP protocol
- The script handles the full MCP handshake automatically
- Tool names are validated before calling (invalid names return an error with available tools)
