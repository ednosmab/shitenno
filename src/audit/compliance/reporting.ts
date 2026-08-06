import { existsSync } from "node:fs";
import { join } from "node:path";
import { SHITENNO_DIR_NAME } from "../../domain/types/constants.js";
import type { HealthIssue, SourceFileInfo } from "../types.js";

export function detectComplianceReport(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const compliancePaths = [
    join(projectRoot, "docs", "COMPLIANCE.md"),
    join(projectRoot, "docs", "compliance"),
    join(projectRoot, SHITENNO_DIR_NAME, "docs", "COMPLIANCE.md"),
    join(projectRoot, SHITENNO_DIR_NAME, "docs", "compliance"),
  ];

  const hasComplianceReport = compliancePaths.some((p) => existsSync(p));

  if (!hasComplianceReport) {
    issues.push({
      type: "missing_compliance_report",
      severity: 1,
      description: "Nenhum relatório de compliance encontrado",
      location: "project root",
      recommendation: "Criar relatório de compliance mapeando controles para frameworks (OWASP, SOC2, NIST).",
      confidence: 0.95,
    });
  }

  return issues;
}
