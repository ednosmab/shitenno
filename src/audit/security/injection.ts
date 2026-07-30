/**
 * Security detectors — Injection vulnerabilities
 *
 * Detects SQL injection, XSS, unsafe eval, and unsafe deserialization.
 */

import type { HealthIssue, SourceFileInfo } from "../types.js";
import { isDetectorDefinitionFile } from "./helpers.js";
import { stripComments } from "../shared.js";

/**
 * Detect potential SQL injection vulnerabilities in source code.
 */
export function detectSQLInjection(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const sqlPatterns = [
    /\.query\s*\(\s*[`"'].*\$\{/, /\.execute\s*\(\s*[`"'].*\$\{/,
    /\.raw\s*\(\s*[`"'].*\$\{/, /SELECT\s+.*\+\s*[a-zA-Z]/i,
    /INSERT\s+INTO.*\+\s*[a-zA-Z]/i, /UPDATE\s+.*\+\s*[a-zA-Z]/i,
    /DELETE\s+FROM.*\+\s*[a-zA-Z]/i,
  ];

  for (const file of files) {
    if (isDetectorDefinitionFile(file.relPath)) continue;
    const codeOnly = stripComments(file.content);
    const lines = codeOnly.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (sqlPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "sql_injection",
          severity: 3,
          description: `Possível SQL injection em "${file.relPath}:${i + 1}" — query construída com concatenação/template literal`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Usar prepared statements ou parameterized queries em vez de concatenação",
          confidence: 0.65,
        });
      }
    }
  }
  return issues;
}

/**
 * Detect potential Cross-Site Scripting (XSS) vulnerabilities.
 */
export function detectXSS(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const xssPatterns = [
    /\.innerHTML\s*[=+]/, /dangerouslySetInnerHTML/, /document\.write\s*\(/,
    /\.outerHTML\s*[=+]/, /insertAdjacentHTML/, /eval\s*\(.*innerHTML/,
  ];

  for (const file of files) {
    if (file.relPath.includes("__tests__")) continue;
    if (isDetectorDefinitionFile(file.relPath)) continue;
    const codeOnly = stripComments(file.content);
    const lines = codeOnly.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (xssPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "xss_risk",
          severity: 3,
          description: `Possível XSS em "${file.relPath}:${i + 1}" — inserção directa de HTML`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Sanitizar input antes de inserir HTML, ou usar framework com escaping automático",
          confidence: 0.65,
          skillRef: "security_xss_prevention",
        });
      }
    }
  }
  return issues;
}

/**
 * Detect unsafe eval and dynamic Function usage.
 */
export function detectUnsafeEval(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const evalPatterns = [
    /eval\s*\(/, /new\s+Function\s*\(/, /setTimeout\s*\(\s*["']/,
    /setInterval\s*\(\s*["']/, /Function\s*\(\s*["']/,
  ];

  for (const file of files) {
    if (file.relPath.includes("__tests__")) continue;
    if (isDetectorDefinitionFile(file.relPath)) continue;
    const codeOnly = stripComments(file.content);
    const lines = codeOnly.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (evalPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "unsafe_eval",
          severity: 3,
          description: `eval/Function dinâmico em "${file.relPath}:${i + 1}" — risco de code injection`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Evitar eval/Function dinâmicos — usar alternativas seguras como JSON.parse()",
          confidence: 0.7,
        });
      }
    }
  }
  return issues;
}

/**
 * Detect unsafe deserialization patterns.
 */
export function detectUnsafeDeserialization(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const realDeserializationSinks = [
    /js-yaml['"]\)?\.load\s*\(/,
    /node-serialize['"]\)?\.unserialize\s*\(/,
    /vm\.runInNewContext\s*\(/,
    /vm\.runInThisContext\s*\(/,
  ];

  const unvalidatedJsonPatterns = [
    /JSON\.parse\s*\(.*req\./,
    /JSON\.parse\s*\(.*process\.argv/,
    /JSON\.parse\s*\(.*readFile/,
  ];

  for (const file of files) {
    if (isDetectorDefinitionFile(file.relPath)) continue;
    const codeOnly = stripComments(file.content);
    const lines = codeOnly.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (realDeserializationSinks.some((p) => p.test(line))) {
        issues.push({
          type: "unsafe_deserialize",
          severity: 3,
          description: `Unsafe deserialization em "${file.relPath}:${i + 1}" — risco de RCE`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Usar yaml.safeLoad(), vm.runInNewContext com sandbox, ou evitar deserialização de input não confiável",
          confidence: 0.65,
        });
      } else if (unvalidatedJsonPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "unsafe_deserialize",
          severity: 1,
          description: `JSON.parse com input não validado em "${file.relPath}:${i + 1}" — sem schema validation`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Validar JSON com schema (zod/joi) antes de processar",
          confidence: 0.65,
        });
      }
    }
  }
  return issues;
}
