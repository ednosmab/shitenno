/**
 * Vulnerability Corpus Manifest
 *
 * Centralizes metadata about all security test fixtures.
 * Each entry maps a corpus category to its detector, expected issue type,
 * and lists fixture files with their expected outcomes (vulnerable or safe).
 *
 * Used by: security-benchmark.test.ts, audit-level-matrix.test.ts
 * See: PLANO-UNICO-CONSOLIDADO-2026-08-01-v2.md — Phase B.8
 */

export interface CorpusFixture {
  /** Fixture filename (relative to category directory) */
  file: string;
  /** Whether this fixture should produce an issue (true) or be clean (false) */
  vulnerable: boolean;
  /** Optional: expected issue count (default: 1 for vulnerable, 0 for safe) */
  expectedCount?: number;
  /** Optional: reason this fixture exists (for documentation) */
  note?: string;
}

export interface CorpusCategory {
  /** Directory name under vuln-corpus/ */
  dir: string;
  /** Detector function name (string for display, not runtime reference) */
  detector: string;
  /** Expected issue type that the detector produces */
  issueType: string;
  /** All fixture files in this category */
  fixtures: CorpusFixture[];
}

/**
 * The authoritative list of all corpus categories and their fixtures.
 * When adding a new fixture, add it here FIRST — tests derive from this manifest.
 */
export const CORPUS_MANIFEST: CorpusCategory[] = [
  {
    dir: "sql-injection",
    detector: "detectSQLInjection",
    issueType: "sql_injection",
    fixtures: [
      { file: "bare-call-vuln.ts", vulnerable: true, note: "Destructured import: query(sql)" },
      { file: "object-call-vuln.ts", vulnerable: true, note: "Object call: pool.query(sql) via suffix match" },
      { file: "safe-object-call.ts", vulnerable: false, note: "Parameterized query — should not trigger" },
      { file: "multi-statement-vuln.ts", vulnerable: false, note: "Multi-line SQL — taint engine handles, not regex" },
    ],
  },
  {
    dir: "nosql-injection",
    detector: "detectNoSQLInjection",
    issueType: "nosql_injection",
    fixtures: [
      { file: "object-call-vuln.ts", vulnerable: true, note: "MongoDB find with dynamic filter" },
      { file: "safe-object-call.ts", vulnerable: false, note: "Static filter — should not trigger" },
    ],
  },
  {
    dir: "prototype-pollution",
    detector: "detectPrototypePollution",
    issueType: "proto_pollution",
    fixtures: [
      { file: "multiline-for-in-vuln.ts", vulnerable: true, note: "for...in with cross-line assignment" },
      { file: "safe-for-in.ts", vulnerable: false, note: "hasOwnProperty check — should not trigger" },
    ],
  },
  {
    dir: "cors",
    detector: "detectInsecureCORS",
    issueType: "insecure_cors",
    fixtures: [
      { file: "wildcard-credentials-vuln.ts", vulnerable: true, note: "cors({origin:'*', credentials:true})" },
      { file: "safe-credentials.ts", vulnerable: false, note: "Specific origin + credentials — should not trigger" },
    ],
  },
  {
    dir: "hardcoded-secrets",
    detector: "detectHardcodedSecrets",
    issueType: "hardcoded_secret",
    fixtures: [
      { file: "env-fallback-vuln.ts", vulnerable: true, note: "process.env fallback to hardcoded value" },
      { file: "safe-readfile-parse.ts", vulnerable: false, note: "JSON.parse(readFileSync(...)) — should not trigger" },
    ],
  },
  {
    dir: "open-redirect",
    detector: "detectOpenRedirect",
    issueType: "open_redirect",
    fixtures: [
      { file: "object-call-vuln.ts", vulnerable: true, note: "res.redirect with dynamic URL" },
    ],
  },
  {
    dir: "ssti",
    detector: "detectSSTI",
    issueType: "ssti",
    fixtures: [
      { file: "ejs-render-vuln.ts", vulnerable: true, note: "ejs.render with dynamic input" },
      { file: "safe-render.ts", vulnerable: false, note: "Static template — should not trigger" },
    ],
  },
];

/** Get all vulnerable fixtures across all categories */
export function getVulnerableFixtures(): Array<{ category: CorpusCategory; fixture: CorpusFixture }> {
  const result: Array<{ category: CorpusCategory; fixture: CorpusFixture }> = [];
  for (const cat of CORPUS_MANIFEST) {
    for (const fix of cat.fixtures) {
      if (fix.vulnerable) result.push({ category: cat, fixture: fix });
    }
  }
  return result;
}

/** Get all safe fixtures across all categories */
export function getSafeFixtures(): Array<{ category: CorpusCategory; fixture: CorpusFixture }> {
  const result: Array<{ category: CorpusCategory; fixture: CorpusFixture }> = [];
  for (const cat of CORPUS_MANIFEST) {
    for (const fix of cat.fixtures) {
      if (!fix.vulnerable) result.push({ category: cat, fixture: fix });
    }
  }
  return result;
}

/** Total number of fixtures across all categories */
export function getTotalFixtureCount(): number {
  return CORPUS_MANIFEST.reduce((sum, cat) => sum + cat.fixtures.length, 0);
}
