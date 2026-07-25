/**
 * Audit module — Autofix Engine
 *
 * Applies fix suggestions with verification and automatic rollback.
 * NEVER auto-applies without confidence threshold (default 0.85).
 * Always creates backup before writing — reverts on verification failure.
 */

import { readFileSync, writeFileSync, copyFileSync, unlinkSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import type { Suggestion } from "./suggestion-engine.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ApplyResult {
  suggestion: Suggestion;
  status: "applied" | "reverted" | "skipped";
  reason?: string;
}

export interface AutofixReport {
  total: number;
  applied: number;
  reverted: number;
  skipped: number;
  results: ApplyResult[];
}

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_MIN_CONFIDENCE = 0.85;
const DEFAULT_VERIFY_COMMAND = "npx tsc --noEmit";
const BACKUP_SUFFIX = ".shitenno-backup";
const VERIFY_TIMEOUT_MS = 60_000;

// ── Core Function ───────────────────────────────────────────────────────────

/**
 * Applies a suggestion, verifies with typecheck, reverts if broken.
 * NUNCA aplica se confidence < threshold — autofix só em fixes de alta certeza.
 */
function validatePreconditions(suggestion: Suggestion, projectRoot: string, minConfidence: number): { valid: boolean; result?: ApplyResult } {
  if (suggestion.confidence < minConfidence) return { valid: false, result: { suggestion, status: "skipped", reason: `confidence ${suggestion.confidence} < ${minConfidence}` } };
  const filePath = `${projectRoot}/${suggestion.file}`;
  if (!existsSync(filePath)) return { valid: false, result: { suggestion, status: "skipped", reason: `file not found: ${suggestion.file}` } };
  return { valid: true };
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

function applyPatchAndVerify(filePath: string, suggestion: Suggestion, projectRoot: string, verifyCmd: string): ApplyResult {
  const backupPath = `${filePath}${BACKUP_SUFFIX}`;
  copyFileSync(filePath, backupPath);
  try {
    const content = readFileSync(filePath, "utf-8");
    if (!content.includes(suggestion.currentCode)) { unlinkSync(backupPath); return { suggestion, status: "skipped", reason: "currentCode not found — file changed since audit" }; }
    const occurrences = countOccurrences(content, suggestion.currentCode);
    if (occurrences > 1) {
      unlinkSync(backupPath);
      return { suggestion, status: "skipped", reason: `ambiguous match — currentCode appears ${occurrences} times, refusing to guess` };
    }
    writeFileSync(filePath, content.replace(suggestion.currentCode, suggestion.suggestedCode), "utf-8");
    execSync(verifyCmd, { cwd: projectRoot, stdio: "pipe", timeout: VERIFY_TIMEOUT_MS });
    unlinkSync(backupPath);
    return { suggestion, status: "applied" };
  } catch (error) { copyFileSync(backupPath, filePath); unlinkSync(backupPath); return { suggestion, status: "reverted", reason: String(error).slice(0, 200) }; }
}

function handleDryRun(filePath: string, suggestion: Suggestion): ApplyResult {
  const backupPath = `${filePath}${BACKUP_SUFFIX}`;
  if (existsSync(backupPath)) unlinkSync(backupPath);
  return { suggestion, status: "applied", reason: "dry-run — no changes written" };
}

export function applyAndVerify(suggestion: Suggestion, projectRoot: string, opts: { minConfidence?: number; verifyCommand?: string; dryRun?: boolean } = {}): ApplyResult {
  const minConfidence = opts.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const precondition = validatePreconditions(suggestion, projectRoot, minConfidence);
  if (!precondition.valid) return precondition.result!;
  const filePath = `${projectRoot}/${suggestion.file}`;
  if (opts.dryRun) return handleDryRun(filePath, suggestion);
  return applyPatchAndVerify(filePath, suggestion, projectRoot, opts.verifyCommand ?? DEFAULT_VERIFY_COMMAND);
}

// ── Batch Processing ────────────────────────────────────────────────────────

/**
 * Applies multiple suggestions with verification.
 * Returns a report with counts and individual results.
 */
export function applyAllFixes(
  suggestions: Suggestion[],
  projectRoot: string,
  opts: { minConfidence?: number; verifyCommand?: string; dryRun?: boolean } = {}
): AutofixReport {
  const results: ApplyResult[] = [];

  for (const suggestion of suggestions) {
    const result = applyAndVerify(suggestion, projectRoot, opts);
    results.push(result);
  }

  return {
    total: results.length,
    applied: results.filter((r) => r.status === "applied").length,
    reverted: results.filter((r) => r.status === "reverted").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    results,
  };
}
