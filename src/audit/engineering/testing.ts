import { existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { MISSING_TEST_WARNING_THRESHOLD } from "../constants.js";
import type { HealthIssue, SourceFileInfo } from "../types.js";
import { logger } from "../../logger.js";

export function detectTestHealth(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

  try {
    execSync("npx vitest run --reporter=json --bail 2>&1", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 15_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = String(e.stdout || e.stderr || e.message || "");
    const summaryMatch = output.match(/(\d+)\s+failed/);
    const failed = summaryMatch?.[1] ? parseInt(summaryMatch[1], 10) : 0;
    if (failed > 0) {
      issues.push({
        type: "test_failure",
        severity: 3,
        description: `${failed} teste(s) falharam (vitest)`,
        location: "src/__tests__/",
        recommendation: "Corrigir testes falhados antes de commitar",
        confidence: 0.95,
      });
    }
  }
  return issues;
}

export function detectTestCoverageGaps(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const testsDir = join(projectRoot, "src", "__tests__");

  try {
    const testFiles = new Set<string>();
    if (existsSync(testsDir)) {
      for (const f of readdirSync(testsDir).filter((f) => f.endsWith(".test.ts"))) {
        testFiles.add(f.replace(/\.test\.ts$/, ""));
      }
    }

    const missingTests = files.filter((f) => {
      if (testFiles.has(f.basename)) return false;
      const realLines = f.content.split("\n").filter((l) => l.trim().length > 0 && !l.trim().startsWith("//"));
      return realLines.length >= 10;
    });

    if (missingTests.length > 0) {
      issues.push({
        type: "missing_test",
        severity: missingTests.length > MISSING_TEST_WARNING_THRESHOLD ? 2 : 1,
        description: `${missingTests.length} modulo(s) source sem teste correspondente`,
        location: "src/",
        recommendation: `Adicionar testes para: ${missingTests.slice(0, 5).map((f) => f.relPath).join(", ")}${missingTests.length > 5 ? ` (+${missingTests.length - 5} mais)` : ""}`,
        confidence: 0.85,
      });
    }
  } catch (err) { logger.debug("engineering-detectors", "Error in detectTestCoverageGaps:", err); }
  return issues;
}
