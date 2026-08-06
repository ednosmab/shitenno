import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ProjectAnalysis } from "../infrastructure/analyser.js";
import { FileContentCache } from "../infrastructure/utils.js";
import { NodeFileSystem } from "../infrastructure/adapters/node-file-system.js";

// ── Types (re-exported from domain entities) ────────────────────────────────

import type { ComplexityReport } from "../domain/entities/engineering-state.js";

export type {
  StaticMetric,
  BehavioralMetric,
  AreaScore,
  ComplexityReport,
} from "../domain/entities/engineering-state.js";

// ── Re-exports from domain/scoring/ ─────────────────────────────────────────

export { loadProjectProfile, type ProjectProfile } from "../domain/scoring/profile-loader.js";
export {
  collectStaticMetrics,
  collectBehavioralMetrics,
  batchScoreArea,
  batchGitChurn,
  countContextPressure,
} from "../domain/scoring/area-scorer.js";
export { scoreProject, calculateAreaScores } from "../domain/scoring/project-scorer.js";

// ── Import extracted functions ──────────────────────────────────────────────

import { loadProjectProfile } from "../domain/scoring/profile-loader.js";
import { collectStaticMetrics, collectBehavioralMetrics } from "../domain/scoring/area-scorer.js";
import { calculateAreaScores, scoreProject } from "../domain/scoring/project-scorer.js";

// ── Main Scoring Function ───────────────────────────────────────────────────

/**
 * Calcula o score de complexidade de um projeto (0-20+).
 *
 * Combina métricas estáticas (packages, files, deps) com métricas
 * comportamentais (bug fixes, branches, commits) para gerar um
 * score composto com nível recomendado (junior/pleno/senior).
 *
 * @param projectRoot - Diretório raiz do projeto
 * @param shitennoDir - Caminho para shitenno/
 * @param analysis - Resultado de analyseProject()
 * @returns Relatório completo de complexidade com scores por área
 */
export async function calculateComplexityScore(
  projectRoot: string,
  shitennoDir: string,
  analysis: ProjectAnalysis
): Promise<ComplexityReport> {
  const staticMetrics = collectStaticMetrics(analysis);
  const behavioralMetrics = collectBehavioralMetrics(projectRoot, shitennoDir);

  const profile = loadProjectProfile(projectRoot, new NodeFileSystem());
  const areaScores = profile
    ? await calculateAreaScores(projectRoot, shitennoDir, profile, new FileContentCache())
    : [];

  return scoreProject(analysis, staticMetrics, behavioralMetrics, areaScores);
}

// ── Report Writer ────────────────────────────────────────────────────────────

/**
 * Grava um relatório JSON em reports/ após cada scoring.
 * Convenção: complexity-<projectName>-<YYYY-MM-DD>-session<N>.json
 */
export function writeComplexityReport(
  projectRoot: string,
  shitennoDir: string,
  report: ComplexityReport
): string | null {
  const reportsDir = join(shitennoDir, "reports");
  if (!existsSync(reportsDir)) {
    return null;
  }

  const dirName = projectRoot.split(/[/\\]/).pop() || "unknown";
  const projectName = dirName.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const date = new Date().toISOString().slice(0, 10);

  const existing = readdirSync(reportsDir).filter(
    (f) => f.startsWith(`complexity-${projectName}-${date}`)
  );
  const sessionNum = existing.length + 1;

  const filename = `complexity-${projectName}-${date}-session${sessionNum}.json`;
  const filepath = join(reportsDir, filename);

  const reportData = {
    projectName,
    computedAt: report.computedAt,
    score: report.score,
    level: report.level,
    staticScore: report.staticScore,
    behaviorScore: report.behaviorScore,
    staticMetrics: report.staticMetrics,
    behavioralMetrics: report.behavioralMetrics,
    areaScores: report.areaScores,
    reasons: report.reasons,
    suggestions: report.suggestions,
  };

  try {
    writeFileSync(filepath, JSON.stringify(reportData, null, 2), "utf-8");
    return filename;
  } catch {
    return null;
  }
}
