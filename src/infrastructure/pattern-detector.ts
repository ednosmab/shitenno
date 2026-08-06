/**
 * pattern-detector.ts — Fase 2: Extracao de Padrao
 *
 * Le o historico acumulado (docs/history/) e relatorios (reports/)
 * para detectar recorrencia — mesmo tipo de erro, mesma violacao,
 * mesma decisao revertida — e propor regras candidatas.
 *
 * PRINCIPIO: Este modulo SO PROPOE, nunca aplica.
 * A aprovacao de mudanca de regra e sempre manual, sempre do Tech Lead.
 */

import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DetectedPattern, CandidateRule, PatternDetectionReport } from "../domain/entities/engineering-state.js";
import { readHistoryEntries } from "../pattern-detector/history.js";
import { readRecentReports, detectRecurringErrors, detectRevertedDecisions, detectHotAreas } from "../pattern-detector/detectors.js";
import { proposeRules } from "../pattern-detector/rules.js";

export type { DetectedPattern, CandidateRule, PatternDetectionReport } from "../domain/entities/engineering-state.js";

function generateSummary(
  patterns: DetectedPattern[],
  rules: CandidateRule[],
  historyCount: number,
  reportCount: number
): string {
  if (patterns.length === 0) {
    return `Analise de ${historyCount} entradas de historico e ${reportCount} relatorios. Nenhum padrao significativo detectado.`;
  }

  const highSeverity = patterns.filter((p) => p.severity >= 4);
  const parts: string[] = [];
  parts.push(`${patterns.length} padrao(es) detectado(s) em ${historyCount} entradas de historico e ${reportCount} relatorios.`);
  if (highSeverity.length > 0) parts.push(`${highSeverity.length} de severidade alta — atencao urgente recomendada.`);
  if (rules.length > 0) parts.push(`${rules.length} regra(s) candidata(s) proposta(s) para aprovacao do Tech Lead.`);
  return parts.join(" ");
}

export function detectPatterns(
  _projectRoot: string,
  shitennoDir: string
): PatternDetectionReport {
  const historyEntries = readHistoryEntries(shitennoDir);
  const reports = readRecentReports(shitennoDir);

  const patterns: DetectedPattern[] = [
    ...detectRecurringErrors(historyEntries),
    ...detectRevertedDecisions(historyEntries),
    ...detectHotAreas(reports),
  ];

  const candidateRules = proposeRules(patterns);
  const summary = generateSummary(patterns, candidateRules, historyEntries.length, reports.length);

  return {
    detectedAt: new Date().toISOString(),
    historyEntriesAnalyzed: historyEntries.length,
    reportsAnalyzed: reports.length,
    patterns,
    candidateRules,
    summary,
  };
}

export function writePatternReport(
  shitennoDir: string,
  report: PatternDetectionReport
): string | null {
  const reportsDir = join(shitennoDir, "reports");
  if (!existsSync(reportsDir)) return null;

  const date = new Date().toISOString().slice(0, 10);
  const filename = `patterns-${date}.json`;
  const filepath = join(reportsDir, filename);

  try {
    writeFileSync(filepath, JSON.stringify(report, null, 2), "utf-8");
    return filename;
  } catch {
    return null;
  }
}
