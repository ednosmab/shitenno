/**
 * daemon/verification.ts — Plan verification loop and pending plan processing
 *
 * Extracted from daemon/index.ts to keep modules focused.
 */

import { MarkdownPlanEngine } from "../infrastructure/markdown-plan-engine.js";
import { runAutoVerification, checkAndArchiveDonePlans } from "../application/plan-lifecycle.js";
import { acquireVerificationLock, releaseVerificationLock } from "../infrastructure/verification-lock.js";
import { daemonLog } from "./log-rotation.js";

// ── Verification Loop ───────────────────────────────────────────────────────

function runVerificationLoop(
  shitennoDir: string,
  resolvedProjectRoot: string,
  logPath: string,
): void {
  const engine = new MarkdownPlanEngine(shitennoDir);
  const pendingCheck = engine.listAll().filter((p) => p.isActive && p.status === "check");

  for (const plan of pendingCheck) {
    try {
      const record = runAutoVerification(shitennoDir, resolvedProjectRoot, plan.id);
      daemonLog(
        logPath,
        record.passed ? "INFO" : "WARN",
        `Auto-verification for ${plan.id}: ${record.passed ? "PASSED → done" : "REFUSED"} — ${
          record.checks.filter((c) => !c.passed).map((c) => `${c.name}: ${c.message}`).join("; ")
        }`
      );
    } catch (err) {
      daemonLog(logPath, "ERROR", `Auto-verification for ${plan.id} failed: ${err}`);
    }
  }

  const archiveResult = checkAndArchiveDonePlans(shitennoDir);
  if (archiveResult.archived > 0) {
    daemonLog(logPath, "INFO", `Auto-archived ${archiveResult.archived} plan(s)`);
  }
}

export function createVerifyAllPendingPlans(
  shitennoDir: string,
  resolvedProjectRoot: string,
  logPath: string,
) {
  let verificationInFlight: Promise<void> | null = null;
  let pendingReVerification = false;

  return async function verifyAllPendingPlans(): Promise<void> {
    if (verificationInFlight) {
      pendingReVerification = true;
      return verificationInFlight;
    }

    verificationInFlight = (async () => {
      if (!acquireVerificationLock(shitennoDir)) {
        daemonLog(logPath, "INFO", "Verification already in progress in another process (e.g. close-session) — skipping this round");
        return;
      }

      try {
        do {
          pendingReVerification = false;
          try {
            runVerificationLoop(shitennoDir, resolvedProjectRoot, logPath);
          } catch (err) {
            daemonLog(logPath, "ERROR", `Verification loop failed: ${err}`);
          }
        } while (pendingReVerification);
      } finally {
        releaseVerificationLock(shitennoDir);
      }
    })();

    await verificationInFlight;
    verificationInFlight = null;
  };
}
