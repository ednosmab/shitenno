/**
 * policy-engine.ts — Declarative Policy Engine
 *
 * Policies are JSON files that define rules without code.
 * Each policy has conditions, actions, and a mode (enforce/advisory).
 *
 * Architecture: Policy (JSON) → ConditionEvaluator → PolicyEngine → PolicyResult
 */

import { randomUUID } from "node:crypto";
import { getEventBus } from "../event-bus.js";
import type { Policy, PolicyMode, PolicyEffect, PolicyCondition, PolicyAction, PolicyResult, PolicyEvaluation, PolicyFilter } from "./policy/types.js";
import { evaluateCondition } from "./policy/conditions.js";
import type { PolicyRepository } from "./policy/repository.js";

export type { PolicyMode, PolicyEffect, ComparisonOperator, PolicyCondition, PolicyAction, Policy, PolicyResult, PolicyEvaluation, PolicyFilter } from "./policy/types.js";
export { evaluateCondition } from "./policy/conditions.js";
export type { PolicyRepository } from "./policy/repository.js";
export { FilePolicyRepository } from "./policy/repository.js";

function evaluateSinglePolicy(policy: Policy, context: Record<string, unknown>): PolicyResult {
  const allConditionsMet = policy.conditions.every((cond) => evaluateCondition(cond, context));

  if (!allConditionsMet) {
    return {
      policyId: policy.id, policyName: policy.name,
      matched: false, violated: false, mode: policy.mode,
      message: "Conditions not met", actionsTriggered: [],
    };
  }

  const violated = policy.effect === "deny";
  const actionsTriggered = policy.actions.map((a) => a.type);
  const action = violated && policy.mode === "enforce" ? "violated" : violated ? "advisory" : "enforced";

  getEventBus().publish("governance.policy_applied", {
    policyId: policy.id, policyName: policy.name, action,
    details: violated ? policy.description : undefined,
    timestamp: new Date().toISOString(),
  });

  return {
    policyId: policy.id, policyName: policy.name,
    matched: true, violated, mode: policy.mode,
    message: violated ? `Policy violated: ${policy.description}` : `Policy matched: ${policy.description}`,
    actionsTriggered,
  };
}

function updateCounters(policy: Policy, result: PolicyResult, counters: { matched: number; violations: number; warnings: number }): void {
  counters.matched++;
  if (result.violated && policy.mode === "enforce") counters.violations++;
  else if (result.violated && policy.mode === "advisory") counters.warnings++;
  else if (policy.effect === "require") counters.warnings++;
}

export class PolicyEngine {
  constructor(private repo: PolicyRepository) {}

  evaluate(
    context: Record<string, unknown>,
    filter?: PolicyFilter
  ): PolicyEvaluation {
    const policies = this.repo.findAll({ ...filter, enabled: true });
    const results: PolicyResult[] = [];
    const counters = { matched: 0, violations: 0, warnings: 0 };

    for (const policy of policies) {
      const result = evaluateSinglePolicy(policy, context);
      results.push(result);
      if (result.matched) updateCounters(policy, result, counters);
    }

    return {
      results, evaluated: policies.length,
      matched: counters.matched, violations: counters.violations,
      warnings: counters.warnings, compliant: counters.violations === 0,
    };
  }

  create(input: {
    name: string;
    description?: string;
    mode?: PolicyMode;
    effect?: PolicyEffect;
    conditions?: PolicyCondition[];
    actions?: PolicyAction[];
    categories?: string[];
    tags?: string[];
    priority?: number;
  }): Policy {
    const policy: Policy = {
      id: `POL-${randomUUID().slice(0, 8).toUpperCase()}`,
      name: input.name,
      description: input.description ?? "",
      mode: input.mode ?? "advisory",
      effect: input.effect ?? "notify",
      conditions: input.conditions ?? [],
      actions: input.actions ?? [],
      categories: input.categories,
      tags: input.tags,
      enabled: true,
      priority: input.priority ?? 100,
    };

    this.repo.save(policy);
    return policy;
  }

  enable(id: string): Policy | undefined {
    const policy = this.repo.findById(id);
    if (!policy) return undefined;
    policy.enabled = true;
    this.repo.save(policy);
    return policy;
  }

  disable(id: string): Policy | undefined {
    const policy = this.repo.findById(id);
    if (!policy) return undefined;
    policy.enabled = false;
    this.repo.save(policy);
    return policy;
  }

  delete(id: string): boolean {
    return this.repo.delete(id);
  }

  get(id: string): Policy | undefined {
    return this.repo.findById(id);
  }

  list(filter?: PolicyFilter): Policy[] {
    return this.repo.findAll(filter);
  }

  count(filter?: PolicyFilter): number {
    return this.repo.count(filter);
  }
}
