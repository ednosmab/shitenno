/**
 * Config detectors — ADR coverage
 *
 * Detects missing Architecture Decision Records.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../shared/logger.js";
import type { HealthIssue } from "../types.js";

/**
 * Detect missing or empty ADR directory.
 */
export function detectAdrCoverage(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const adrDir = join(shitennoDir, "docs", "adrs");

  if (!existsSync(adrDir)) {
    issues.push({
      type: "adr_coverage_gap",
      severity: 1,
      description: "Directório docs/adrs/ não existe — decisões arquiteturais não rastreadas",
      location: "shitenno/docs/adrs/",
      recommendation: "Criar directório docs/adrs/ e adicionar ADRs para decisões existentes",
      confidence: 0.95,
    });
    return issues;
  }

  try {
    const adrFiles = readdirSync(adrDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE")
    );
    if (adrFiles.length === 0) {
      issues.push({
        type: "adr_coverage_gap",
        severity: 1,
        description: "Nenhum ADR encontrado em docs/adrs/ — decisões não documentadas",
        location: "shitenno/docs/adrs/",
        recommendation: "Criar ADRs para decisões arquiteturais significativas",
        confidence: 0.95,
      });
    }
  } catch (err) {
    logger.debug("config/adr", "Error in detectAdrCoverage:", err);
  }

  return issues;
}
