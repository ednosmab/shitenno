import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../shared/logger.js";
import type { HealthIssue } from "../types.js";

export function detectRuleExecutionCompliance(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const rulesDir = join(shitennoDir, "governance", "rules");
  if (!existsSync(rulesDir)) return issues;

  try {
    const files = readdirSync(rulesDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const path = join(rulesDir, file);
      try {
        const content = readFileSync(path, "utf-8");
        const rule = JSON.parse(content);

        if (!rule.id || !rule.trigger || (!rule.action && !rule.actions)) {
          issues.push({
            type: "invalid_rule_structure",
            severity: 2,
            description: `Regra "${file}" tem estrutura inválida — campos obrigatórios em falta (id, trigger, action/actions)`,
            location: `shitenno/governance/rules/${file}`,
            recommendation: "Cada regra JSON deve ter: id, trigger, action (ou actions), requiredCapability.",
            confidence: 0.9,
          });
        }
      } catch {
        issues.push({
          type: "malformed_rule_json",
          severity: 2,
          description: `Regra "${file}" não é JSON válido`,
          location: `shitenno/governance/rules/${file}`,
          recommendation: "Corrigir sintaxe JSON da regra.",
          confidence: 0.9,
        });
      }
    }
  } catch {
    logger.debug("governance-enforcement", "Failed to scan rules directory");
  }

  return issues;
}

export function detectPolicyStructure(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const policiesDir = join(shitennoDir, "governance", "policies");
  if (!existsSync(policiesDir)) {
    issues.push({
      type: "missing_policies_dir",
      severity: 2,
      description: "Directório governance/policies/ não existe — políticas de commit/branch/review não documentadas",
      location: "shitenno/governance/policies/",
      recommendation: "Criar directório com COMMIT-POLICY.md, BRANCH-POLICY.md, REVIEW-POLICY.md.",
      confidence: 0.95,
    });
    return issues;
  }

  const expectedPolicies = ["COMMIT-POLICY.md", "BRANCH-POLICY.md", "REVIEW-POLICY.md"];
  try {
    const files = readdirSync(policiesDir);
    for (const policy of expectedPolicies) {
      if (!files.includes(policy)) {
        issues.push({
          type: "missing_policy",
          severity: 2,
          description: `Política "${policy}" não encontrada em governance/policies/`,
          location: `shitenno/governance/policies/${policy}`,
          recommendation: `Criar "${policy}" com regras de governança.`,
          confidence: 0.95,
        });
      }
    }
  } catch {
    logger.debug("governance-enforcement", "Failed to scan policies directory");
  }

  return issues;
}
