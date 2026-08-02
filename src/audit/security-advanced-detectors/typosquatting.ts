/**
 * Typosquatting detection with multiple strategies:
 * Levenshtein distance, character substitution, and hyphen variants.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { HealthIssue, SourceFileInfo } from "../types.js";
import { POPULAR_PACKAGES, CHAR_SUBSTITUTIONS } from "./constants.js";

// ── Levenshtein Distance ────────────────────────────────────────────────────

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    const row = dp[i];
    if (row) row[0] = i;
  }
  for (let j = 0; j <= n; j++) {
    const firstRow = dp[0];
    if (firstRow) firstRow[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const prevRow = dp[i - 1];
      const currRow = dp[i];
      if (prevRow && currRow) {
        currRow[j] = Math.min(
          (prevRow[j] ?? 0) + 1,
          (currRow[j - 1] ?? 0) + 1,
          (prevRow[j - 1] ?? 0) + cost,
        );
      }
    }
  }

  return dp[m]?.[n] ?? 0;
}

// ── Character Substitution Variants ─────────────────────────────────────────

/** Generate character substitution variants of a package name */
function generateSubstitutionVariants(name: string): string[] {
  const variants = new Set<string>();
  for (let i = 0; i < name.length; i++) {
    const char = name[i]!;
    const subs = CHAR_SUBSTITUTIONS[char];
    if (subs) {
      for (const sub of subs) {
        variants.add(name.slice(0, i) + sub + name.slice(i + 1));
      }
    }
  }
  return Array.from(variants);
}

// ── Hyphen and Typo Pattern Checks ──────────────────────────────────────────

function checkHyphenVariants(depName: string, popular: string): string[] {
  const matches: string[] = [];
  const lower = depName.toLowerCase();
  const pop = popular.toLowerCase();
  if (lower.replace(/-/g, "") === pop.replace(/-/g, "") && lower !== pop) matches.push("concatenação sem hífen");
  if ((lower.startsWith(pop + "-") || lower.endsWith("-" + pop)) && lower.length > pop.length + 2) matches.push("prefixo/sufixo extra");
  if (lower.endsWith("-" + pop) && lower.length < pop.length + 10) matches.push("prefixo suspeito");
  return matches;
}

function checkTypoPatterns(depName: string, popular: string): string[] {
  const lower = depName.toLowerCase();
  const variants = generateSubstitutionVariants(popular.toLowerCase());
  return variants.some((v) => lower === v) ? ["substituição de caractere"] : [];
}

// ── Main Detector ───────────────────────────────────────────────────────────

export function detectTyposquatting(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const packageJsonPath = join(projectRoot, "package.json");

  if (!existsSync(packageJsonPath)) return issues;

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const suspiciousPackages: string[] = [];
  const seen = new Set<string>();

  for (const depName of Object.keys(allDeps)) {
    if (seen.has(depName)) continue;

    for (const popular of POPULAR_PACKAGES) {
      if (depName.toLowerCase() === popular.toLowerCase()) continue;

      const reasons: string[] = [];

      // Strategy 1: Levenshtein distance (original)
      const dist = levenshteinDistance(depName.toLowerCase(), popular.toLowerCase());
      if (dist <= 2 && dist > 0) {
        reasons.push(`Levenshtein=${dist}`);
      }

      // Strategy 2: Hyphenation variants
      const hyphenMatches = checkHyphenVariants(depName, popular);
      reasons.push(...hyphenMatches);

      // Strategy 3: Character substitution
      const typoMatches = checkTypoPatterns(depName, popular);
      reasons.push(...typoMatches);

      if (reasons.length > 0) {
        suspiciousPackages.push(`${depName} (similar a ${popular}: ${reasons.join(", ")})`);
        seen.add(depName);
        break; // One match per package is enough
      }
    }
  }

  if (suspiciousPackages.length > 0) {
    issues.push({
      type: "typosquatting_risk",
      severity: 3,
      description: `${suspiciousPackages.length} pacotes potencialmente suspeitos (typosquatting)`,
      location: "package.json",
      recommendation: `Verificar pacotes: ${suspiciousPackages.join("; ")}`,
      confidence: 0.9,
    });
  }

  return issues;
}
