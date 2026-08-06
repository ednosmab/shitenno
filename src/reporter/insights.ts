/**
 * reporter/insights.ts — Insight Generation for Performance Reports
 */

import type { PerformanceMetric, DimensionReport, Insight, DimensionExtremes, InsightContext } from "../application/performance-reporter.js";
import { METRIC_LABELS } from "../application/feedback-loops.js";
import type { SessionMetrics } from "../infrastructure/session-tracker.js";
import type { GrowthProfile } from "../infrastructure/growth-profile.js";
import type { TelemetryTrend } from "./telemetry-readers.js";

export function findDimensionExtremes(dimensions: Record<PerformanceMetric, DimensionReport>): DimensionExtremes {
  let maxScore = -1;
  let minScore = 101;
  let strongest: PerformanceMetric | null = null;
  let weakest: PerformanceMetric | null = null;

  for (const [dim, report] of Object.entries(dimensions)) {
    const d = dim as PerformanceMetric;
    if (report.score > maxScore) { maxScore = report.score; strongest = d; }
    if (report.score < minScore) { minScore = report.score; weakest = d; }
  }

  const allTied = maxScore === minScore && maxScore >= 0;
  if (allTied) {
    strongest = null;
    weakest = null;
  }

  return { strongest, weakest, maxScore, minScore, allTied };
}

function addDimensionInsights(
  insights: Insight[],
  dimensions: Record<PerformanceMetric, DimensionReport>,
  extremes: DimensionExtremes
): void {
  if (extremes.strongest) {
    insights.push({
      type: "strength",
      dimension: extremes.strongest,
      text: `Sua força está em ${METRIC_LABELS[extremes.strongest]}. Score: ${extremes.maxScore}/100.`,
      evidence: dimensions[extremes.strongest].evidence[0],
    });
  } else {
    insights.push({
      type: "strength",
      dimension: null,
      text: `Todas as dimensões estão equilibradas com score ${extremes.maxScore}/100.`,
    });
  }

  if (extremes.weakest) {
    insights.push({
      type: "improvement",
      dimension: extremes.weakest,
      text: `Área com mais potencial de melhoria: ${METRIC_LABELS[extremes.weakest]}. Score: ${extremes.minScore}/100.`,
    });
  } else {
    insights.push({
      type: "improvement",
      dimension: null,
      text: "Nenhuma dimensão se destaca como área de melhoria — todas equilibradas.",
    });
  }
}

function addGrowthPatternInsight(insights: Insight[], growthProfile: GrowthProfile): void {
  const pattern = growthProfile.patterns[0];
  if (pattern?.type === "prefers_comfort") {
    insights.push({
      type: "pattern",
      dimension: "decision_making",
      text: "Você tende a escolher o caminho confortável. Tente aceitar 1 recomendação desafiadora por sessão para acelerar crescimento.",
    });
  } else if (pattern?.type === "prefers_growth") {
    insights.push({
      type: "strength",
      dimension: "decision_making",
      text: "Excelente — você busca desafio. Isso acelera aprendizado, mas garanta que não está se sobrecarregando.",
    });
  }
}

function addTrendInsights(insights: Insight[], debtTrend: TelemetryTrend, maturityTrend: TelemetryTrend): void {
  if (debtTrend.delta > 10) {
    insights.push({
      type: "improvement",
      dimension: "architectural_vision",
      text: `Knowledge Debt subiu ${debtTrend.delta} pontos. Considere criar ADRs ou extrair skills dos padrões emergentes.`,
    });
  } else if (debtTrend.delta < -10) {
    insights.push({
      type: "strength",
      dimension: "scope_management",
      text: `Knowledge Debt reduziu ${Math.abs(debtTrend.delta)} pontos. Seu trabalho de governança está surtindo efeito.`,
    });
  }

  if (maturityTrend.delta > 5) {
    insights.push({
      type: "strength",
      dimension: "scope_management",
      text: `Maturidade subiu ${maturityTrend.delta} pontos. Seu projeto está evoluindo bem.`,
    });
  }
}

function addSessionQualityInsights(
  insights: Insight[],
  sessionMetrics: SessionMetrics,
  dimensions: Record<PerformanceMetric, DimensionReport>
): void {
  if (sessionMetrics.avgDuration > 180) {
    insights.push({
      type: "suggestion",
      dimension: "sustainable_velocity",
      text: `Sessões médias de ${Math.round(sessionMetrics.avgDuration / 60)}h. Considere sessões mais curtas (45-90min) para manter foco.`,
    });
  }

  const promptScore = dimensions.prompt_quality?.score || 50;
  if (promptScore < 40) {
    insights.push({
      type: "improvement",
      dimension: "prompt_quality",
      text: "Suas descrições de tarefa podem ser mais claras. Tente: contexto + o que quer + restrições.",
    });
  }
}

export function generateInsights(ctx: InsightContext): Insight[] {
  const insights: Insight[] = [];
  const extremes = findDimensionExtremes(ctx.dimensions);
  addDimensionInsights(insights, ctx.dimensions, extremes);
  addGrowthPatternInsight(insights, ctx.growthProfile);
  addTrendInsights(insights, ctx.debtTrend, ctx.maturityTrend);
  addSessionQualityInsights(insights, ctx.sessionMetrics, ctx.dimensions);
  return insights;
}

export function generateNextSteps(
  insights: Insight[],
  growthProfile: GrowthProfile
): string[] {
  const steps: string[] = [];

  const weakest = insights.find((i) => i.type === "improvement");
  if (weakest?.dimension) {
    steps.push(`Focar em ${METRIC_LABELS[weakest.dimension]} na próxima sessão`);
  }

  const pattern = growthProfile.patterns[0];
  if (pattern?.type === "prefers_comfort") {
    steps.push("Aceitar pelo menos 1 recomendação desafiadora");
  }

  const debtInsight = insights.find((i) => i.dimension === "architectural_vision" && i.type === "improvement");
  if (debtInsight) {
    steps.push("Criar 1 ADR para decisão recente não documentada");
  }

  if (steps.length === 0) {
    steps.push("Manter o ritmo atual — está funcionando");
  }

  return steps.slice(0, 5);
}
