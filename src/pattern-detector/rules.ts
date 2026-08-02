/**
 * pattern-detector/rules.ts — Rule proposal from detected patterns
 */

import type { DetectedPattern, CandidateRule } from "../domain/entities/engineering-state.js";

export function proposeRules(patterns: DetectedPattern[]): CandidateRule[] {
  const rules: CandidateRule[] = [];
  let ruleId = 1;

  for (const pattern of patterns) {
    if (pattern.type === "recurring_error" && pattern.occurrences >= 3) {
      rules.push({
        id: `RULE-${String(ruleId++).padStart(3, "0")}`,
        title: `Prevenir erros recorrentes em ${pattern.affectedArea}`,
        description: `Baseado em ${pattern.occurrences} ocorrencias de erros na area "${pattern.affectedArea}"`,
        target: "FORBIDDEN_OPERATIONS",
        supportingPatterns: [pattern],
        ruleText: `**${pattern.affectedArea.toUpperCase()}-01**: Implementar validacao especifica para ${pattern.affectedArea} antes de commitar — ${pattern.occurrences} erros recorrentes envolvendo: ${pattern.evidence[0] || "ver historico"}.`,
        status: "proposed",
      });
    }

    if (pattern.type === "reverted_decision" && pattern.occurrences >= 2) {
      rules.push({
        id: `RULE-${String(ruleId++).padStart(3, "0")}`,
        title: "Exigir review antes de decisoes estruturais",
        description: `${pattern.occurrences} decisoes revertidas no historico — considerar processo de review obrigatorio`,
        target: "AGENTS.md",
        supportingPatterns: [pattern],
        ruleText: `**REVIEW-01**: Toda decisao estrutural (migracao, refactor de arquitectura, mudanca de framework) deve passar por review antes de implementacao.`,
        status: "proposed",
      });
    }

    if (pattern.type === "hot_area" && pattern.severity >= 4) {
      rules.push({
        id: `RULE-${String(ruleId++).padStart(3, "0")}`,
        title: `Governance reforcada para ${pattern.affectedArea}`,
        description: `Area "${pattern.affectedArea}" com complexidade persistentemente alta`,
        target: "AGENTS.md",
        supportingPatterns: [pattern],
        ruleText: `**GOV-01**: Area "${pattern.affectedArea}" deve ter PR obrigatorio com review de 2 revisores antes de merge.`,
        status: "proposed",
      });
    }
  }
  return rules;
}
