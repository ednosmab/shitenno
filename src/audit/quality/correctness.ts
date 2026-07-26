import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../logger.js";
import type { HealthIssue, SourceFileInfo } from "../types.js";

export function detectUnsafeTypeAssertions(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  let unsafeCount = 0;
  const unsafeFiles: string[] = [];

  const patterns = [
    { regex: /as\s+unknown\s+as/g, name: "as unknown as" },
    { regex: /@\s*ts-ignore/g, name: "@ts-ignore" },
    { regex: /@\s*ts-expect-error/g, name: "@ts-expect-error" },
    { regex: /as\s+any\b/g, name: "as any" },
  ];

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    let fileCount = 0;
    for (const { regex } of patterns) {
      const matches = file.content.match(regex);
      if (matches) {
        fileCount += matches.length;
      }
    }

    if (fileCount > 0) {
      unsafeCount += fileCount;
      if (unsafeFiles.length < 5) {
        unsafeFiles.push(`${file.relPath} (${fileCount})`);
      }
    }
  }

  if (unsafeCount > 0) {
    issues.push({
      type: "unsafe_type_assertion",
      severity: unsafeCount > 20 ? 2 : 1,
      description: `${unsafeCount} afirmação(ões) de tipo insegura(s): ${unsafeFiles.join(", ")}`,
      location: "src/",
      recommendation: "Substituir 'as unknown as X' por type guards. Remover @ts-ignore e corrigir o problema de tipo.",
      confidence: 0.75,
    });
  }

  return issues;
}

export function detectUnreachableCode(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];
  let unreachableCount = 0;
  const unreachableLocations: string[] = [];

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;
    const result = scanFileForUnreachableCode(file);
    unreachableCount += result.count;
    unreachableLocations.push(...result.locations);
  }

  if (unreachableCount > 0) {
    issues.push({ type: "unreachable_code", severity: 2,
      description: `${unreachableCount} linha(s) inalcançável(s) detectada(s): ${unreachableLocations.join(", ")}`,
      location: unreachableLocations.join(", "), recommendation: "Remover código inalcançável após return/throw/break/continue.", confidence: 0.7 });
  }

  return issues;
}

export function detectUnusedImports(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  let unusedCount = 0;
  const unusedFiles: string[] = [];

  const importRegex = /import\s+(?:{[^}]+}|[\w*]+(?:\s*,\s*{[^}]+})?)\s+from\s+["']([^"']+)["']/g;

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    let match;
    importRegex.lastIndex = 0;
    while ((match = importRegex.exec(file.content)) !== null) {
      const importClause = match[0];
      const importPath = match[1];
      if (!importPath?.startsWith(".")) continue;

      const namedImports = importClause.match(/{([^}]+)}/);
      if (!namedImports) continue;

      const importNames = namedImports[1]!.split(",").map((s) => {
        const parts = s.trim().split(/\s+as\s+/);
        return (parts.length > 1 ? parts[1] : parts[0])!.trim();
      });

      let fileUnused = 0;
      for (const name of importNames) {
        const wordBoundary = new RegExp(`\\b${name}\\b`);
        const restOfFile = file.content.slice(match.index! + importClause.length);
        if (!wordBoundary.test(restOfFile)) {
          fileUnused++;
        }
      }

      if (fileUnused > 0) {
        unusedCount += fileUnused;
        if (unusedFiles.length < 5) {
          unusedFiles.push(file.relPath);
        }
      }
    }
  }

  if (unusedCount > 0) {
    issues.push({
      type: "unused_import",
      severity: 1,
      description: `${unusedCount} import(s) não utilizado(s) em ${unusedFiles.join(", ")}`,
      location: unusedFiles.join(", "),
      recommendation: "Remover imports não utilizados para reduzir acoplamento e melhorar legibilidade.",
      confidence: 0.7,
    });
  }

  return issues;
}

export function detectCoverageThreshold(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const vitestPath = join(projectRoot, "vitest.config.ts");
  if (!existsSync(vitestPath)) return issues;

  try {
    const content = readFileSync(vitestPath, "utf-8");
    const linesMatch = content.match(/lines:\s*(\d+)/);
    const functionsMatch = content.match(/functions:\s*(\d+)/);

    if (linesMatch) {
      const linesThreshold = parseInt(linesMatch[1]!, 10);
      if (linesThreshold < 70) {
        issues.push({
          type: "low_coverage_threshold",
          severity: 2,
          description: `Threshold de coverage de linhas em ${linesThreshold}% — mínimo recomendado: 70%`,
          location: "vitest.config.ts",
          recommendation: "Aumentar threshold para ≥70% para garantir cobertura mínima.",
          confidence: 0.85,
        });
      }
    }

    if (functionsMatch) {
      const functionsThreshold = parseInt(functionsMatch[1]!, 10);
      if (functionsThreshold < 80) {
        issues.push({
          type: "low_coverage_threshold",
          severity: 1,
          description: `Threshold de coverage de funções em ${functionsThreshold}% — mínimo recomendado: 80%`,
          location: "vitest.config.ts",
          recommendation: "Aumentar threshold para ≥80% para garantir cobertura de funções.",
          confidence: 0.85,
        });
      }
    }
  } catch {
    logger.debug("code-quality", "Failed to read vitest config");
  }

  return issues;
}

function isUnreachableLine(trimmed: string): boolean {
  return trimmed.length > 0 && !trimmed.startsWith("}") && !trimmed.startsWith("case ") && !trimmed.startsWith("default:") && !trimmed.startsWith("catch") && !trimmed.startsWith("finally");
}

function isTerminalStatement(trimmed: string): { return: boolean; throw: boolean; break: boolean; continue: boolean } {
  return {
    return: /^\s*(?:return\b|process\.exit\()/i.test(trimmed) && !trimmed.endsWith("{"),
    throw: /^\s*throw\b/i.test(trimmed) && !trimmed.endsWith("{"),
    break: /^\s*break\b/i.test(trimmed),
    continue: /^\s*continue\b/i.test(trimmed),
  };
}

function scanFileForUnreachableCode(file: SourceFileInfo): { count: number; locations: string[] } {
  let count = 0;
  const locations: string[] = [];
  const lines = file.content.split("\n");
  let state = { return: false, throw: false, break: false, continue: false };
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;
    if ((state.return || state.throw || state.break || state.continue) && isUnreachableLine(trimmed)) {
      count++;
      if (locations.length < 5) locations.push(`${file.relPath}:${i + 1}`);
      state = { return: false, throw: false, break: false, continue: false };
    }
    state = isTerminalStatement(trimmed);
  }
  return { count, locations };
}
