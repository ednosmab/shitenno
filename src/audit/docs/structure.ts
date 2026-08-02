/**
 * Docs detectors — Structure
 *
 * Detects missing files, orphan directories, and empty directories.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../logger.js";
import type { HealthIssue } from "../types.js";
import { collectEmptyDirsSync } from "./helpers.js";

/**
 * Detect missing documentation files in the shitenno directory.
 */
export function detectMissingDocs(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const expectedDocs = [
    { path: "docs/AGENTS.md", critical: true },
    { path: "docs/FORBIDDEN_OPERATIONS.md", critical: true },
    { path: "docs/DESDO.md", critical: true },
    { path: "governance/WORKFLOW.md", critical: true },
    { path: "governance/SYSTEM_MAP.md", critical: false },
    { path: "docs/session-template.md", critical: false },
  ];

  for (const doc of expectedDocs) {
    if (!existsSync(join(shitennoDir, doc.path))) {
      issues.push({
        type: "missing_docs",
        severity: doc.critical ? 3 : 1,
        description: `Documento "${doc.path}" não encontrado`,
        location: `shitenno/${doc.path}`,
        recommendation: `Criar "${doc.path}" — ${doc.critical ? "crítico" : "recomendado"}`,
        confidence: 0.95,
      });
    }
  }

  return issues;
}

/**
 * Detect orphan directories that exist but are not referenced anywhere.
 */
export function detectOrphanDirs(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  try {
    const dirs = readdirSync(shitennoDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const dir of dirs) {
      const dirPath = join(shitennoDir, dir.name);
      let files: string[];
      try {
        files = readdirSync(dirPath);
      } catch (err) {
        logger.debug("docs/structure", "Cannot read directory:", err);
        continue;
      }
      const hasOnlyReadmes = files.length <= 2 && files.every((f) => f === "README.md" || f === ".gitignore");

      if (hasOnlyReadmes && dir.name !== "scripts" && dir.name !== "reports") {
        issues.push({
          type: "orphan_dir",
          severity: 1,
          description: `Directório "${dir.name}" contém apenas README — possivelmente órfão`,
          location: `shitenno/${dir.name}/`,
          recommendation: `Adicionar conteúdo a "${dir.name}" ou removê-lo se desnecessário`,
          confidence: 0.95,
        });
      }
    }
  } catch (err) {
    logger.debug("docs/structure", "Error in detectOrphanDirs:", err);
  }

  return issues;
}

/**
 * Detect empty directories in the project.
 */
export function detectEmptyDirs(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipDirs = new Set(["scripts", "reports", "node_modules", ".git"]);
  const emptyDirs: string[] = [];

  try {
    collectEmptyDirsSync(shitennoDir, "", skipDirs, emptyDirs);
    for (const relative of emptyDirs) {
      issues.push({
        type: "empty_dir",
        severity: 1,
        description: `Directório "${relative}" existe mas está vazio ou contém apenas templates`,
        location: `shitenno/${relative}`,
        recommendation: `Adicionar conteúdo a "${relative}" ou remover se desnecessário`,
        confidence: 0.95,
      });
    }
  } catch (err) {
    logger.debug("docs/structure", "Error in detectEmptyDirs:", err);
  }

  return issues;
}

/**
 * Detect missing .gitignore in shitenno directory.
 */
export function detectMissingGitignore(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const gitignorePath = join(shitennoDir, ".gitignore");

  if (!existsSync(gitignorePath)) {
    issues.push({
      type: "missing_gitignore",
      severity: 2,
      description: ".gitignore não existe em shitenno/ — arquivos privados podem ser versionados",
      location: "shitenno/.gitignore",
      recommendation: "Criar shitenno/.gitignore para excluir ficheiros privados (feedback/, session-feedback/)",
      confidence: 0.95,
    });
  }

  return issues;
}

/**
 * Detect missing package.json in shitenno directory.
 */
export function detectMissingPackageJson(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const packagePath = join(shitennoDir, "package.json");

  if (!existsSync(packagePath)) {
    const scriptsDir = join(shitennoDir, "scripts");
    if (existsSync(scriptsDir)) {
      try {
        const scripts = readdirSync(scriptsDir).filter(
          (f) => /\.(ts|tsx|js|jsx|vue|svelte)$/.test(f),
        );
        if (scripts.length > 0) {
          issues.push({
            type: "missing_package_json",
            severity: 2,
            description: `package.json não existe em shitenno/ — ${scripts.length} scripts não são executáveis via pnpm`,
            location: "shitenno/package.json",
            recommendation:
              "Criar shitenno/package.json com scripts para executar os TypeScript files",
            confidence: 0.75,
          });
        }
      } catch (_err) {
        logger.debug("docs/structure", "Error reading package.json:", _err);
      }
    }
  }

  return issues;
}
