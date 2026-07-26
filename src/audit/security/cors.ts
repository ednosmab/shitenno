/**
 * Security detectors — CORS and cookie configuration
 *
 * Detects insecure CORS policies and missing cookie security flags.
 */

import type { HealthIssue, SourceFileInfo } from "../types.js";
import { isDetectorDefinitionFile, isSkippableFile, collectMissingFlags } from "./helpers.js";

/**
 * Detect insecure CORS wildcard configuration.
 */
export function detectInsecureCORS(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const corsPatterns = [
    /Access-Control-Allow-Origin['"]?\s*[,:]\s*['"]\*['"]/,
    /\bcors\s*\(\s*\)/,
  ];

  for (const file of files) {
    if (file.relPath.includes("__tests__")) continue;
    if (isDetectorDefinitionFile(file.relPath)) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (corsPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "insecure_cors",
          severity: 2,
          description: `CORS wildcard em "${file.relPath}:${i + 1}" — Access-Control-Allow-Origin: * permite qualquer origem`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Especificar origens permitidas em vez de usar wildcard *",
          confidence: 0.65,
        });
      }
    }
  }
  return issues;
}

function checkCookieFlags(
  block: string,
  flagNames: Record<string, string>,
): { hasAll: boolean; missing: string[] } {
  const flags: Record<string, boolean> = {};
  for (const [key, pattern] of Object.entries(flagNames)) {
    flags[key] = new RegExp(pattern, "i").test(block);
  }
  const missing = collectMissingFlags(flags);
  return { hasAll: missing.length === 0, missing };
}

function detectResCookieIssue(
  line: string,
  lines: string[],
  i: number,
  fileRelPath: string,
): HealthIssue | null {
  const cookieCallRegex = /res\.cookie\s*\(\s*['"][^'"]+['"]\s*,/i;
  if (!cookieCallRegex.test(line)) return null;
  const block = lines.slice(i, i + 6).join(" ");
  const { hasAll, missing } = checkCookieFlags(block, {
    httpOnly: "httpOnly\\s*[:=]\\s*true",
    secure: "secure\\s*[:=]\\s*true",
    sameSite: "sameSite\\s*[:=]",
  });
  if (hasAll) return null;
  return {
    type: "insecure_cookie",
    severity: 2,
    description: `Cookie sem flags de segurança em "${fileRelPath}:${i + 1}" — falta: ${missing.join(", ")}`,
    location: `${fileRelPath}:${i + 1}`,
    recommendation: `Adicionar flags: ${missing.map(f => `{${f}: true}`).join(", ")}`,
    confidence: 0.65,
  };
}

function detectSetCookieHeaderIssue(
  line: string,
  i: number,
  fileRelPath: string,
): HealthIssue | null {
  const setCookieRegex = /Set-Cookie\s*[=:]/i;
  if (!setCookieRegex.test(line)) return null;
  const { hasAll, missing } = checkCookieFlags(line, {
    httpOnly: "HttpOnly",
    secure: "Secure",
    sameSite: "SameSite",
  });
  if (hasAll) return null;
  return {
    type: "insecure_cookie",
    severity: 2,
    description: `Set-Cookie header sem flags em "${fileRelPath}:${i + 1}" — falta: ${missing.join(", ")}`,
    location: `${fileRelPath}:${i + 1}`,
    recommendation: `Adicionar flags: ${missing.join(", ")}`,
    confidence: 0.65,
  };
}

/**
 * Detect cookies missing security flags (HttpOnly, Secure, SameSite).
 */
export function detectInsecureCookies(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipFiles = [/__tests__/];

  for (const file of files) {
    if (isSkippableFile(file.relPath, skipFiles)) continue;
    if (isDetectorDefinitionFile(file.relPath)) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const issue = detectResCookieIssue(line, lines, i, file.relPath)
        ?? detectSetCookieHeaderIssue(line, i, file.relPath);
      if (issue) issues.push(issue);
    }
  }
  return issues;
}
