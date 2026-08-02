/**
 * SBOM Coverage and Dependency Provenance detectors.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { HealthIssue, SourceFileInfo } from "../types.js";

// ── 13.1 SBOM Coverage ──────────────────────────────────────────────────────

export function detectSBOMCoverage(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const sbomPaths = [
    join(projectRoot, "sbom.json"),
    join(projectRoot, "bom.json"),
    join(projectRoot, "spdx.json"),
    join(projectRoot, "cyclonedx.json"),
    join(projectRoot, "docs", "sbom.json"),
  ];

  const hasSBOM = sbomPaths.some((p) => existsSync(p));

  if (!hasSBOM) {
    issues.push({
      type: "missing_sbom",
      severity: 2,
      description: "Nenhum SBOM (Software Bill of Materials) encontrado",
      location: "project root",
      recommendation: "Executar 'shitenno sbom generate' para gerar SBOM CycloneDX automaticamente.",
      confidence: 0.8,
    });
  }

  return issues;
}

// ── 13.2 Dependency Provenance ──────────────────────────────────────────────

export function detectDependencyProvenance(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const packageJsonPath = join(projectRoot, "package.json");

  if (!existsSync(packageJsonPath)) return issues;

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const unverifiedCount = Object.keys(allDeps).length;

  if (unverifiedCount > 10) {
    issues.push({
      type: "unverified_provenance",
      severity: 1,
      description: `${unverifiedCount} dependências sem verificação de proveniência`,
      location: "package.json",
      recommendation: "Habilitar npm provenance ou usar sigstore para verificar assinaturas de pacotes.",
      confidence: 0.9,
    });
  }

  return issues;
}
