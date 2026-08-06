import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../shared/logger.js";
import { safeJsonParseValidated, isRecord } from "../../infrastructure/validation.js";
import type { HealthIssue } from "../types.js";

export function detectUnpinnedVersions(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

  try {
    const pkg = safeJsonParseValidated(readFileSync(pkgPath, "utf-8"), isRecord, "supply:detectUnpinnedVersions");
    if (!pkg) return issues;
    const allDeps: Record<string, string> = {
      ...((pkg as Record<string, unknown>).dependencies as Record<string, string> ?? {}),
      ...((pkg as Record<string, unknown>).devDependencies as Record<string, string> ?? {}),
    };

    const unpinned: string[] = [];
    for (const [name, version] of Object.entries(allDeps)) {
      if (version === "*" || version === "latest" || version === ">" || version === ">=") {
        unpinned.push(`${name}@${version}`);
      }
    }

    if (unpinned.length > 0) {
      issues.push({
        type: "unpinned_version",
        severity: 2,
        description: `${unpinned.length} dependência(s) com versão não fixada: ${unpinned.slice(0, 5).join(", ")}${unpinned.length > 5 ? ` (+${unpinned.length - 5})` : ""}`,
        location: "package.json",
        recommendation: "Fixar versões em package.json para evitar actualizações inesperadas",
        confidence: 0.9,
      });
    }
  } catch (err) { logger.debug("engineering-detectors", "Error in detectUnpinnedVersions:", err); }
  return issues;
}

export function detectMissingLockFile(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

  const lockFiles = [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
  ];

  const hasLockFile = lockFiles.some((f) => existsSync(join(projectRoot, f)));
  if (!hasLockFile) {
    issues.push({
      type: "missing_lock_file",
      severity: 3,
      description: "Nenhum lock file encontrado (package-lock.json, pnpm-lock.yaml, yarn.lock, bun.lockb)",
      location: "package.json",
      recommendation: "Executar 'npm install' ou 'pnpm install' para gerar o lock file — garante builds reproduzíveis",
      confidence: 0.95,
    });
  }
  return issues;
}

export function detectLockFileDrift(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

  const lockFiles = [
    { lock: "package-lock.json", manager: "npm" },
    { lock: "pnpm-lock.yaml", manager: "pnpm" },
    { lock: "yarn.lock", manager: "yarn" },
  ];

  try {
    const pkgStat = statSync(pkgPath);
    for (const { lock } of lockFiles) {
      const lockPath = join(projectRoot, lock);
      if (existsSync(lockPath)) {
        const lockStat = statSync(lockPath);
        if (lockStat.mtimeMs < pkgStat.mtimeMs) {
          issues.push({
            type: "lock_file_drift",
            severity: 2,
            description: `${lock} está desactualizado — package.json foi modificado depois do último 'install'`,
            location: lock,
            recommendation: `Executar 'npm install' ou 'pnpm install' para actualizar o lock file`,
            confidence: 0.95,
          });
        }
      }
    }
  } catch (err) { logger.debug("engineering-detectors", "Error in detectLockFileDrift:", err); }
  return issues;
}
