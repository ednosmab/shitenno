import type { ClassificationRule, SemanticDomain, SignalType } from "./taxonomy.js";
import { PERSISTENCE_AUTH_SECURITY_RULES } from "./rules/classification-rules-persistence.js";
import { APPLICATION_RULES } from "./rules/classification-rules-application.js";
import { GOVERNANCE_DATA_RULES } from "./rules/classification-rules-governance.js";

export const CLASSIFICATION_RULES: ClassificationRule[] = [
  ...PERSISTENCE_AUTH_SECURITY_RULES,
  ...APPLICATION_RULES,
  ...GOVERNANCE_DATA_RULES,
];

export const SORTED_RULES: ClassificationRule[] = [...CLASSIFICATION_RULES].sort(
  (a, b) => b.priority - a.priority
);

export function getRulesForSignal(signal: SignalType): ClassificationRule[] {
  return SORTED_RULES.filter((r) => r.signal === signal || r.signal === "*");
}

export function getRulesByDomain(): Map<SemanticDomain, ClassificationRule[]> {
  const grouped = new Map<SemanticDomain, ClassificationRule[]>();
  for (const rule of SORTED_RULES) {
    const existing = grouped.get(rule.domain) ?? [];
    existing.push(rule);
    grouped.set(rule.domain, existing);
  }
  return grouped;
}

export function getRuleCount(): number {
  return SORTED_RULES.length;
}
