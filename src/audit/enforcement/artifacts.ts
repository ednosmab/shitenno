import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { logger } from "../../logger.js";
import type { HealthIssue } from "../types.js";

export function detectMissingPremortem(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const bufferPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");
  if (!existsSync(bufferPath)) return issues;

  try {
    const content = readFileSync(bufferPath, "utf-8");
    const hasComplexTask = content.includes("complexity: high") || content.includes("complexity: critical");

    if (hasComplexTask) {
      const premortemDir = join(shitennoDir, "docs", "premortems");
      if (!existsSync(premortemDir) || readdirSync(premortemDir).length === 0) {
        issues.push({
          type: "missing_premortem",
          severity: 2,
          description: "Tarefa complexa detectada mas nenhum premortem encontrado — WORKFLOW.md requer premortem antes de features complexas",
          location: "shitenno/docs/premortems/",
          recommendation: "Executar 'pnpm run premortem:check' antes de iniciar tarefa complexa.",
          confidence: 0.7,
        });
      }
    }
  } catch {
    logger.debug("governance-enforcement", "Failed to check premortem");
  }

  return issues;
}

export function detectMissingAdrForChanges(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const adrDir = join(shitennoDir, "docs", "adrs");
  if (!existsSync(adrDir)) return issues;

  try {
    const adrFiles = readdirSync(adrDir).filter((f) => f.endsWith(".md") && f.startsWith("ADR-"));
    if (adrFiles.length === 0) {
      issues.push({
        type: "no_adrs_created",
        severity: 1,
        description: "Nenhum ADR encontrado em docs/adrs/ — decisões arquiteturais não rastreadas",
        location: "shitenno/docs/adrs/",
        recommendation: "Criar ADRs para decisões arquiteturais significativas (DESDO §4).",
        confidence: 0.95,
      });
    }
  } catch {
    logger.debug("governance-enforcement", "Failed to scan ADR directory");
  }

  return issues;
}
