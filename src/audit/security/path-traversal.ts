/**
 * Security detectors — Path traversal
 *
 * Detects file path manipulation without proper validation.
 */

import type { HealthIssue, SourceFileInfo } from "../types.js";
import { isDetectorDefinitionFile } from "./helpers.js";

/**
 * Detect potential path traversal vulnerabilities.
 */
export function detectPathTraversal(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const traversalPatterns = [
    /readFile(?:Sync)?\s*\([^)]*\+/, /writeFile(?:Sync)?\s*\([^)]*\+/,
    /readFile(?:Sync)?\s*\([^)]*\$\{/, /writeFile(?:Sync)?\s*\([^)]*\$\{/,
    /createReadStream\s*\([^)]*\+/, /unlink(?:Sync)?\s*\([^)]*\+/,
    /path\.join\s*\([^)]*req\./, /path\.resolve\s*\([^)]*req\./,
    /readFile(?:Sync)?\s*\([^)]*\breq\.(query|params|body)\b/,
    /writeFile(?:Sync)?\s*\([^)]*\breq\.(query|params|body)\b/,
    /unlink(?:Sync)?\s*\([^)]*\breq\.(query|params|body)\b/,
    /createReadStream\s*\([^)]*\breq\.(query|params|body)\b/,
  ];

  for (const file of files) {
    if (file.relPath.includes("__tests__")) continue;
    if (isDetectorDefinitionFile(file.relPath)) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (traversalPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "path_traversal",
          severity: 3,
          description: `Possível path traversal em "${file.relPath}:${i + 1}" — caminho dinâmico sem validação`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Validar e sanitizar caminhos — usar path.resolve com prefixo seguro",
          confidence: 0.65,
        });
      }
    }
  }
  return issues;
}
