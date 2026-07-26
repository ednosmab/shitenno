/**
 * Security detectors — Secrets and credentials
 *
 * Detects hardcoded secrets, API keys, credentials, and dependency confusion.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../logger.js";
import type { HealthIssue, SourceFileInfo } from "../types.js";
import { isDetectorDefinitionFile, shannonEntropy, extractPackageName, isUndeclaredDependency } from "./helpers.js";

/**
 * Detect hardcoded secrets, API keys, and credentials in source code.
 */
export function detectHardcodedSecrets(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const secretPatterns = [
    { regex: /(?:password|passwd|pwd)\s*[=:]\s*["'][^"']{3,}["']/gi, name: "password" },
    { regex: /(?:api[_-]?key|apikey)\s*[=:]\s*["'][^"']{8,}["']/gi, name: "API key" },
    { regex: /(?:secret|token)\s*[=:]\s*["'][A-Za-z0-9_\-\.]{16,}["']/gi, name: "secret/token" },
    { regex: /(?:private[_-]?key)\s*[=:]\s*["'][^"']{16,}["']/gi, name: "private key" },
    { regex: /(?:aws[_-]?access[_-]?key[_-]?id)\s*[=:]\s*["'][A-Z0-9]{16,}["']/gi, name: "AWS key" },
    { regex: /(?:bearer)\s+[A-Za-z0-9_\-\.]{20,}/gi, name: "bearer token" },
  ];

  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;
    if (isDetectorDefinitionFile(file.relPath)) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;
      for (const { regex, name } of secretPatterns) {
        const m = line.match(regex);
        if (m) {
          issues.push({
            type: "hardcoded_secret",
            severity: 3,
            description: `Possível ${name} hardcoded em "${file.relPath}:${i + 1}"`,
            location: `${file.relPath}:${i + 1}`,
            recommendation: `Mover ${name} para variável de ambiente ou ficheiro de configuração seguro`,
            confidence: shannonEntropy(m[0] ?? "") > 4.0 ? 0.9 : 0.55,
          });
          break;
        }
      }
    }
  }
  return issues;
}

/**
 * Detect sensitive data logged to console.
 */
export function detectConsoleSecrets(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const sensitivePatterns = [
    /console\.(log|info|warn|error|debug)\s*\(.*\b(?:password|api[_-]?key|access[_-]?token|auth[_-]?token|secret|credential)s?\b/i,
    /console\.(log|info|warn|error|debug)\s*\(.*(?:req\.headers|req\.cookies)/i,
  ];
  const falsePositiveContext = /\b(estimated|saved|monthly|total|context|window|token)\w*\s*[\.\[]?\s*tokens?\b/i;

  for (const file of files) {
    if (file.relPath.includes("__tests__")) continue;
    if (isDetectorDefinitionFile(file.relPath)) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (sensitivePatterns.some((p) => p.test(line)) && !falsePositiveContext.test(line)) {
        issues.push({
          type: "console_secret",
          severity: 3,
          description: `Dados sensíveis em console em "${file.relPath}:${i + 1}" — pode expor credenciais em logs`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Remover console.log com dados sensíveis ou mascarar valores antes de logar",
          confidence: 0.7,
        });
      }
    }
  }
  return issues;
}

/**
 * Detect dependency confusion (importing undeclared packages).
 */
export function detectDependencyConfusion(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const declaredDeps = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ]);

    const importRegex = /(?:from|import)\s+["']([^"'./][^"']*)["']/g;

    for (const file of files) {
      let match;
      importRegex.lastIndex = 0;
      while ((match = importRegex.exec(file.content)) !== null) {
        const spec = match[1];
        if (!spec || spec.includes("${")) continue;
        const pkgName = extractPackageName(spec);
        if (!isUndeclaredDependency(pkgName, declaredDeps, projectRoot)) continue;
        issues.push({
          type: "dep_confusion",
          severity: 2,
          description: `Dependência "${pkgName}" importada em "${file.relPath}" mas não existe em node_modules nem em package.json`,
          location: file.relPath,
          recommendation: `Adicionar "${pkgName}" ao package.json ou verificar se o nome está correcto`,
          confidence: 0.7,
        });
      }
    }
  } catch (err) { logger.debug("security/secrets", "Error in detectDependencyConfusion:", err); }
  return issues;
}
