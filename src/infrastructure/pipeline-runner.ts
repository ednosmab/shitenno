/**
 * pipeline-runner.ts — Persisted pipeline run state.
 *
 * Stores validation pipeline reports in `.shitenno/reports/pipeline-history.json`
 * so that shell consumers (`pipeline exec`, `pipeline status`, `pipeline notify`)
 * can chain on exit codes and read the latest run state.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  runFullValidation,
  runValidationPhase,
  type CommandRunner,
  type ValidationPhase,
  type ValidationReport,
} from "./validation-pipeline.js";

const MAX_HISTORY = 20;

export interface StoredPipelineReport {
  timestamp: string;
  report: ValidationReport;
}

export function getPipelineHistoryPath(shitennoDir: string): string {
  return join(shitennoDir, "reports", "pipeline-history.json");
}

function loadHistory(shitennoDir: string): StoredPipelineReport[] {
  const path = getPipelineHistoryPath(shitennoDir);
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as { runs?: StoredPipelineReport[] };
    return Array.isArray(parsed.runs) ? parsed.runs : [];
  } catch {
    return [];
  }
}

export function savePipelineReport(shitennoDir: string, report: ValidationReport): void {
  const runs = loadHistory(shitennoDir);
  runs.push({ timestamp: new Date().toISOString(), report });

  const trimmed = runs.slice(-MAX_HISTORY);
  const dir = join(shitennoDir, "reports");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(getPipelineHistoryPath(shitennoDir), JSON.stringify({ runs: trimmed }, null, 2));
}

export function loadLatestPipelineReport(shitennoDir: string): StoredPipelineReport | null {
  const runs = loadHistory(shitennoDir);
  return runs[runs.length - 1] ?? null;
}

export interface PipelineExecResult {
  reports: ValidationReport[];
  allPassed: boolean;
}

export function runPipelineExec(
  shitennoDir: string,
  options: { phase?: string; runner?: CommandRunner } = {},
): PipelineExecResult {
  const runner = options.runner;
  const reports: ValidationReport[] = [];

  if (options.phase) {
    const phase = options.phase as ValidationPhase;
    const report = runValidationPhase(phase, runner);
    reports.push(report);
  } else {
    reports.push(...runFullValidation(runner));
  }

  for (const report of reports) {
    savePipelineReport(shitennoDir, report);
  }

  return { reports, allPassed: reports.every((r) => r.passed) };
}
