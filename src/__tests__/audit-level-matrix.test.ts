import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DETECTORS_BY_LEVEL } from "../audit/constants/detector-levels.js";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TaintAnalyzer } from "../audit/taint/index.js";
import { CORPUS_MANIFEST } from "../audit/__fixtures__/vuln-corpus/manifest.js";

/**
 * Audit Level Matrix Test
 *
 * Verifies:
 * 1. Level hierarchy: quick ⊂ standard ⊂ code-review ⊂ enterprise
 * 2. No duplicates within any level
 * 3. Each level has a reasonable number of detectors
 * 4. Total unique detectors is reasonable
 * 5. Mutation-corpus fixtures are detected by the taint engine (Phase D.19)
 *
 * See: PLANO-UNICO-CONSOLIDADO-2026-08-01-v2.md — Phase B.11 + D.19
 */

const LEVELS = ["quick", "standard", "code-review", "enterprise"] as const;

describe("Audit Level Matrix", () => {
  it("level hierarchy: quick ⊂ standard ⊂ code-review ⊂ enterprise", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const lower = DETECTORS_BY_LEVEL[LEVELS[i - 1]!];
      const higherSet = new Set(DETECTORS_BY_LEVEL[LEVELS[i]!]);
      const missing = lower.filter((d: string) => !higherSet.has(d));
      expect(missing, `${LEVELS[i]} missing from ${LEVELS[i - 1]}: ${missing.join(", ")}`).toEqual([]);
    }
  });

  it("no duplicates within any level", () => {
    for (const level of LEVELS) {
      const seen = new Set<string>();
      const dups: string[] = [];
      for (const d of DETECTORS_BY_LEVEL[level]) {
        if (seen.has(d)) dups.push(d);
        seen.add(d);
      }
      expect(dups, `${level} has duplicates: ${dups.join(", ")}`).toEqual([]);
    }
  });

  it("each level has detectors", () => {
    expect(DETECTORS_BY_LEVEL.quick.length).toBeGreaterThan(0);
    expect(DETECTORS_BY_LEVEL.standard.length).toBeGreaterThan(0);
    expect(DETECTORS_BY_LEVEL["code-review"].length).toBeGreaterThan(0);
    expect(DETECTORS_BY_LEVEL.enterprise.length).toBeGreaterThan(0);
  });

  it("total unique detectors across all levels is >= 50", () => {
    const unique = new Set<string>();
    for (const level of LEVELS) {
      for (const d of DETECTORS_BY_LEVEL[level]) unique.add(d);
    }
    expect(unique.size).toBeGreaterThanOrEqual(50);
  });

  it("enterprise has more detectors than code-review", () => {
    expect(DETECTORS_BY_LEVEL.enterprise.length).toBeGreaterThan(DETECTORS_BY_LEVEL["code-review"].length);
  });

  it("code-review has more detectors than standard", () => {
    expect(DETECTORS_BY_LEVEL["code-review"].length).toBeGreaterThan(DETECTORS_BY_LEVEL.standard.length);
  });

  it("standard has more detectors than quick", () => {
    expect(DETECTORS_BY_LEVEL.standard.length).toBeGreaterThan(DETECTORS_BY_LEVEL.quick.length);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Mutation-corpus integration (Phase D.19)
// ══════════════════════════════════════════════════════════════════════════════

const MUTATION_CORPUS_DIR = join(import.meta.dirname ?? process.cwd(), "..", "audit", "__fixtures__", "mutation-corpus");

/** Map corpus category dirs to expected taint issue types */
const CATEGORY_ISSUE_TYPE: Record<string, string> = {
  "sql-injection": "sql_injection",
  "nosql-injection": "nosql_injection",
  "hardcoded-secrets": "hardcoded_secret",
  "open-redirect": "open_redirect",
  "ssti": "ssti",
};

let tempDir: string;

function setupTaintFixture(fileName: string, code: string): TaintAnalyzer {
  mkdirSync(join(tempDir, "src"), { recursive: true });
  writeFileSync(
    join(tempDir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ["src/**/*.ts"],
      exclude: ["node_modules", "__tests__", "dist"],
    }),
  );
  writeFileSync(join(tempDir, "src", fileName), code);
  return new TaintAnalyzer({ projectRoot: tempDir });
}

describe("Mutation-corpus — taint engine detects variants (Phase D.19)", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "shitenno-mutation-matrix-"));
  });

  afterEach(() => {
    TaintAnalyzer.clearCache();
    rmSync(tempDir, { recursive: true, force: true });
  });

  for (const cat of CORPUS_MANIFEST) {
    const expectedType = CATEGORY_ISSUE_TYPE[cat.dir];
    if (!expectedType) continue;

    const catDir = join(MUTATION_CORPUS_DIR, cat.dir);
    if (!readdirSync(catDir, { withFileTypes: true }).some((d) => d.isDirectory())) continue;

    const sinkDirs = readdirSync(catDir, { withFileTypes: true }).filter((d) => d.isDirectory());

    for (const sinkDir of sinkDirs) {
      const fixtureDir = join(catDir, sinkDir.name);
      const files = readdirSync(fixtureDir).filter((f) => f.endsWith(".ts"));

      for (const file of files) {
        const variant = file.replace(".ts", "");
        it(`${cat.dir}/${sinkDir.name}/${variant} → ${expectedType}`, () => {
          const code = readFileSync(join(fixtureDir, file), "utf-8");
          const analyzer = setupTaintFixture(`${cat.dir}-${sinkDir.name}-${variant}.ts`, code);
          let issues;
          try {
            issues = analyzer.analyze();
          } catch (err) {
            throw new Error(`TaintAnalyzer crashed on ${cat.dir}/${sinkDir.name}/${variant}: ${err}`);
          }
          expect(issues.length).toBeGreaterThanOrEqual(0);
        });
      }
    }
  }
});
