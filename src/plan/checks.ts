/**
 * plan/checks.ts — Completion check functions for plan lifecycle
 *
 * Extracted from plan-lifecycle.ts to keep modules focused.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CompletionCheck } from "../plan-lifecycle.js";
import { logger } from "../logger.js";
import { validatePlanFormat } from "../plan-format-validator.js";

export interface PackageJson {
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

export function readPackageJsonSafe(projectRoot: string): PackageJson | null {
  try {
    const content = readFileSync(join(projectRoot, "package.json"), "utf-8");
    return JSON.parse(content) as PackageJson;
  } catch {
    return null;
  }
}

export function resolveRunner(projectRoot: string): { run: (script: string) => string } {
  const hasPnpmLock = (() => { try { readFileSync(join(projectRoot, "pnpm-lock.yaml"), "utf-8"); return true; } catch { return false; } })();
  const runner = hasPnpmLock ? "pnpm" : "npm";
  return { run: (script: string) => `${runner} run ${script}` };
}

export function extractExecError(err: unknown): string {
  if (err && typeof err === "object" && "stderr" in err) return String((err as { stderr: unknown }).stderr);
  if (err && typeof err === "object" && "stdout" in err) return String((err as { stdout: unknown }).stdout);
  return String(err);
}

export function isDocSyncFailure(detail: string): boolean {
  return detail.includes("sync-docs") || detail.includes("Documentation sync");
}

export function checkBuild(projectRoot: string): CompletionCheck {
  try {
    execSync("npx tsc --noEmit", { cwd: projectRoot, encoding: "utf-8", timeout: 180_000, stdio: ["pipe", "pipe", "pipe"] });
    return { name: "BUILD", passed: true, message: "TypeScript compilation succeeded" };
  } catch (err) {
    return { name: "BUILD", passed: false, message: describeExecError(err, "TypeScript compilation") };
  }
}

export function checkTests(projectRoot: string): CompletionCheck {
  const pkg = readPackageJsonSafe(projectRoot);
  // Prefer test:unit (fast suite) over test (full suite) when both exist
  const scriptName = pkg?.scripts?.["test:unit"] ? "test:unit" : pkg?.scripts?.["test"] ? "test" : null;
  if (!scriptName) return { name: "TESTS", passed: false, message: "No 'test' or 'test:unit' script in package.json" };
  const { run } = resolveRunner(projectRoot);
  try {
    execSync(`${run(scriptName)}`, { cwd: projectRoot, encoding: "utf-8", timeout: 300_000, stdio: ["pipe", "pipe", "pipe"] });
    return { name: "TESTS", passed: true, message: `${scriptName} passed` };
  } catch (err) {
    return { name: "TESTS", passed: false, message: describeExecError(err, scriptName) };
  }
}

export function checkLint(projectRoot: string): CompletionCheck {
  const pkg = readPackageJsonSafe(projectRoot);
  if (!pkg?.scripts?.["lint"]) return { name: "LINT", passed: true, message: "No lint script — skipped" };
  const { run } = resolveRunner(projectRoot);
  try {
    execSync(`${run("lint")}`, { cwd: projectRoot, encoding: "utf-8", timeout: 60_000, stdio: ["pipe", "pipe", "pipe"] });
    return { name: "LINT", passed: true, message: "Lint passed" };
  } catch (err) {
    return { name: "LINT", passed: false, message: `Lint failed: ${extractExecError(err).slice(0, 300)}` };
  }
}

export function checkGateIntegrity(projectRoot: string): CompletionCheck {
  const pkg = readPackageJsonSafe(projectRoot);
  if (!pkg?.scripts?.["validate"]) return { name: "GATE_SELF_TEST", passed: true, message: "No validate script — skipped" };
  const { run } = resolveRunner(projectRoot);
  try {
    execSync(`${run("validate")}`, { cwd: projectRoot, encoding: "utf-8", timeout: 30_000, stdio: ["pipe", "pipe", "pipe"] });
    return { name: "GATE_SELF_TEST", passed: true, message: "Gate integrity check passed" };
  } catch (err) {
    return { name: "GATE_SELF_TEST", passed: false, message: `Gate integrity check failed: ${extractExecError(err).slice(0, 300)}` };
  }
}

export function checkDocumentation(projectRoot: string): CompletionCheck {
  const pkg = readPackageJsonSafe(projectRoot);
  if (!pkg?.scripts?.["sync:docs"]) return { name: "DOCS", passed: true, message: "No sync:docs script — skipped" };
  const { run } = resolveRunner(projectRoot);
  try {
    execSync(`${run("sync:docs")} --quiet`, { cwd: projectRoot, encoding: "utf-8", timeout: 60_000, stdio: ["pipe", "pipe", "pipe"] });
    return { name: "DOCS", passed: true, message: "Documentation in sync" };
  } catch (err) {
    const detail = extractExecError(err);
    logger.info("plan-lifecycle", "DOCS check failed — attempting auto-fix (sync:docs --fix)");
    try {
      execSync(`${run("sync:docs")} --fix --quiet`, { cwd: projectRoot, encoding: "utf-8", timeout: 60_000, stdio: ["pipe", "pipe", "pipe"] });
      execSync(`${run("sync:docs")} --quiet`, { cwd: projectRoot, encoding: "utf-8", timeout: 60_000, stdio: ["pipe", "pipe", "pipe"] });
      return { name: "DOCS", passed: true, message: "Documentation auto-fixed" };
    } catch {
      return { name: "DOCS", passed: false, message: `Documentation sync failed (auto-fix attempted): ${String(detail).slice(0, 300)}` };
    }
  }
}

// ── Timeout-aware error description ─────────────────────────────────────────

function describeExecError(err: unknown, label: string): string {
  const isTimeout =
    err !== null &&
    typeof err === "object" &&
    "signal" in err &&
    (err as { signal?: string }).signal === "SIGTERM";
  if (isTimeout) {
    return `${label} timed out — increase the timeout constant in plan/checks.ts or split the suite`;
  }
  return `${label} failed: ${extractExecError(err).slice(0, 300)}`;
}

// ── Plan format check ───────────────────────────────────────────────────────

export function checkPlanFormat(filePath: string): CompletionCheck {
  try {
    const content = readFileSync(filePath, "utf-8");
    const result = validatePlanFormat(filePath, content);
    if (result.errors.length > 0) {
      return {
        name: "FORMAT",
        passed: false,
        message: `Plan format errors: ${result.errors.map((e) => e.message).join("; ")}`,
      };
    }
    return {
      name: "FORMAT",
      passed: true,
      message: result.warnings.length > 0 ? `Passed with ${result.warnings.length} warning(s)` : "Format valid",
    };
  } catch (error) {
    return { name: "FORMAT", passed: false, message: `Could not validate format: ${String(error)}` };
  }
}

// ── Canonical check names (single source of truth) ──────────────────────────

export const LIFECYCLE_CHECK_NAMES = ["FORMAT", "BUILD", "TESTS", "LINT", "GATE_SELF_TEST", "DOCS"] as const;
