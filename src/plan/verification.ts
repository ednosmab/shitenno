/**
 * plan/verification.ts — Plan verification and auto-verification logic
 *
 * Extracted from plan-lifecycle.ts to keep modules focused.
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import type { CompletionCheck, VerificationRecord } from "../plan-lifecycle.js";
import { checkBuild, checkTests, checkLint, checkGateIntegrity, checkDocumentation } from "./checks.js";

export function computeDiffHash(projectRoot: string): string {
  try {
    const diff = execSync("git diff --stat HEAD", { cwd: projectRoot, encoding: "utf-8", timeout: 5000 });
    return createHash("sha256").update(diff).digest("hex").slice(0, 16);
  } catch {
    return "no-git";
  }
}

export function runAutoVerification(
  _shitennoDir: string,
  projectRoot: string,
  planId: string,
): VerificationRecord {
  const checks: CompletionCheck[] = [
    checkBuild(projectRoot),
    checkTests(projectRoot),
    checkLint(projectRoot),
    checkGateIntegrity(projectRoot),
    checkDocumentation(projectRoot),
  ];
  const passed = checks.every((c) => c.passed);
  const record: VerificationRecord = {
    planId,
    checks,
    passed,
    verifiedAt: new Date().toISOString(),
    diffHash: computeDiffHash(projectRoot),
  };
  return record;
}
