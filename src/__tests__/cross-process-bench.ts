/**
 * Cross-process cache benchmark (Fase 1 — LIVING-001)
 *
 * Measures: cold consolidation vs disk cache hit for small/medium/large fixtures.
 * Run: npx tsx src/__tests__/cross-process-bench.ts
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scaffoldShitenno } from "../infrastructure/scaffolder.js";
import { getEngineeringState, clearEngineeringStateCache } from "../engineering-state/index.js";
import type { UserAnswers } from "../interface/cli/prompts.js";
import type { Capability } from "../application/maturity-profile.js";

const BASE_ANSWERS: UserAnswers = {
  principalModel: "opencode/mimo-v2.5-free",
  executorModel: "opencode/deepseek-v4-flash-free",
  stack: ["react", "typescript"],
  database: "PostgreSQL",
  styling: "Tailwind CSS",
  maturity: {
    usedShitennoBefore: true, isFirstProject: false, projectAge: "mature", teamSize: "medium",
    hasDedicatedTeam: true, hasArchitectureDocs: true, hasADRs: true, hasTechnicalReviews: true,
    hasCICD: true, hasAutomatedTests: true, hasValidationPipeline: true,
    intendsToUseAI: true, aiWillImplement: true, requiresHumanReview: true,
    hasDefinedPatterns: true, hasReviewProcess: true, hasDecisionControl: true,
  },
};
const SENIOR_CAPS: Capability[] = ["core", "knowledge", "architecture", "governance", "ai", "quality", "metrics", "operations", "compliance"];

function createFixture(label: string, opts: { sourceFileCount: number; historyEntries: number; reportCount: number; areas: number }) {
  const dir = join(tmpdir(), `shitenno-bench-${label}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: `bench-${label}`, version: "1.0.0", dependencies: { react: "^18.0.0" } }, null, 2));

  const areas = Array.from({ length: opts.areas }, (_, i) => `src/area-${i}`);
  const filesPerArea = Math.ceil(opts.sourceFileCount / opts.areas);
  for (const area of areas) {
    const areaDir = join(dir, area);
    mkdirSync(areaDir, { recursive: true });
    for (let f = 0; f < filesPerArea; f++) {
      const lines = Array.from({ length: 20 }, (_, i) => `export function func_${f}_${i}() { return ${i}; }`);
      writeFileSync(join(areaDir, `file-${f}.ts`), lines.join("\n"));
    }
  }

  scaffoldShitenno(dir, BASE_ANSWERS, SENIOR_CAPS);
  return { dir, shitennoDir: join(dir, "shitenno") };
}

function benchTime(fn: () => void, iterations = 50): { avg: number; min: number; max: number; p75: number } {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const p75Idx = Math.floor(times.length * 0.75);
  return {
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    min: times[0]!,
    max: times[times.length - 1]!,
    p75: times[p75Idx]!,
  };
}

console.log("=== Cross-process Cache Benchmark (Fase 1 — LIVING-001) ===\n");
console.log("Target: prove that disk cache read + freshness check is faster than full consolidation.\n");

const results: Array<{ label: string; coldMs: number; cachedMs: number; speedup: number }> = [];

for (const [label, opts] of [
  ["small", { sourceFileCount: 20, historyEntries: 5, reportCount: 3, areas: 3 }] as const,
  ["medium", { sourceFileCount: 100, historyEntries: 30, reportCount: 10, areas: 8 }] as const,
  ["large", { sourceFileCount: 500, historyEntries: 100, reportCount: 50, areas: 20 }] as const,
]) {
  const fixture = createFixture(`cache-${label}`, opts);

  // Pre-populate disk cache (simulate process A writing)
  clearEngineeringStateCache();
  getEngineeringState(fixture.dir, fixture.shitennoDir, true);

  // Benchmark cold consolidation (forceRefresh=true — no cache at all)
  const cold = benchTime(() => {
    clearEngineeringStateCache();
    getEngineeringState(fixture.dir, fixture.shitennoDir, true);
  });

  // Benchmark disk cache hit (forceRefresh=false — reads from disk)
  const cached = benchTime(() => {
    clearEngineeringStateCache();
    getEngineeringState(fixture.dir, fixture.shitennoDir, false);
  });

  const speedup = cold.avg / cached.avg;
  results.push({ label, coldMs: cold.avg, cachedMs: cached.avg, speedup });

  console.log(`${label} (${opts.sourceFileCount} files, ${opts.areas} areas):`);
  console.log(`  Cold consolidation:  avg ${cold.avg.toFixed(2)}ms  (min ${cold.min.toFixed(2)} | p75 ${cold.p75.toFixed(2)} | max ${cold.max.toFixed(2)})`);
  console.log(`  Disk cache hit:      avg ${cached.avg.toFixed(2)}ms  (min ${cached.min.toFixed(2)} | p75 ${cached.p75.toFixed(2)} | max ${cached.max.toFixed(2)})`);
  console.log(`  Speedup:             ${speedup.toFixed(1)}x`);
  console.log();

  rmSync(fixture.dir, { recursive: true, force: true });
}

console.log("=== Verdict ===");
const allFaster = results.every(r => r.speedup > 1);
if (allFaster) {
  console.log("PASS — disk cache is faster than cold consolidation in ALL sizes.");
  console.log("Fase 1 step 1.7: benchmark confirms cache compensates.");
} else {
  const slower = results.filter(r => r.speedup <= 1);
  console.log(`FAIL — disk cache is SLOWER in: ${slower.map(r => r.label).join(", ")}`);
  console.log("Fase 1 step 1.7: benchmark shows cache does NOT compensate. Revert to forceRefresh=true always.");
}
