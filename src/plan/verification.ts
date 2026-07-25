/**
 * plan/verification.ts — Plan verification and auto-verification logic
 *
 * Extracted from plan-lifecycle.ts to keep modules focused.
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CompletionCheck, VerificationRecord } from "../plan-lifecycle.js";
import { MarkdownPlanEngine } from "../markdown-plan-engine.js";
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
  shitennoDir: string,
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

  // Update plan status — engine.updateStatus("done") already calls moveToDone()
  const engine = new MarkdownPlanEngine(shitennoDir);
  if (passed) {
    engine.updateStatus(planId, "done");
    // Write verification.json sidecar in done/
    const doneDir = join(shitennoDir, "governance", "plans", "done");
    if (!existsSync(doneDir)) mkdirSync(doneDir, { recursive: true });
    writeFileSync(join(doneDir, `${planId}.verification.json`), JSON.stringify(record, null, 2), "utf-8");
  } else {
    engine.updateStatus(planId, "refused");
  }

  return record;
}
