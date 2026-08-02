---
category: architecture
lifecycle: Active
---

# 16 — PIPELINE ENGINE

> Command orchestration — pipeline as first-class.

## The Problem

Today, each Shugo command runs independently. `shugo status` scores and writes a report. `shugo detect` reads reports and detects patterns. `shugo audit` reads rules and checks health. But there's no orchestration — each command is a standalone tool.

The pipeline engine chains these stages into a single, coherent analysis.

## Architecture

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ ANALYZE  │ →  │  SCORE   │ →  │  DETECT  │ →  │  AUDIT   │ →  │ EVOLVE   │
│          │    │          │    │          │    │          │    │          │
│ Stack    │    │ Static   │    │ Patterns │    │ Health   │    │ Recommend│
│ Structure│    │ Behavioral│   │ Hot areas│    │ Dead rule│    │ Next best│
│ Git      │    │ Per-area │    │ Reverted │    │ Missing  │    │ action   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │               │
     └───────────────┴───────────────┴───────────────┴───────────────┘
                                 │
                         PipelineContext
                    (shared state between stages)
```

## The Pipeline Context

Each stage reads from and writes to a shared context:

```typescript
interface PipelineContext {
  projectRoot: string;
  shitennoDir: string;
  
  // Stage outputs
  analysis?: ProjectAnalysis;
  complexityReport?: ComplexityReport;
  patternReport?: PatternDetectionReport;
  healthReport?: HealthAuditReport;
  evolutionReport?: EvolutionReport;
  
  // Metadata
  startedAt: string;
  completedAt?: string;
  errors: Array<{ stage: string; error: Error }>;
}
```

## Stage Interface

```typescript
interface PipelineStage {
  name: string;
  description: string;
  execute: (context: PipelineContext) => Promise<PipelineContext>;
}
```

## The Stages

### 1. Analyze

```typescript
const analyzeStage: PipelineStage = {
  name: "analyze",
  description: "Analyze project structure",
  execute: async (ctx) => {
    ctx.analysis = analyseProject(ctx.projectRoot);
    return ctx;
  },
};
```

### 2. Score

```typescript
const scoreStage: PipelineStage = {
  name: "score",
  description: "Calculate complexity score",
  execute: async (ctx) => {
    if (!ctx.analysis) throw new Error("Analysis required");
    ctx.complexityReport = await calculateComplexityScore(ctx.projectRoot, ctx.shitennoDir);
    return ctx;
  },
};
```

### 3. Detect

```typescript
const detectStage: PipelineStage = {
  name: "detect",
  description: "Detect patterns from history",
  execute: async (ctx) => {
    ctx.patternReport = await detectPatterns(ctx.shitennoDir);
    return ctx;
  },
};
```

### 4. Audit

```typescript
const auditStage: PipelineStage = {
  name: "audit",
  description: "Audit governance health",
  execute: async (ctx) => {
    ctx.healthReport = await auditHealth(ctx.shitennoDir);
    return ctx;
  },
};
```

### 5. Evolve

```typescript
const evolveStage: PipelineStage = {
  name: "evolve",
  description: "Generate evolution recommendations",
  execute: async (ctx) => {
    ctx.evolutionReport = await analyzeEvolution(ctx.projectRoot);
    return ctx;
  },
};
```

## Pipeline Execution

```typescript
class Pipeline {
  private stages: PipelineStage[] = [];

  addStage(stage: PipelineStage): Pipeline {
    this.stages.push(stage);
    return this;
  }

  async execute(context: PipelineContext): Promise<PipelineContext> {
    let current = { ...context };
    
    for (const stage of this.stages) {
      try {
        current = await stage.execute(current);
      } catch (error) {
        current.errors.push({ stage: stage.name, error: error as Error });
        // Continue with other stages
      }
    }
    
    current.completedAt = new Date().toISOString();
    return current;
  }
}
```

## Usage

```typescript
import { Pipeline } from "./pipeline.js";

const pipeline = new Pipeline()
  .addStage(analyzeStage)
  .addStage(scoreStage)
  .addStage(detectStage)
  .addStage(auditStage)
  .addStage(evolveStage);

const result = await pipeline.execute({
  projectRoot: "/path/to/project",
  shitennoDir: "/path/to/project/shitenno",
  errors: [],
  startedAt: new Date().toISOString(),
});

console.log(`Pipeline completed with ${result.errors.length} errors`);
console.log(`Complexity: ${result.complexityReport?.overallScore}`);
console.log(`Health: ${result.healthReport?.healthScore}`);
console.log(`Recommendations: ${result.evolutionReport?.totalRecommendations}`);
```

## Event Integration

The pipeline publishes events at each stage:

```typescript
const bus = getEventBus();

// Before each stage
bus.publish("pipeline.stage.start", { stage: stage.name });

// After each stage
bus.publish("pipeline.stage.complete", { 
  stage: stage.name, 
  duration: Date.now() - start 
});

// After all stages
bus.publish("pipeline.complete", { 
  result, 
  totalDuration: Date.now() - pipelineStart 
});
```

## Error Handling

- Stage errors are caught and recorded in `context.errors`
- Pipeline continues even if a stage fails
- Errors are reported at the end
- Events are published for failed stages

## Performance

- Stages run sequentially (data dependencies)
- Each stage is independent (no shared mutable state)
- Context is immutable between stages

## Implementation

- **File:** `src/pipeline.ts` (~250 lines)
- **Stages:** `src/pipeline-stages/` (one file per stage)
- **Integration:** `src/commands/run.ts` (new command)
