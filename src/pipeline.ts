/**
 * pipeline.ts — Explicit Architectural Pipeline
 *
 * Chains analysis stages into a single, coherent flow.
 * The pipeline is now explicit: Analyser -> Pattern Detection -> Knowledge Debt
 * -> Capability Engine -> Engineering State -> Recommendation Engine -> Auto Evolution
 *
 * PRINCIPLE: Every component feeds the Engineering State.
 * The state drives all decisions.
 */

import { getEventBus } from "./event-bus.js";
import { getHookBus } from "./plugin-system.js";

export { buildCoreStages, buildEvaluationStages } from "./pipeline/stages.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PipelineContext {
  projectRoot: string;
  shitennoDir: string;

  analysis?: import("./analyser.js").ProjectAnalysis;
  complexityReport?: import("./scorer.js").ComplexityReport;
  patternReport?: import("./pattern-detector.js").PatternDetectionReport;
  knowledgeDebtReport?: import("./knowledge-debt.js").KnowledgeDebtReport;
  capabilityEngineResult?: import("./capability-engine.js").CapabilityEngineResult;
  engineeringState?: import("./engineering-state.js").EngineeringState;
  recommendationEngineResult?: import("./prioritization/recommend.js").RecommendationEngineResult;
  evolutionReport?: import("./auto-evolution.js").EvolutionReport;
  healthReport?: import("./health-auditor.js").HealthAuditReport;

  startedAt: string;
  completedAt?: string;
  errors: Array<{ stage: string; error: Error }>;
  stageResults: Array<{ stage: string; duration: number; status: "success" | "failed" | "skipped" }>;
}

export interface PipelineStage {
  name: string;
  description: string;
  execute: (context: PipelineContext) => Promise<PipelineContext>;
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

export class Pipeline {
  private stages: PipelineStage[] = [];

  addStage(stage: PipelineStage): Pipeline {
    this.stages.push(stage);
    return this;
  }

  getStages(): PipelineStage[] {
    return [...this.stages];
  }

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const bus = getEventBus();
    let current = { ...context };

    bus.publish("pipeline.complete", {
      stages: this.stages.map((s) => s.name),
      startedAt: current.startedAt,
    });

    for (const stage of this.stages) {
      current = await this.runStage(stage, current, bus);
    }

    current.completedAt = new Date().toISOString();

    bus.publish("pipeline.complete", {
      stages: this.stages.map((s) => s.name),
      startedAt: current.startedAt,
      completedAt: current.completedAt,
      errors: current.errors.length,
      totalDuration: Date.now() - new Date(current.startedAt).getTime(),
    });

    return current;
  }

  private async runStage(
    stage: PipelineStage,
    context: PipelineContext,
    bus: ReturnType<typeof getEventBus>
  ): Promise<PipelineContext> {
    const stageStart = Date.now();
    const hookBus = getHookBus();
    let current = await hookBus.executeHook("pre-analysis", context, (_plugin, ctx) => ctx);

    bus.publish("pipeline.stage.start", {
      stage: stage.name,
      description: stage.description,
    });

    try {
      current = await stage.execute(current);
      const duration = Date.now() - stageStart;
      const skipped = (current as { __lastStageSkipped?: boolean }).__lastStageSkipped === true;

      current.stageResults.push({
        stage: stage.name,
        duration,
        status: skipped ? "skipped" : "success",
      });

      this.publishStageEvents(stage.name, current, bus);

      current = await hookBus.executeHook("post-analysis", current, (_plugin, ctx) => ctx);

      bus.publish("pipeline.stage.complete", {
        stage: stage.name,
        duration,
        success: true,
      });
    } catch (error) {
      const duration = Date.now() - stageStart;
      const err = error instanceof Error ? error : new Error(String(error));

      current.errors.push({ stage: stage.name, error: err });
      current.stageResults.push({
        stage: stage.name,
        duration,
        status: "failed",
      });

      bus.publish("pipeline.stage.complete", {
        stage: stage.name,
        duration,
        success: false,
        error: err.message,
      });
    }

    return current;
  }

  private publishStageEvents(
    stageName: string,
    context: PipelineContext,
    bus: ReturnType<typeof getEventBus>
  ): void {
    if (stageName === "pattern_detection" && context.patternReport) {
      const patterns = context.patternReport.patterns;
      bus.publish("pattern.detected", {
        patternType: patterns[0]?.type ?? "unknown",
        confidence: patterns.length > 0
          ? patterns.reduce((sum, p) => sum + (p.severity / 5), 0) / patterns.length
          : 0,
        patterns: patterns.map((p) => ({
          type: p.type,
          description: p.description,
          severity: p.severity,
        })),
      });
    }

    if (stageName === "knowledge_debt" && context.knowledgeDebtReport) {
      bus.publish("knowledge_debt.detected", {
        gapCount: context.knowledgeDebtReport.totalGaps,
        gaps: context.knowledgeDebtReport.gaps.map((g) => ({
          source: g.location,
          gap: g.description,
          severity: g.severity,
        })),
      });
    }

    if (stageName === "engineering_state" && context.engineeringState) {
      bus.publish("engineering_state.consolidated", {
        totalDimensions: 7,
        changedDimensions: [],
        overallHealth: context.engineeringState.healthScores.overall,
      });
    }
  }
}

// ── Context Factory ──────────────────────────────────────────────────────────

export function createPipelineContext(
  projectRoot: string,
  shitennoDir: string
): PipelineContext {
  return {
    projectRoot,
    shitennoDir,
    errors: [],
    stageResults: [],
    startedAt: new Date().toISOString(),
  };
}

// ── Default Explicit Pipeline ───────────────────────────────────────────────

export async function createDefaultPipeline(): Promise<Pipeline> {
  const { analyseProject } = await import("./analyser.js");
  const { calculateComplexityScore } = await import("./scorer.js");
  const { detectPatterns } = await import("./pattern-detector.js");
  const { detectKnowledgeDebt } = await import("./knowledge-debt.js");
  const { evaluateCapabilities } = await import("./capability-engine.js");
  const { consolidateEngineeringState } = await import("./engineering-state.js");
  const { runRecommendationEngine } = await import("./prioritization/recommend.js");
  const { analyzeEvolution } = await import("./auto-evolution.js");
  const { buildCoreStages, buildEvaluationStages } = await import("./pipeline/stages.js");

  const pipeline = new Pipeline();
  buildCoreStages(analyseProject, calculateComplexityScore, detectPatterns, detectKnowledgeDebt)
    .forEach((s) => pipeline.addStage(s));
  buildEvaluationStages(consolidateEngineeringState, evaluateCapabilities, runRecommendationEngine, analyzeEvolution)
    .forEach((s) => pipeline.addStage(s));
  return pipeline;
}
