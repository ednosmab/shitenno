/**
 * pipeline/stages.ts — Stage builder functions for the default pipeline
 */

import type { ProjectAnalysis } from "../infrastructure/analyser.js";
import type { ComplexityReport } from "../application/scorer.js";
import type { PatternDetectionReport } from "../infrastructure/pattern-detector.js";
import type { KnowledgeDebtReport } from "../application/knowledge-debt.js";
import type { CapabilityEngineResult } from "../application/capability-engine.js";
import type { EngineeringState } from "../application/engineering-state.js";
import type { RecommendationEngineResult } from "../prioritization/recommend.js";
import type { EvolutionReport } from "../application/auto-evolution.js";
import type { PipelineStage } from "../application/pipeline.js";

export function buildCoreStages(
  analyseProject: (root: string) => ProjectAnalysis,
  calculateComplexityScore: (root: string, dir: string, analysis: ProjectAnalysis) => Promise<ComplexityReport>,
  detectPatterns: (root: string, dir: string) => PatternDetectionReport,
  detectKnowledgeDebt: (root: string, dir: string) => KnowledgeDebtReport,
): PipelineStage[] {
  return [
    {
      name: "analysis",
      description: "Detect project structure and stack",
      execute: async (context) => {
        const analysis = analyseProject(context.projectRoot);
        return { ...context, analysis };
      },
    },
    {
      name: "complexity",
      description: "Calculate complexity score and area breakdown",
      execute: async (context) => {
        if (!context.analysis) return context;
        const complexityReport = await calculateComplexityScore(context.projectRoot, context.shitennoDir, context.analysis);
        return { ...context, complexityReport };
      },
    },
    {
      name: "pattern_detection",
      description: "Detect recurring patterns in history and reports",
      execute: async (context) => {
        const patternReport = detectPatterns(context.projectRoot, context.shitennoDir);
        return { ...context, patternReport };
      },
    },
    {
      name: "knowledge_debt",
      description: "Detect knowledge gaps and debt",
      execute: async (context) => {
        const knowledgeDebtReport = detectKnowledgeDebt(context.projectRoot, context.shitennoDir);
        return { ...context, knowledgeDebtReport };
      },
    },
  ];
}

export function buildEvaluationStages(
  consolidateEngineeringState: (root: string, dir: string) => EngineeringState,
  evaluateCapabilities: (state: EngineeringState, dir: string) => CapabilityEngineResult,
  runRecommendationEngine: (options: { state: EngineeringState; capResult: CapabilityEngineResult; shitennoDir: string }) => RecommendationEngineResult,
  analyzeEvolution: (root: string, dir: string) => EvolutionReport,
): PipelineStage[] {
  return [
    {
      name: "capability_engine",
      description: "Evaluate capabilities and their maturity",
      execute: async (context) => {
        const partialState = consolidateEngineeringState(context.projectRoot, context.shitennoDir);
        const capabilityEngineResult = evaluateCapabilities(partialState, context.shitennoDir);
        return { ...context, capabilityEngineResult };
      },
    },
    {
      name: "engineering_state",
      description: "Consolidate all information into canonical state",
      execute: async (context) => {
        const engineeringState = consolidateEngineeringState(context.projectRoot, context.shitennoDir);
        return { ...context, engineeringState };
      },
    },
    {
      name: "recommendation_engine",
      description: "Generate next-best-action recommendations",
      execute: async (context) => {
        if (!context.engineeringState || !context.capabilityEngineResult) return context;
        const recommendationEngineResult = runRecommendationEngine({
          state: context.engineeringState,
          capResult: context.capabilityEngineResult,
          shitennoDir: context.shitennoDir,
        });
        return { ...context, recommendationEngineResult };
      },
    },
    {
      name: "evolution",
      description: "Analyze evolution opportunities and generate report",
      execute: async (context) => {
        const evolutionReport = analyzeEvolution(context.projectRoot, context.shitennoDir);
        return { ...context, evolutionReport };
      },
    },
  ];
}
