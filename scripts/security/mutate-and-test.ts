/**
 * mutate-and-test.ts — Self-mutation testing for the taint engine
 *
 * Mutates sink/source definitions and verifies that the analyzer
 * still detects (or correctly misses) vulnerabilities in fixtures.
 * This helps find blind spots in the taint analysis.
 *
 * Usage: npx tsx scripts/security/mutate-and-test.ts
 */

import * as ts from "typescript";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

interface MutationResult {
  name: string;
  description: string;
  expected: "detected" | "missed";
  actual: "detected" | "missed";
  passed: boolean;
}

function setupFixture(code: string): string {
  const tempDir = mkdtempSync(join(tmpdir(), "shitenno-mutation-"));
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
    })
  );
  writeFileSync(join(tempDir, "src", "vuln.ts"), code);
  return tempDir;
}

function runAnalyzer(tempDir: string): { detected: boolean; count: number } {
  // Dynamic import to avoid circular dependencies at module load time
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TaintAnalyzer } = require(join(process.cwd(), "src", "audit", "taint", "index.js")) as typeof import("../../src/audit/taint/index.js");
  const analyzer = new TaintAnalyzer({ projectRoot: tempDir });
  const issues = analyzer.analyze();
  TaintAnalyzer.clearCache();
  rmSync(tempDir, { recursive: true, force: true });
  return { detected: issues.length > 0, count: issues.length };
}

interface Mutation {
  name: string;
  description: string;
  code: string;
  expected: "detected" | "missed";
}

const mutations: Mutation[] = [
  {
    name: "SQL injection via pool.query",
    description: "Direct pool.query with tainted input should be detected",
    code: `
      async function getUser(id: string) {
        const sql = "SELECT * FROM users WHERE id = " + id;
        return await pool.query(sql);
      }
    `,
    expected: "detected",
  },
  {
    name: "Command injection via exec",
    description: "exec() with tainted input should be detected",
    code: `
      import { exec } from "child_process";
      function runCmd(cmd: string) {
        exec(cmd);
      }
    `,
    expected: "detected",
  },
  {
    name: "SSRF via fetch",
    description: "fetch() with tainted URL should be detected",
    code: `
      async function fetchData(url: string) {
        return await fetch(url);
      }
    `,
    expected: "detected",
  },
  {
    name: "Path traversal via readFile",
    description: "readFile with tainted path should be detected",
    code: `
      import { readFileSync } from "fs";
      function loadFile(path: string) {
        return readFileSync(path);
      }
    `,
    expected: "detected",
  },
  {
    name: "Open redirect via res.redirect",
    description: "res.redirect with tainted URL should be detected",
    code: `
      function redirect(req: any, res: any) {
        res.redirect(req.query.url);
      }
    `,
    expected: "detected",
  },
  {
    name: "XSS via res.send with HTML",
    description: "res.send with tainted HTML should be detected",
    code: `
      function render(req: any, res: any) {
        res.send("<div>" + req.query.name + "</div>");
      }
    `,
    expected: "detected",
  },
  {
    name: "Code injection via eval",
    description: "eval() with tainted input should be detected",
    code: `
      function run(code: string) {
        eval(code);
      }
    `,
    expected: "detected",
  },
  {
    name: "No issue in clean code",
    description: "Clean code with no taint flow should have zero issues",
    code: `
      function add(a: number, b: number) {
        return a + b;
      }
    `,
    expected: "missed",
  },
];

function main(): void {
  console.log("=== Taint Engine Self-Mutation Testing ===\n");

  const results: MutationResult[] = [];

  for (const mutation of mutations) {
    const tempDir = setupFixture(mutation.code);
    const result = runAnalyzer(tempDir);
    const detected = result.detected ? "detected" : "missed";
    const passed = detected === mutation.expected;

    results.push({
      name: mutation.name,
      description: mutation.description,
      expected: mutation.expected,
      actual: detected,
      passed,
    });

    const status = passed ? "PASS" : "FAIL";
    console.log(`[${status}] ${mutation.name}`);
    console.log(`  Expected: ${mutation.expected}, Actual: ${detected} (${result.count} issues)`);
    if (!passed) {
      console.log(`  Description: ${mutation.description}`);
    }
    console.log();
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n=== Results: ${passed}/${results.length} passed, ${failed} failed ===`);

  if (failed > 0) {
    console.log("\nFailed mutations:");
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  - ${r.name}: expected ${r.expected}, got ${r.actual}`);
    }
    process.exit(1);
  }
}

main();
