/**
 * Decision Core — ApplyAutofix Executor
 *
 * Adapter for audit/autofix-engine.ts (applyAndVerify).
 * This is NOT a rewrite — it wraps the existing autofix logic
 * (backup + verification + revert) and exposes it as an ActionExecutor.
 *
 * The autofix-engine.ts lives in its own module because it has a domain-specific
 * guarantee (backup + revert via tsc --noEmit) that should not be diluted.
 */

import { applyAndVerify, type ApplyResult } from "../../audit/autofix-engine.js";
import type { Suggestion } from "../../audit/suggestion-engine.js";
import type { ActionExecutor } from "./types.js";

export class ApplyAutofixExecutor implements ActionExecutor {
  name = "apply_autofix" as const;

  async execute(params: Record<string, unknown>, context: { projectRoot: string }): Promise<Record<string, unknown>> {
    const suggestion = params.suggestion as Suggestion;
    if (!suggestion || typeof suggestion !== "object") {
      return { status: "skipped", reason: "No suggestion provided" };
    }

    const result: ApplyResult = applyAndVerify(suggestion, context.projectRoot, {
      minConfidence: 0.85,
      dryRun: Boolean(params.dryRun),
    });

    if (result.status === "reverted") {
      throw new Error(`Autofix reverted: ${result.reason}`);
    }

    return { success: result.status === "applied", status: result.status, suggestion: result.suggestion };
  }
}
