/**
 * Docs detectors — Maturity
 *
 * Detects inconsistent maturity scores across project files.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../logger.js";
import type { HealthIssue } from "../types.js";

/**
 * Detect inconsistent maturity scores across fingerprint, maturity-profile, and briefing.
 */
export function detectMaturityInconsistency(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const fingerprintPath = join(shitennoDir, "fingerprint.json");
  const maturityPath = join(shitennoDir, "maturity-profile.json");
  const briefingPath = join(shitennoDir, "BRIEFING.md");

  const scores: { source: string; score: number }[] = [];

  try {
    if (existsSync(fingerprintPath)) {
      const data = JSON.parse(readFileSync(fingerprintPath, "utf-8"));
      if (typeof data.maturityScore === "number") {
        scores.push({ source: "fingerprint.json", score: data.maturityScore });
      }
    }
  } catch (err) { logger.debug("docs/maturity", "Error reading fingerprint.json:", err); }

  try {
    if (existsSync(maturityPath)) {
      const data = JSON.parse(readFileSync(maturityPath, "utf-8"));
      if (typeof data.overallScore === "number") {
        scores.push({ source: "maturity-profile.json", score: data.overallScore });
      }
    }
  } catch (err) { logger.debug("docs/maturity", "Error reading maturity-profile.json:", err); }

  try {
    if (existsSync(briefingPath)) {
      const content = readFileSync(briefingPath, "utf-8");
      const scoreMatch = content.match(/Maturity:\s*(\d+)\/100/i);
      if (scoreMatch?.[1]) {
        scores.push({ source: "BRIEFING.md", score: parseInt(scoreMatch[1], 10) });
      }
    }
  } catch (err) { logger.debug("docs/maturity", "Error reading BRIEFING.md:", err); }

  if (scores.length >= 2) {
    const uniqueScores = new Set(scores.map((s) => s.score));
    if (uniqueScores.size > 1) {
      const scoreList = scores.map((s) => `${s.source}: ${s.score}`).join(", ");
      issues.push({
        type: "maturity_inconsistency",
        severity: 2,
        description: `Scores de maturidade inconsistentes: ${scoreList}`,
        location: "shitenno/",
        recommendation: "Reconciliar scores — todos os ficheiros devem reflectir o mesmo valor",
        confidence: 0.9,
      });
    }
  }

  return issues;
}
