/**
 * Security detectors — Path traversal
 *
 * Detects file path manipulation without proper validation.
 */

import type { HealthIssue, SourceFileInfo } from "../types.js";
import { isDetectorDefinitionFile } from "./helpers.js";

const highConfidencePatterns = [
  /path\.join\s*\([^)]*req\./, /path\.resolve\s*\([^)]*req\./,
  /readFile(?:Sync)?\s*\([^)]*\breq\.(query|params|body)\b/,
  /writeFile(?:Sync)?\s*\([^)]*\breq\.(query|params|body)\b/,
  /unlink(?:Sync)?\s*\([^)]*\breq\.(query|params|body)\b/,
  /createReadStream\s*\([^)]*\breq\.(query|params|body)\b/,
];

const lowConfidencePatterns = [
  /readFile(?:Sync)?\s*\([^)]*\+/, /writeFile(?:Sync)?\s*\([^)]*\+/,
  /readFile(?:Sync)?\s*\([^)]*\$\{/, /writeFile(?:Sync)?\s*\([^)]*\$\{/,
  /createReadStream\s*\([^)]*\+/, /unlink(?:Sync)?\s*\([^)]*\+/,
];

export function detectPathTraversal(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  for (const file of files) {
    if (file.relPath.includes("__tests__")) continue;
    if (isDetectorDefinitionFile(file.relPath)) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (highConfidencePatterns.some((p) => p.test(line))) {
        issues.push({
          type: "path_traversal",
          severity: 3,
          description: `Possível path traversal em "${file.relPath}:${i + 1}" — caminho dinâmico sem validação`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Validar e sanitizar caminhos — usar path.resolve com prefixo seguro",
          confidence: 0.7,
        });
      } else if (lowConfidencePatterns.some((p) => p.test(line))) {
        issues.push({
          type: "path_traversal",
          severity: 1,
          description: `Caminho dinâmico em "${file.relPath}:${i + 1}" — concatenação/template literal (origem não comprovada)`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Verificar se a variável é interna e confiável — se sim, pode ignorar",
          confidence: 0.35,
        });
      }
    }
  }
  return issues;
}
