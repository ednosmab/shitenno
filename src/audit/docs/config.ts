/**
 * Docs detectors — Configuration health
 *
 * Detects stale buffers, date placeholders, dead rules, and violation hotspots.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../shared/logger.js";
import { VIOLATION_KEYWORDS } from "../constants.js";
import type { HealthIssue, HistoryEntry } from "../types.js";

/**
 * Detect stale context buffer that hasn't been updated recently.
 */
export function detectStaleBuffer(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const bufferPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");
  if (!existsSync(bufferPath)) return issues;

  try {
    const content = readFileSync(bufferPath, "utf-8");
    const activeLines = content.split("\n").filter((l) => l.trim().length > 0 && !l.startsWith("#") && !l.startsWith("---")).length;

    if (activeLines > 50) {
      issues.push({
        type: "stale_buffer",
        severity: 2,
        description: `context_buffer.yaml tem ${activeLines} linhas activas (máx recomendado: 50)`,
        location: "governance/context/context_buffer.yaml",
        recommendation: "Podar o buffer — remover secções obsoletas e consolidar estado",
        confidence: 0.7,
      });
    }

    if (content.includes("in_progress") || content.includes("active")) {
      issues.push({
        type: "stale_buffer",
        severity: 1,
        description: "context_buffer.yaml indica sessão em curso não fechada",
        location: "governance/context/context_buffer.yaml",
        recommendation: "Executar close-session ou actualizar o status",
        confidence: 0.7,
      });
    }
  } catch (err) {
    logger.debug("docs/config", "Error reading context buffer:", err);
  }

  return issues;
}

/**
 * Detect date placeholders in documentation files.
 */
export function detectDatePlaceholders(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const docsToCheck = [
    "docs/FORBIDDEN_OPERATIONS.md",
    "docs/DESDO.md",
    "cognition/context/CONTEXT_HIERARCHY.md",
    "docs/CONCEPTUAL_MODEL.md",
    "docs/KNOWLEDGE_LIFECYCLE.md",
  ];

  for (const doc of docsToCheck) {
    const path = join(shitennoDir, doc);
    if (!existsSync(path)) continue;

    try {
      const content = readFileSync(path, "utf-8");
      if (content.includes("YYYY-MM-DD") || content.includes("[DATE]")) {
        issues.push({
          type: "date_placeholder",
          severity: 2,
          description: `"${doc}" contém datas placeholder (YYYY-MM-DD ou [DATE])`,
          location: `shitenno/${doc}`,
          recommendation: `Actualizar datas placeholder em "${doc}" para data real`,
          confidence: 0.7,
        });
      }
    } catch (err) {
      logger.debug("docs/config", `Error reading ${doc}:`, err);
    }
  }

  return issues;
}

/**
 * Detect rules that exist in documentation but have no evidence of enforcement in history.
 */
export function detectDeadRules(rules: string[], history: HistoryEntry[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  if (history.length < 10) return issues;

  for (const rule of rules) {
    const ruleWords = rule.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    let mentionedCount = 0;

    for (const entry of history) {
      const matches = ruleWords.filter((w) => entry.content.includes(w));
      if (matches.length >= Math.min(2, ruleWords.length)) {
        mentionedCount++;
      }
    }

    if (mentionedCount === 0) {
      issues.push({
        type: "dead_rule",
        severity: 1,
        description: `Regra "${rule}" nunca mencionada em ${history.length} sessões — candidata a remover ou simplificar`,
        location: "docs/AGENTS.md",
        recommendation: `Considerar remover "${rule}" ou convertê-la em recomendação não vinculante`,
        confidence: 0.7,
      });
    }
  }

  return issues;
}

/**
 * Detect areas with high concentration of violations in history.
 */
export function detectViolationHotspots(history: HistoryEntry[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  if (history.length < 4) return issues;

  let violationCount = 0;
  for (const entry of history) {
    if (VIOLATION_KEYWORDS.some((kw) => entry.content.includes(kw))) {
      violationCount++;
    }
  }

  if (violationCount >= Math.ceil(history.length * 0.5)) {
    issues.push({
      type: "violation_hotspot",
      severity: violationCount >= history.length * 0.7 ? 3 : 2,
      description: `Alta taxa de violações: ${violationCount}/${history.length} sessões com erros — governança pode precisar de reforço`,
      location: "docs/AGENTS.md",
      recommendation: "Revisar regras — considerar adicionar validações automáticas (lint) para regras críticas",
      confidence: 0.7,
    });
  }

  return issues;
}
