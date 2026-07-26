/**
 * structural.ts — Structural Architecture Detectors
 *
 * Detects Clean Architecture layer violations, SRP violations,
 * dependency inversion violations, and barrel file cycles.
 */

import type { HealthIssue, SourceFileInfo } from "../types.js";

// ── 4.1 Clean Architecture Layers ───────────────────────────────────────────

export function detectCleanArchitectureLayers(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const commandsDir = "src/commands/";
  const domainPatterns = [/repository/i, /service/i, /usecase/i, /interactor/i, /entity/i, /valueobject/i];

  for (const file of files) {
    if (!file.relPath.startsWith(commandsDir)) continue;

    for (const pattern of domainPatterns) {
      if (pattern.test(file.basename)) {
        issues.push({
          type: "layer_violation",
          severity: 2,
          description: `Lógica de domínio "${file.basename}" em commands/ — deve ficar em domain/ ou infrastructure/`,
          location: file.relPath,
          recommendation: "Mover lógica de domínio para camada separada (Clean Architecture).",
          confidence: 0.65,
        });
        break;
      }
    }
  }

  return issues;
}

// ── 4.2 SRP Violations (God Modules) ────────────────────────────────────────

function analyzeFileResponsibilities(file: SourceFileInfo): { funcCount: number; importCount: number; uniqueResponsibilities: number } {
  const lines = file.content.split("\n");
  const exportedFunctions = new Set<string>();
  const allFunctions = new Set<string>();
  const exportRegex = /^export\s+(?:async\s+)?function\s+(\w+)/gm;
  const funcRegex = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm;
  for (const line of lines) {
    const expMatch = exportRegex.exec(line);
    if (expMatch?.[1]) exportedFunctions.add(expMatch[1]);
    exportRegex.lastIndex = 0;
    const funcMatch = funcRegex.exec(line);
    if (funcMatch?.[1]) allFunctions.add(funcMatch[1]);
    funcRegex.lastIndex = 0;
  }
  const uniqueResponsibilities = new Set<string>();
  for (const fn of allFunctions) uniqueResponsibilities.add(fn.replace(/[A-Z].*$/, "").toLowerCase());
  const importCount = (file.content.match(/from\s+["']\.\.?\//g) ?? []).length;
  return { funcCount: Math.max(exportedFunctions.size, allFunctions.size), importCount, uniqueResponsibilities: uniqueResponsibilities.size };
}

function isSRPViolation(file: SourceFileInfo, analysis: { funcCount: number; importCount: number; uniqueResponsibilities: number }): boolean {
  const isOversized = file.lineCount > 500;
  const hasTooManyExports = analysis.funcCount > 8;
  const hasHighCoupling = analysis.importCount > 20;
  const hasManyResponsibilities = analysis.uniqueResponsibilities > 3;
  return isOversized || hasTooManyExports || (hasHighCoupling && hasManyResponsibilities);
}

export function detectSRPViolations(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];
  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;
    const analysis = analyzeFileResponsibilities(file);
    if (!isSRPViolation(file, analysis)) continue;
    const severity = file.lineCount > 1000 || analysis.funcCount > 15 ? 2 : 1;
    const parts: string[] = [];
    if (file.lineCount > 500) parts.push(`${file.lineCount} linhas`);
    if (analysis.funcCount > 8) parts.push(`${analysis.funcCount} funções`);
    if (analysis.importCount > 20) parts.push(`${analysis.importCount} imports relativos`);
    if (analysis.uniqueResponsibilities > 3) parts.push(`${analysis.uniqueResponsibilities} responsabilidades`);
    issues.push({ type: "srp_violation", severity,
      description: `"${file.basename}" — ${parts.join(", ")} — módulo multifuncional`,
      location: file.relPath, recommendation: "Dividir módulo em módulos menores com responsabilidade única.", confidence: 0.65, skillRef: "solid-principles" });
  }
  return issues;
}

// ── 4.3 Dependency Inversion Violations ─────────────────────────────────────

export function detectDependencyInversion(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;
    if (file.relPath.startsWith("src/commands/")) continue;

    const lines = file.content.split("\n");
    let violations = 0;

    for (const line of lines) {
      if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;

      if (line.includes("import") && line.includes("from")) {
        const isInterface = /types|interfaces|contracts|\.d\.ts/.test(line);
        const isConcrete = /concrete|implementation|\.ts["']/.test(line) && !isInterface;

        if (isConcrete && line.includes("./") && !line.includes("node:")) {
          violations++;
        }
      }
    }

    if (violations > 3) {
      issues.push({
        type: "dip_violation",
        severity: 1,
        description: `"${file.basename}" tem ${violations} imports de implementações concretas — DIP violado`,
        location: file.relPath,
        recommendation: "Depender de abstrações (interfaces/types) em vez de implementações concretas.",
        confidence: 0.65,
      });
    }
  }

  return issues;
}

// ── 4.4 Barrel File Cycles ──────────────────────────────────────────────────

export function detectBarrelFileCycles(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const indexFiles = files.filter((f) => f.basename === "index");

  for (const indexFile of indexFiles) {
    const reExportRegex = /export\s+\*\s+from\s+["']([^"']+)["']/g;
    let match;
    const exports: string[] = [];

    while ((match = reExportRegex.exec(indexFile.content)) !== null) {
      if (match[1]) exports.push(match[1]);
    }

    if (exports.length > 5) {
      const reExportsFromSameDir = exports.filter((e) => e.startsWith("./"));
      if (reExportsFromSameDir.length > 3) {
        issues.push({
          type: "barrel_file_bloat",
          severity: 1,
          description: `Barrel file "${indexFile.relPath}" re-exporta ${reExportsFromSameDir.length} módulos — potencial cycle risk`,
          location: indexFile.relPath,
          recommendation: "Limitar barrel files a <5 exports. Usar imports directos quando possível.",
          confidence: 0.65,
        });
      }
    }
  }

  return issues;
}
