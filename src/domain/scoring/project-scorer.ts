import { join } from "node:path";
import { getEventBus } from "../../event-bus.js";
import { FileContentCache } from "../../utils.js";
import type { ProjectAnalysis } from "../../analyser.js";
import type { AreaScore, ComplexityReport } from "../entities/engineering-state.js";
import type { ProjectProfile } from "./profile-loader.js";
import { batchScoreArea, batchGitChurn, preReadHistory, countContextPressure, type AreaMetrics } from "./area-scorer.js";

function normalize(value: number, thresholds: number[]): number {
  for (let i = 0; i < thresholds.length; i++) {
    const t = thresholds[i];
    if (t !== undefined && value <= t) return i;
  }
  return thresholds.length;
}

function normalizeReverse(value: number, thresholds: number[]): number {
  for (let i = 0; i < thresholds.length; i++) {
    const t = thresholds[i];
    if (t !== undefined && value >= t) return thresholds.length - i;
  }
  return 0;
}

interface ScoreInputs {
  churn: number;
  violations: number;
  incidentFreeAge: number;
  contextPressure: number;
}

function calculateRawScore(m: AreaMetrics, inp: ScoreInputs, w: Record<string, number | undefined>): number {
  const churnNorm = normalize(inp.churn, [0, 5, 20]);
  const violationsNorm = normalize(inp.violations, [0, 1, 3]);
  const sensitiveNorm = normalize(m.sensitiveSurface, [0, 2, 5]);
  const filesNorm = m.fileCount >= 100 ? 2 : m.fileCount >= 30 ? 1 : 0;
  const depsNorm = normalize(m.dependencyDepth, [0, 5, 15]);
  const ageNorm = normalizeReverse(inp.incidentFreeAge, [0, 3, 10]);
  const pressureNorm = normalize(inp.contextPressure, [0, 50, 200]);

  const rawScore =
    churnNorm * (w.churn || 1) +
    violationsNorm * (w.violationRate || 1) +
    sensitiveNorm * (w.sensitiveSurface || 1) +
    filesNorm +
    depsNorm * 0.5 +
    ageNorm * 0.5 +
    pressureNorm * 0.5;

  return Math.min(10, Math.round(rawScore * 10) / 10);
}

function buildAreaEvidence(m: AreaMetrics, inp: ScoreInputs, churnWindowDays: number): string {
  const parts: string[] = [];
  if (m.fileCount > 0) parts.push(`${m.fileCount} files`);
  if (inp.churn > 0) parts.push(`${inp.churn} commits/${churnWindowDays}d`);
  if (m.sensitiveSurface > 0) parts.push(`${m.sensitiveSurface} sensitive keywords`);
  if (inp.violations > 0) parts.push(`${inp.violations} violations`);
  if (m.dependencyDepth > 0) parts.push(`${m.dependencyDepth} cross-area imports`);
  if (inp.incidentFreeAge > 0) parts.push(`${inp.incidentFreeAge} sessions since last incident`);
  if (inp.contextPressure > 0) parts.push(`${inp.contextPressure}KB P2 docs`);
  return parts.join(", ") || "no activity detected";
}



export function calculateAreaScores(
  projectRoot: string,
  shitennoDir: string,
  profile: ProjectProfile,
  cache: FileContentCache
): Promise<AreaScore[]> {
  const churnMap = batchGitChurn(projectRoot, profile.areas, profile.churnWindowDays);
  const history = preReadHistory(shitennoDir, profile.areas, profile.violationKeywords);
  const metricsMap = new Map<string, AreaMetrics>();

  const toScore = (am: { area: string; metrics: AreaMetrics }): AreaScore | null => {
    const m = metricsMap.get(am.area);
    if (!m) return null;
    const inp: ScoreInputs = {
      churn: churnMap.get(am.area) || 0,
      violations: history.violationsByArea.get(am.area) || 0,
      incidentFreeAge: history.incidentFreeAgeByArea.get(am.area) || 0,
      contextPressure: countContextPressure(projectRoot, am.area),
    };
    const score = calculateRawScore(m, inp, profile.weights);
    let level: "junior" | "pleno" | "senior" = "junior";
    if (score >= 6) level = "senior";
    else if (score >= 3) level = "pleno";
    return {
      area: am.area, score, level,
      fileCount: m.fileCount, churn: inp.churn, sensitiveSurface: m.sensitiveSurface,
      violations: inp.violations, dependencyDepth: m.dependencyDepth,
      incidentFreeAge: inp.incidentFreeAge, contextPressure: inp.contextPressure,
      evidence: buildAreaEvidence(m, inp, profile.churnWindowDays),
    };
  };

  const areaMetricsPromises = profile.areas.map((area) => {
    const areaPath = join(projectRoot, area);
    return new Promise<{ area: string; metrics: AreaMetrics }>((resolve) => {
      setImmediate(() => {
        resolve({
          area,
          metrics: batchScoreArea(areaPath, profile.areas, profile.sensitiveKeywords, cache),
        });
      });
    });
  });

  return Promise.all(areaMetricsPromises).then((areaMetrics) => {
    for (const { area, metrics } of areaMetrics) metricsMap.set(area, metrics);
    return areaMetrics.map(toScore).filter((r): r is AreaScore => r !== null);
  });
}

function buildUpgradeSuggestions(level: string, suggestions: string[]): void {
  if (level === "junior") return;
  if (suggestions.some((s) => s.includes("upgrade"))) return;
  const msg = level === "senior"
    ? "Your project complexity suggests high complexity. Run: shugo upgrade --list"
    : "Your project complexity suggests moderate complexity. Run: shugo upgrade --list";
  suggestions.push(msg);
}

function buildHotAreaSuggestions(areaScores: AreaScore[], suggestions: string[]): void {
  const hotAreas = areaScores.filter((a) => a.score >= 6);
  if (hotAreas.length === 0) return;
  suggestions.push(
    `High-complexity areas: ${hotAreas.map((a) => `${a.area} (${a.score})`).join(", ")} — consider governance focus here`
  );
}

export function scoreProject(
  _analysis: ProjectAnalysis,
  staticMetrics: import("../entities/engineering-state.js").StaticMetric[],
  behavioralMetrics: import("../entities/engineering-state.js").BehavioralMetric[],
  areaScores: AreaScore[]
): ComplexityReport {
  const staticScore = staticMetrics.reduce((sum, m) => sum + m.score, 0);
  const behaviorScore = behavioralMetrics.reduce((sum, m) => sum + m.score, 0);
  const totalScore = staticScore + behaviorScore;

  const reasons: string[] = [
    ...staticMetrics.filter((m) => m.score > 0).map((m) => m.evidence),
    ...behavioralMetrics.filter((m) => m.score > 0).map((m) => m.evidence),
  ];

  const suggestions: string[] = behavioralMetrics
    .filter((m) => m.suggestion)
    .map((m) => m.suggestion!);

  let level: "junior" | "pleno" | "senior" = "junior";
  if (totalScore >= 10) level = "senior";
  else if (totalScore >= 5) level = "pleno";

  buildUpgradeSuggestions(level, suggestions);
  buildHotAreaSuggestions(areaScores, suggestions);

  const report = {
    score: totalScore,
    level,
    staticScore,
    behaviorScore,
    reasons,
    suggestions,
    staticMetrics,
    behavioralMetrics,
    computedAt: new Date().toISOString(),
    areaScores,
  };

  getEventBus().publish("score.calculated", {
    projectId: "",
    score: totalScore,
    timestamp: new Date().toISOString(),
  });

  return report;
}
