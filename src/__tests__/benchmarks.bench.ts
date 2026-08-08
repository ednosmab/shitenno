/**
 * benchmarks.test.ts — Performance benchmarks for the shugo scoring engines
 *
 * Creates synthetic fixtures of varying sizes (small/medium/large)
 * and benchmarks: calculateComplexityScore, detectPatterns, auditHealth.
 *
 * Run with: npx vitest bench src/__tests__/benchmarks.bench.ts
 */

import { describe, bench, beforeAll, afterAll } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scaffoldShitenno } from "../infrastructure/scaffolder.js";
import { calculateComplexityScore } from "../application/scorer.js";
import { detectPatterns } from "../infrastructure/pattern-detector.js";
import { auditHealth } from "../application/health-auditor.js";
import { analyseProject } from "../infrastructure/analyser.js";
import { getEngineeringState, clearEngineeringStateCache } from "../engineering-state/index.js";
import type { UserAnswers } from "../interface/cli/prompts.js";
import type { Capability } from "../application/maturity-profile.js";

// ── Fixture Generators ──────────────────────────────────────────────────────

interface Fixture {
  dir: string;
  shitennoDir: string;
  label: string;
}

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

/**
 * Creates a synthetic project fixture with the specified number of
 * source files, history entries, and reports.
 */
function createFixture(
  label: string,
  opts: {
    sourceFileCount: number;
    historyEntries: number;
    reportCount: number;
    areas: number;
  }
): Fixture {
  const dir = join(tmpdir(), `shitenno-bench-${label}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });

  // Create package.json
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: `bench-${label}`,
        version: "1.0.0",
        dependencies: { react: "^18.0.0", next: "^14.0.0", zod: "^3.22.0" },
        devDependencies: { typescript: "^5.0.0", vitest: "^1.0.0" },
      },
      null,
      2
    )
  );

  // Create source files across areas
  const areas = Array.from({ length: opts.areas }, (_, i) => `src/area-${i}`);
  const filesPerArea = Math.ceil(opts.sourceFileCount / opts.areas);

  for (const area of areas) {
    const areaDir = join(dir, area);
    mkdirSync(areaDir, { recursive: true });
    for (let f = 0; f < filesPerArea; f++) {
      // Vary content to exercise keyword matching
      const hasAuth = f % 5 === 0;
      const hasBug = f % 7 === 0;
      const lines = Array.from(
        { length: 20 + (f % 30) },
        (_, i) =>
          `import { something } from "../${areas[(i + 1) % areas.length]}/helper";\n` +
          `// Line ${i}: ${hasAuth ? "auth payment session security" : "normal code"}\n` +
          `export function func_${f}_${i}() { return ${hasBug ? '"erro bug fix"' : i}; }`
      );
      writeFileSync(join(areaDir, `file-${f}.ts`), lines.join("\n"));
    }
  }

  // Scaffold shitenno
  scaffoldShitenno(dir, BASE_ANSWERS, SENIOR_CAPS);
  const shitennoDir = join(dir, "shitenno");

  // Create history entries
  if (opts.historyEntries > 0) {
    const historyDir = join(shitennoDir, "docs", "history");
    mkdirSync(historyDir, { recursive: true });
    for (let i = 0; i < opts.historyEntries; i++) {
      const date = new Date(2026, 0, 1 + i);
      const dateStr = date.toISOString().slice(0, 10);
      const hasViolation = i % 3 === 0;
      const hasRevert = i % 10 === 0;
      const areaIdx = i % opts.areas;
      const content = [
        `# Sessão ${i + 1} — ${dateStr}`,
        ``,
        `## Áreas trabalhadas`,
        `- src/area-${areaIdx}`,
        ``,
        `## Actividade`,
        hasViolation
          ? `Encontrei erro no módulo area-${areaIdx}. Bug detectado e corrigido.`
          : `Trabalho concluído sem problemas.`,
        hasRevert
          ? `Revert da decisão anterior — rollback necessário.`
          : ``,
        `## Notas`,
        `Sessão ${i + 1} do projecto.`,
      ]
        .filter(Boolean)
        .join("\n");
      writeFileSync(join(historyDir, `${dateStr}-sessao-${String(i + 1).padStart(2, "0")}.md`), content);
    }
  }

  // Create reports
  if (opts.reportCount > 0) {
    const reportsDir = join(shitennoDir, "reports");
    mkdirSync(reportsDir, { recursive: true });
    for (let i = 0; i < opts.reportCount; i++) {
      const areaScores = Array.from({ length: opts.areas }, (_, j) => ({
        area: `src/area-${j}`,
        score: 2 + (j % 8),
        violations: j % 3,
        churn: j % 5,
      }));
      writeFileSync(
        join(reportsDir, `complexity-bench-${label}-2026-01-${String(i + 1).padStart(2, "0")}-session1.json`),
        JSON.stringify({
          projectName: `bench-${label}`,
          score: 5 + (i % 10),
          level: "pleno",
          areaScores,
        })
      );
    }
  }

  return { dir, shitennoDir, label };
}

// ── Fixtures ────────────────────────────────────────────────────────────────

let small: Fixture;
let medium: Fixture;
let large: Fixture;

beforeAll(() => {
  small = createFixture("small", {
    sourceFileCount: 20,
    historyEntries: 5,
    reportCount: 3,
    areas: 3,
  });

  medium = createFixture("medium", {
    sourceFileCount: 100,
    historyEntries: 30,
    reportCount: 10,
    areas: 8,
  });

  large = createFixture("large", {
    sourceFileCount: 200,
    historyEntries: 50,
    reportCount: 25,
    areas: 10,
  });
});

afterAll(() => {
  for (const f of [small, medium, large]) {
    try {
      rmSync(f.dir, { recursive: true, force: true });
    } catch {
      // cleanup best-effort
    }
  }
});

// ── Benchmarks: calculateComplexityScore ─────────────────────────────────────

describe("calculateComplexityScore", () => {
  bench("small project (20 files, 3 areas)", async () => {
    const analysis = analyseProject(small.dir);
    await calculateComplexityScore(small.dir, small.shitennoDir, analysis);
  });

  bench("medium project (100 files, 8 areas)", async () => {
    const analysis = analyseProject(medium.dir);
    await calculateComplexityScore(medium.dir, medium.shitennoDir, analysis);
  });

  bench("large project (200 files, 10 areas)", async () => {
    const analysis = analyseProject(large.dir);
    await calculateComplexityScore(large.dir, large.shitennoDir, analysis);
  });

  bench("analyseProject alone (small)", () => {
    analyseProject(small.dir);
  });

  bench("analyseProject alone (large)", () => {
    analyseProject(large.dir);
  });
});

// ── Benchmarks: detectPatterns ───────────────────────────────────────────────

describe("detectPatterns", () => {
  bench("small (5 history, 3 reports)", () => {
    detectPatterns(small.dir, small.shitennoDir);
  });

  bench("medium (30 history, 10 reports)", () => {
    detectPatterns(medium.dir, medium.shitennoDir);
  });

  bench("large (100 history, 50 reports)", () => {
    detectPatterns(large.dir, large.shitennoDir);
  });
});

// ── Benchmarks: auditHealth ──────────────────────────────────────────────────

describe("auditHealth", () => {
  bench("small (5 history, 38 rules)", () => {
    auditHealth(small.dir, small.shitennoDir);
  });

  bench("medium (30 history, 38 rules)", () => {
    auditHealth(medium.dir, medium.shitennoDir);
  });

  bench("large (100 history, 38 rules)", () => {
    auditHealth(large.dir, large.shitennoDir);
  });
});

// ── Benchmarks: Full Pipeline (status command simulation) ────────────────────

describe("Full Pipeline (status command)", () => {
  bench("small — analyse + score + write report", async () => {
    const analysis = analyseProject(small.dir);
    const report = await calculateComplexityScore(small.dir, small.shitennoDir, analysis);
    JSON.stringify(report);
  });

  bench("medium — analyse + score + write report", async () => {
    const analysis = analyseProject(medium.dir);
    const report = await calculateComplexityScore(medium.dir, medium.shitennoDir, analysis);
    JSON.stringify(report);
  });

  bench("large — analyse + score + write report", async () => {
    const analysis = analyseProject(large.dir);
    const report = await calculateComplexityScore(large.dir, large.shitennoDir, analysis);
    JSON.stringify(report);
  });
});

// ── Benchmarks: All three engines together ───────────────────────────────────

describe("All Engines (audit command simulation)", () => {
  bench("small — score + detect + audit", async () => {
    const analysis = analyseProject(small.dir);
    await calculateComplexityScore(small.dir, small.shitennoDir, analysis);
    detectPatterns(small.dir, small.shitennoDir);
    auditHealth(small.dir, small.shitennoDir);
  });

  bench("medium — score + detect + audit", async () => {
    const analysis = analyseProject(medium.dir);
    await calculateComplexityScore(medium.dir, medium.shitennoDir, analysis);
    detectPatterns(medium.dir, medium.shitennoDir);
    auditHealth(medium.dir, medium.shitennoDir);
  });

  bench("large — score + detect + audit", async () => {
    const analysis = analyseProject(large.dir);
    await calculateComplexityScore(large.dir, large.shitennoDir, analysis);
    detectPatterns(large.dir, large.shitennoDir);
    auditHealth(large.dir, large.shitennoDir);
  });
});

// ── Benchmarks: Scaling characteristics ──────────────────────────────────────

describe("Scaling: source files (fixed 5 history, 3 areas)", () => {
  const scalingFixtures: Array<{ label: string; fixture: Fixture }> = [];

  beforeAll(() => {
    for (const count of [10, 50, 100, 200]) {
      scalingFixtures.push({
        label: `${count} files`,
        fixture: createFixture(`scale-${count}`, {
          sourceFileCount: count,
          historyEntries: 5,
          reportCount: 3,
          areas: 3,
        }),
      });
    }
  });

  afterAll(() => {
    for (const { fixture } of scalingFixtures) {
      try {
        rmSync(fixture.dir, { recursive: true, force: true });
      } catch {}
    }
  });

  for (const { label, fixture } of scalingFixtures) {
    bench(`score with ${label}`, async () => {
      const analysis = analyseProject(fixture.dir);
      await calculateComplexityScore(fixture.dir, fixture.shitennoDir, analysis);
    });
  }
});

describe("Scaling: history entries (fixed 100 files, 3 areas)", () => {
  const scalingFixtures: Array<{ label: string; fixture: Fixture }> = [];

  beforeAll(() => {
    for (const count of [5, 20, 50, 100]) {
      scalingFixtures.push({
        label: `${count} entries`,
        fixture: createFixture(`hist-${count}`, {
          sourceFileCount: 100,
          historyEntries: count,
          reportCount: 5,
          areas: 3,
        }),
      });
    }
  });

  afterAll(() => {
    for (const { fixture } of scalingFixtures) {
      try {
        rmSync(fixture.dir, { recursive: true, force: true });
      } catch {}
    }
  });

  for (const { label, fixture } of scalingFixtures) {
    bench(`detect with ${label}`, () => {
      detectPatterns(fixture.dir, fixture.shitennoDir);
    });

    bench(`audit with ${label}`, () => {
      auditHealth(fixture.dir, fixture.shitennoDir);
    });
  }
});

// ── Benchmarks: Cross-process cache (Fase 1) ────────────────────────────────

describe("Cross-process cache (cold consolidation vs disk cache fresh)", () => {
  let cacheSmall: Fixture;
  let cacheMedium: Fixture;
  let cacheLarge: Fixture;

  beforeAll(() => {
    cacheSmall = createFixture("cache-small", {
      sourceFileCount: 20,
      historyEntries: 5,
      reportCount: 3,
      areas: 3,
    });
    cacheMedium = createFixture("cache-medium", {
      sourceFileCount: 100,
      historyEntries: 30,
      reportCount: 10,
      areas: 8,
    });
    cacheLarge = createFixture("cache-large", {
      sourceFileCount: 200,
      historyEntries: 50,
      reportCount: 25,
      areas: 10,
    });

    // Pre-populate disk cache for each fixture
    for (const f of [cacheSmall, cacheMedium, cacheLarge]) {
      clearEngineeringStateCache();
      getEngineeringState(f.dir, f.shitennoDir, true);
    }
  });

  afterAll(() => {
    for (const f of [cacheSmall, cacheMedium, cacheLarge]) {
      try {
        rmSync(f.dir, { recursive: true, force: true });
      } catch {}
    }
  });

  bench("small — cold consolidation (forceRefresh=true)", () => {
    clearEngineeringStateCache();
    getEngineeringState(cacheSmall.dir, cacheSmall.shitennoDir, true);
  });

  bench("small — disk cache hit (governance/ unchanged)", () => {
    clearEngineeringStateCache();
    getEngineeringState(cacheSmall.dir, cacheSmall.shitennoDir, false);
  });

  bench("medium — cold consolidation (forceRefresh=true)", () => {
    clearEngineeringStateCache();
    getEngineeringState(cacheMedium.dir, cacheMedium.shitennoDir, true);
  });

  bench("medium — disk cache hit (governance/ unchanged)", () => {
    clearEngineeringStateCache();
    getEngineeringState(cacheMedium.dir, cacheMedium.shitennoDir, false);
  });

  bench("large — cold consolidation (forceRefresh=true)", () => {
    clearEngineeringStateCache();
    getEngineeringState(cacheLarge.dir, cacheLarge.shitennoDir, true);
  });

  bench("large — disk cache hit (governance/ unchanged)", () => {
    clearEngineeringStateCache();
    getEngineeringState(cacheLarge.dir, cacheLarge.shitennoDir, false);
  });
});
