/**
 * Security detectors — Miscellaneous
 *
 * Detects regex DoS, prototype pollution, and insecure HTTP URLs.
 */

import type { HealthIssue, SourceFileInfo } from "../types.js";
import { isSkippableFile, isLocalHttpUrl } from "./helpers.js";

/**
 * Detect regular expressions vulnerable to ReDoS.
 */
export function detectRegexDos(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const redosPatterns = [
    /new\s+RegExp\s*\([^)]*\+[^)]*\+/, /new\s+RegExp\s*\([^)]*\*[^)]*\*/,
    /new\s+RegExp\s*\([^)]*\+[^)]*\)/,
  ];
  const nestedQuantifierPattern = /\/(?:[^/\\]|\\.)*\([^)]*[+*][^)]*\)[+*](?:[^/\\]|\\.)*\//;

  for (const file of files) {
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (redosPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "regex_dos",
          severity: 2,
          description: `Regex potencialmente vulnerable a ReDoS em "${file.relPath}:${i + 1}"`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Simplificar regex ou usar libraries como re2 — evitar backtracking complexo",
          confidence: 0.75,
        });
      } else if (nestedQuantifierPattern.test(line)) {
        issues.push({
          type: "regex_dos",
          severity: 2,
          description: `Regex literal com quantificadores aninhados em "${file.relPath}:${i + 1}" — pode ter backtracking exponencial`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Rever manualmente — pode causar catastrophic backtracking; considerar usar re2",
          confidence: 0.6,
        });
      }
    }
  }
  return issues;
}

/**
 * Detect prototype pollution patterns.
 * Uses multi-line regex on full file content for the generic for...in pattern
 * (matching the approach used by detectEmptyCatchBlocks in hygiene.ts).
 */
export function detectPrototypePollution(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pollPatterns = [
    /Object\.assign\s*\([^)]*req\./, /\.\[\s*["']__proto__["']\s*\]/,
    /\.\[\s*["']constructor["']\s*\]/, /\.\[\s*["']prototype["']\s*\]/,
    /merge\s*\([^)]*req\./, /deepMerge\s*\([^)]*req\./,
  ];
  const genericPollPattern = /for\s*\(\s*(?:const|let|var)\s+\w+\s+in\s+\w+\s*\)[\s\S]{0,80}\[\s*\w+\s*\]\s*=/g;

  for (const file of files) {
    // Single-line patterns (per-line scan)
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (pollPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "proto_pollution",
          severity: 3,
          description: `Possível prototype pollution em "${file.relPath}:${i + 1}"`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Validar/chavear input antes de Object.assign — nunca usar input directo em merge",
          confidence: 0.6,
        });
      }
    }

    // Multi-line pattern (full file content scan — matches cross-line for...in blocks)
    let match: RegExpExecArray | null;
    while ((match = genericPollPattern.exec(file.content)) !== null) {
      const lineNum = file.content.substring(0, match.index).split("\n").length;
      issues.push({
        type: "proto_pollution",
        severity: 2,
        description: `Atribuição por chave dinâmica em "${file.relPath}:${lineNum}" — for...in sem verificar __proto__/constructor`,
        location: `${file.relPath}:${lineNum}`,
        recommendation: "Verificar se a chave não é __proto__ ou constructor antes de atribuir",
        confidence: 0.6,
      });
    }
  }
  return issues;
}

/**
 * Detect insecure HTTP URLs in production code.
 */
export function detectInsecureHTTP(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const httpPattern = /["']http:\/\/[^"']{5,}["']/g;
  const skipFiles = [/\.test\.ts$/, /\.spec\.ts$/, /README/, /CHANGELOG/];

  for (const file of files) {
    if (isSkippableFile(file.relPath, skipFiles)) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.trim().startsWith("//")) continue;
      const matches = line.match(httpPattern);
      if (!matches) continue;
      for (const url of matches) {
        if (isLocalHttpUrl(url)) continue;
        issues.push({
          type: "insecure_http",
          severity: 2,
          description: `URL HTTP insegura em "${file.relPath}:${i + 1}": ${url}`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Usar HTTPS em vez de HTTP para URLs de produção",
          confidence: 0.7,
        });
      }
    }
  }
  return issues;
}
