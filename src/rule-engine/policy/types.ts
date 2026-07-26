/**
 * types.ts — Policy engine types.
 */

export type PolicyMode = "enforce" | "advisory";
export type PolicyEffect = "allow" | "deny" | "require" | "notify";
export type ComparisonOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "greater_or_equal"
  | "less_or_equal"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "matches_regex"
  | "in"
  | "not_in"
  | "exists"
  | "not_exists";

export interface PolicyCondition {
  field: string;
  operator: ComparisonOperator;
  value?: unknown;
}

export interface PolicyAction {
  type: string;
  params: Record<string, unknown>;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  mode: PolicyMode;
  effect: PolicyEffect;
  conditions: PolicyCondition[];
  actions: PolicyAction[];
  categories?: string[];
  tags?: string[];
  enabled: boolean;
  priority: number;
}

export interface PolicyResult {
  policyId: string;
  policyName: string;
  matched: boolean;
  violated: boolean;
  mode: PolicyMode;
  message: string;
  actionsTriggered: string[];
}

export interface PolicyEvaluation {
  results: PolicyResult[];
  evaluated: number;
  matched: number;
  violations: number;
  warnings: number;
  compliant: boolean;
}

export interface PolicyFilter {
  mode?: PolicyMode;
  enabled?: boolean;
  category?: string;
  tag?: string;
}
