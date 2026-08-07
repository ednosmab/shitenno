/**
 * Decision Core — Policy Gate
 *
 * Consults the PolicyEngine BEFORE any action execution.
 * Enforce violations block the action; advisory violations generate visibility.
 *
 * This is the FIRST gate in invoke.ts (ADR-009: policy is veto before anything else).
 */

import type { PolicyEngine, PolicyEvaluation } from "../infrastructure/policy.js";
import type { RuleAction, RuleContext } from "../domain/rules/rule.js";
import { getEventBus } from "../infrastructure/event-bus.js";

export interface PolicyGateResult {
  allowed: boolean;
  reason?: string;
  evaluation?: PolicyEvaluation;
}

/**
 * Check whether an action passes the policy gate.
 * An enforce-violation blocks the action entirely.
 * Advisory violations generate a challenge.generated event but do not block.
 */
export function checkPolicyGate(
  action: RuleAction,
  context: RuleContext,
  policyEngine: PolicyEngine
): PolicyGateResult {
  const evaluation = policyEngine.evaluate({
    actionType: action.type,
    ...action.params,
    shitennoDir: context.shitennoDir,
  });

  const enforced = evaluation.results.find((r) => r.violated && r.mode === "enforce");
  if (enforced) {
    return { allowed: false, reason: enforced.message, evaluation };
  }

  const advisory = evaluation.results.filter((r) => r.violated && r.mode === "advisory");
  if (advisory.length > 0) {
    for (const a of advisory) {
      getEventBus().publish("challenge.generated", {
        severity: "low",
        message: `Policy warning (non-blocking): ${a.message}`,
        policyId: a.policyId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return { allowed: true, evaluation };
}
