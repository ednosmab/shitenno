/**
 * validation-pipeline.ts — Phase-based Validation Pipeline
 *
 * Runs validation in phases with common gates and phase-specific criteria.
 * Common gate: tests + lint clean, e2e without regression.
 * Phase-specific: benchmark (Fase 1), e2e scenario (Fase 2), load script (Fase 3).
 */

import { execSync } from "node:child_process";
import { logger } from "../shared/logger.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type ValidationPhase = "phase1" | "phase2" | "phase3";

export interface PhaseConfig {
  name: string;
  description: string;
  required: boolean;
  timeout: number; // ms
}

export interface ValidationResult {
  phase: ValidationPhase;
  gate: "common" | "phase-specific";
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

export interface ValidationReport {
  phase: ValidationPhase;
  startedAt: string;
  completedAt: string;
  results: ValidationResult[];
  passed: boolean;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

export type CommandRunner = (cmd: string, timeout: number) => { success: boolean; output: string; duration: number };

// ── Phase Configurations ───────────────────────────────────────────────────

const PHASE_CONFIGS: Record<ValidationPhase, PhaseConfig> = {
  phase1: {
    name: "Phase 1 — Foundation",
    description: "Unit tests, lint, type-check, new benchmarks",
    required: true,
    timeout: 180_000,
  },
  phase2: {
    name: "Phase 2 — Integration",
    description: "E2E tests, integration scenarios, regression checks",
    required: true,
    timeout: 180_000,
  },
  phase3: {
    name: "Phase 3 — Performance",
    description: "Load tests, benchmarks, performance regressions",
    required: false,
    timeout: 300_000,
  },
};

// ── Default Command Runner ─────────────────────────────────────────────────

function defaultRunCommand(cmd: string, timeout: number): { success: boolean; output: string; duration: number } {
  const start = Date.now();
  try {
    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { success: true, output, duration: Date.now() - start };
  } catch (err) {
    const duration = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, output: error, duration };
  }
}

// ── Common Gates ───────────────────────────────────────────────────────────

function runCommonGate(timeout: number, runCmd: CommandRunner): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Gate 1: Unit tests pass (e2e is covered by Phase 2)
  const testResult = runCmd("pnpm run test:unit", timeout);
  results.push({
    phase: "phase1",
    gate: "common",
    name: "tests-pass",
    passed: testResult.success,
    duration: testResult.duration,
    error: testResult.success ? undefined : testResult.output.slice(0, 500),
  });

  // Gate 2: Lint clean
  const lintResult = runCmd("pnpm run lint", timeout);
  results.push({
    phase: "phase1",
    gate: "common",
    name: "lint-clean",
    passed: lintResult.success,
    duration: lintResult.duration,
    error: lintResult.success ? undefined : lintResult.output.slice(0, 500),
  });

  // Gate 3: Type-check clean
  const typeResult = runCmd("pnpm run typecheck", timeout);
  results.push({
    phase: "phase1",
    gate: "common",
    name: "typecheck-clean",
    passed: typeResult.success,
    duration: typeResult.duration,
    error: typeResult.success ? undefined : typeResult.output.slice(0, 500),
  });

  return results;
}

// ── Phase-Specific Gates ───────────────────────────────────────────────────

const PHASE_SPECIFIC_GATES: Record<ValidationPhase, ReadonlyArray<{ name: string; command: string }>> = {
  phase1: [{ name: "benchmark-runs", command: "pnpm run bench" }],
  phase2: [{ name: "e2e-scenario", command: "pnpm run test:e2e" }],
  phase3: [{ name: "load-test", command: "pnpm run test:load" }],
};

function runPhaseGate(
  phase: ValidationPhase,
  name: string,
  command: string,
  runCmd: CommandRunner,
): ValidationResult {
  const result = runCmd(command, PHASE_CONFIGS[phase].timeout);
  return {
    phase,
    gate: "phase-specific",
    name,
    passed: result.success,
    duration: result.duration,
    error: result.success ? undefined : result.output.slice(0, 500),
  };
}

function runPhaseSpecificGates(phase: ValidationPhase, runCmd: CommandRunner): ValidationResult[] {
  return PHASE_SPECIFIC_GATES[phase].map((gate) => runPhaseGate(phase, gate.name, gate.command, runCmd));
}

// ── Public API ─────────────────────────────────────────────────────────────

export function runValidationPhase(
  phase: ValidationPhase,
  runCmd: CommandRunner = defaultRunCommand,
): ValidationReport {
  const config = PHASE_CONFIGS[phase];
  const startedAt = new Date().toISOString();
  
  logger.info("validation-pipeline", `Starting ${config.name}`);

  const results: ValidationResult[] = [];

  // Run common gates (only for phase1 to avoid redundancy)
  if (phase === "phase1") {
    results.push(...runCommonGate(config.timeout, runCmd));
  }

  // Run phase-specific gates
  results.push(...runPhaseSpecificGates(phase, runCmd));

  const completedAt = new Date().toISOString();
  const passed = results.every((r) => r.passed || !config.required);

  const report: ValidationReport = {
    phase,
    startedAt,
    completedAt,
    results,
    passed,
    summary: {
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
    },
  };

  logger.info(
    "validation-pipeline",
    `${config.name}: ${report.summary.passed}/${report.summary.total} passed`,
  );

  return report;
}

export function runFullValidation(runCmd: CommandRunner = defaultRunCommand): ValidationReport[] {
  const phases: ValidationPhase[] = ["phase1", "phase2", "phase3"];
  return phases.map((phase) => runValidationPhase(phase, runCmd));
}

export function getPhaseConfig(phase: ValidationPhase): PhaseConfig {
  return { ...PHASE_CONFIGS[phase] };
}
