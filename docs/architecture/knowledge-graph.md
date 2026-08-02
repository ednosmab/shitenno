---
category: architecture
lifecycle: Active
---

# 14 — KNOWLEDGE GRAPH

> Artifacts, relations, graph analysis.

## The Graph Model

Shugo models knowledge as a directed graph. Artifacts are nodes. Relations are edges.

## Artifact Types (14)

| Type | Description | Source |
|------|-------------|--------|
| `adr` | Architecture Decision Record | `docs/adrs/` |
| `skill` | Reusable engineering pattern | `docs/skills/` |
| `contract` | AI agent governance contract | `governance/agents/` |
| `workflow` | Defined workflow process | `governance/WORKFLOW.md` |
| `runbook` | Step-by-step procedure | `docs/runbooks/` |
| `plan` | Execution plan | `governance/plans/` |
| `sdr` | Solution Decision Record | `docs/sdr/` |
| `doc` | General documentation | `docs/` |
| `script` | Automation script | `scripts/` |
| `template` | Reusable template | `docs/*/TEMPLATE*` |
| `feedback` | Session feedback | `docs/feedback/` |
| `report` | Analysis report | `reports/` |
| `code` | Source code | `src/` |
| `config` | Configuration file | root |

## Relation Types (14)

| Relation | Description |
|----------|-------------|
| `generates` | A produces B |
| `uses` | A depends on B |
| `executes` | A runs B |
| `produces` | A creates B |
| `references` | A mentions B |
| `implements` | A realizes B |
| `validates` | A checks B |
| `documents` | A describes B |
| `depends_on` | A requires B |
| `supersedes` | A replaces B |
| `extends` | A builds on B |
| `triggers` | A causes B |
| `reviews` | A evaluates B |
| `creates` | A generates B |

## The Artifact Interface

```typescript
interface Artifact {
  id: string;
  type: ArtifactType;
  name: string;
  path: string;
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  status: "active" | "archived" | "draft";
}
```

## The Relation Interface

```typescript
interface Relation {
  source: string;  // Artifact ID
  target: string;  // Artifact ID
  type: RelationType;
  description: string;
  createdAt: string;
}
```

## Discovery

### Artifact Discovery

Artifacts are auto-discovered by scanning the filesystem:

```typescript
function discoverArtifacts(shitennoDir: string): Artifact[] {
  const artifacts: Artifact[] = [];
  
  // Scan ADRs
  // Scan Skills
  // Scan Contracts
  // Scan Workflows
  // Scan Runbooks
  // Scan Plans
  // Scan Scripts
  // Scan Docs
  
  return artifacts;
}
```

### Relation Discovery

Relations are inferred from artifact type heuristics:

| Source Type | Target Type | Relation | Heuristic |
|------------|------------|----------|-----------|
| ADR | Skill | generates | Name matching (first 2 words) |
| Skill | Contract | uses | All skills → all contracts |
| Contract | Script | executes | All contracts → all scripts |
| Workflow | ADR | references | Workflow → all ADRs |
| Doc | Code/Script | documents | Docs → all code/scripts |

## Graph Analysis

### Health Score

```typescript
function calculateGraphHealth(graph: GraphAnalysis): number {
  let score = 100;
  
  // Penalize orphan ratio (max -30%)
  const orphanRatio = graph.orphanArtifacts.length / graph.totalArtifacts;
  score -= orphanRatio * 30;
  
  // Penalize cycles (-10 each)
  score -= graph.cycles.length * 10;
  
  // Bonus for relation diversity (+10 max)
  const relationTypes = new Set(graph.relations.map(r => r.type));
  score += Math.min(relationTypes.size, 10);
  
  // Bonus for average connections (+10 max)
  const avgConnections = graph.totalRelations / graph.totalArtifacts;
  score += Math.min(avgConnections, 10);
  
  return Math.max(0, Math.min(100, score));
}
```

### Analysis Capabilities

| Function | Description |
|----------|-------------|
| `analyzeGraph()` | Full graph analysis with health score |
| `detectCycles()` | DFS-based cycle detection |
| `findOrphans()` | Artifacts with no relations |
| `findHubs()` | Artifacts with many relations |
| `generateSuggestions()` | Improvement recommendations |

## Storage

The graph is stored as two JSON files:

```
governance/knowledge-graph/
├── artifacts.json    # All artifact nodes
└── relations.json    # All relation edges
```

## Visualization

```typescript
function graphToText(graph: GraphAnalysis): string {
  // Groups artifacts by type
  // Shows incoming/outgoing relations with arrows
  // Highlights orphans and hubs
}
```

## Implementation

- **Discovery:** `discoverArtifacts()` in `src/knowledge-graph.ts:162`
- **Relation discovery:** `discoverRelations()` in `src/knowledge-graph.ts:331`
- **Analysis:** `analyzeGraph()` in `src/knowledge-graph.ts:423`
- **Cycle detection:** `detectCycles()` in `src/knowledge-graph.ts:486`
- **Health score:** `calculateGraphHealth()` in `src/knowledge-graph.ts:532`
- **Storage:** `saveGraph()` / `loadGraph()` in `src/knowledge-graph.ts`

## Current Status

The knowledge graph module is **implemented but not integrated**. It is 639 lines of code that no CLI command currently imports. Integration with the event bus (Phase 3) will connect it to the rest of the system.
