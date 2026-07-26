/**
 * Security detectors — Cryptographic weaknesses
 *
 * Detects weak crypto algorithms and insufficient randomness.
 */

import type { HealthIssue, SourceFileInfo } from "../types.js";
import { isDetectorDefinitionFile } from "./helpers.js";

/**
 * Detect weak cryptographic algorithms (MD5, SHA1, createCipher).
 */
export function detectWeakCrypto(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const weakPatterns = [
    /\.createHash\s*\(\s*["'](?:md5|sha1)["']\)/i,
    /\.createCipher(?!iv)\s*\(/i, /\.createDecipher(?!iv)\s*\(/i,
    /crypto\.createCipheriv\s*\([^)]*[^"']md5/i,
  ];

  for (const file of files) {
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (weakPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "weak_crypto",
          severity: 2,
          description: `Criptografia fraca em "${file.relPath}:${i + 1}" — MD5/SHA1 ou createCipher`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Usar algoritmos modernos: SHA-256+, AES-256-GCM em vez de MD5/SHA1",
          confidence: 0.65,
        });
      }
    }
  }
  return issues;
}

/**
 * Detect Math.random() used for security-sensitive value generation.
 */
export function detectWeakRandomness(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const assignmentPattern = /(?:const|let|var)\s+\w*(?:token|password|secret|key|session|uuid|id)\w*\s*=\s*[^;]*Math\.random/i;

  for (const file of files) {
    if (file.relPath.includes("__tests__")) continue;
    if (isDetectorDefinitionFile(file.relPath)) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;
      if (assignmentPattern.test(line)) {
        issues.push({
          type: "weak_randomness",
          severity: 2,
          description: `Math.random() usado para geração de segredo em "${file.relPath}:${i + 1}" — entropia insuficiente`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Usar crypto.randomBytes() ou crypto.randomUUID() para tokens/senhas",
          confidence: 0.65,
        });
      }
    }
  }
  return issues;
}
