import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { HealthIssue } from "../types.js";
import { logger } from "../../logger.js";

export function detectRuleTypo(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const knownTypos: { pattern: RegExp; fix: string; file: string }[] = [
    { pattern: /REGRRA/, fix: "REGRA", file: "docs/AGENTS.md" },
    { pattern: /não-p laneado/, fix: "não-planeado", file: "docs/AGENTS.md" },
    { pattern: /\bejecutar\b/, fix: "executar", file: "docs/session-template.md" },
    { pattern: /\balterarhistóricos\b/, fix: "alterar históricos", file: "docs/session-template.md" },
  ];

  for (const typo of knownTypos) {
    const path = join(shitennoDir, typo.file);
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, "utf-8");
      if (typo.pattern.test(content)) {
        issues.push({
          type: "rule_typo",
          severity: 2,
          description: `Typo detectado em "${typo.file}": "${typo.pattern.source}" → "${typo.fix}"`,
          location: `shitenno/${typo.file}`,
          recommendation: `Corrigir "${typo.pattern.source}" para "${typo.fix}" em "${typo.file}"`,
          confidence: 0.65,
        });
      }
    } catch (err) { logger.debug("governance-detectors", "Error in detectRuleTypo:", err); }
  }
  return issues;
}

export function detectNumberingGap(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const foPath = join(shitennoDir, "docs/FORBIDDEN_OPERATIONS.md");
  if (existsSync(foPath)) {
    try {
      const content = readFileSync(foPath, "utf-8");
      const fRefs = [...content.matchAll(/F-(\d+)/g)].map((m) => Number(m[1] ?? "0"));
      const uniqueF = [...new Set(fRefs)].sort((a, b) => a - b);
      for (let i = 1; i < uniqueF.length; i++) {
        if (uniqueF[i]! - uniqueF[i - 1]! > 1) {
          issues.push({
            type: "numbering_gap",
            severity: 2,
            description: `Gap na numeração em FORBIDDEN_OPERATIONS.md: F-${uniqueF[i - 1]} → F-${uniqueF[i]} (F-${uniqueF[i - 1]! + 1} ausente)`,
            location: "shitenno/docs/FORBIDDEN_OPERATIONS.md",
            recommendation: `Verificar se F-${uniqueF[i - 1]! + 1} foi removido ou renumerado`,
            confidence: 0.65,
          });
        }
      }
    } catch (err) { logger.debug("governance-detectors", "Error scanning FORBIDDEN_OPERATIONS:", err); }
  }

  return issues;
}

export function detectPhantomRuleRefs(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const foPath = join(shitennoDir, "docs/FORBIDDEN_OPERATIONS.md");
  const agentsPath = join(shitennoDir, "docs/AGENTS.md");
  if (!existsSync(foPath) || !existsSync(agentsPath)) return issues;

  try {
    const foContent = readFileSync(foPath, "utf-8");
    const agentsContent = readFileSync(agentsPath, "utf-8");

    const definedRules = new Set<string>();
    for (const match of foContent.matchAll(/\*\*(G-\d+|F-\d+|CONFID-\d+|DT-\d+|ENV-\d+|DB-\d+|S-\d+)\*\*/g)) {
      if (match[1]) definedRules.add(match[1]);
    }
    for (const match of foContent.matchAll(/^###?\s+([A-Z]+-\d+)/gm)) {
      if (match[1]) definedRules.add(match[1]);
    }

    const referencedRules = new Map<string, string[]>();
    const refPatterns = [
      { pattern: /\bG-(\d+)\b/g, prefix: "G-" },
      { pattern: /\bF-(\d+)\b/g, prefix: "F-" },
      { pattern: /\bCONFID-(\d+)\b/g, prefix: "CONFID-" },
      { pattern: /\bDT-(\d+)\b/g, prefix: "DT-" },
      { pattern: /\bENV-(\d+)\b/g, prefix: "ENV-" },
      { pattern: /\bDB-(\d+)\b/g, prefix: "DB-" },
    ];

    for (const { pattern, prefix } of refPatterns) {
      let match;
      while ((match = pattern.exec(agentsContent)) !== null) {
        const ruleId = `${prefix}${match[1]}`;
        if (!definedRules.has(ruleId)) {
          const existing = referencedRules.get(ruleId) ?? [];
          existing.push("docs/AGENTS.md");
          referencedRules.set(ruleId, existing);
        }
      }
    }

    for (const [ruleId, locations] of referencedRules) {
      issues.push({
        type: "phantom_rule_ref",
        severity: 3,
        description: `Referência a regra inexistente: "${ruleId}" não está definida em FORBIDDEN_OPERATIONS.md`,
        location: locations[0] ?? "docs/AGENTS.md",
        recommendation: `Criar a regra "${ruleId}" em FORBIDDEN_OPERATIONS.md ou corrigir a referência em ${locations.join(", ")}`,
        confidence: 0.65,
      });
    }
  } catch (err) { logger.debug("governance-detectors", "Error in detectPhantomRuleRefs:", err); }

  return issues;
}
