/**
 * Config detectors — Skills and stack
 *
 * Detects orphan skills, empty stack, and maturity score inconsistencies.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../logger.js";
import type { HealthIssue } from "../types.js";
import { listSkills } from "../../knowledge-loader.js";
import { ISSUE_TYPE_TO_SKILL } from "../skill-refs.js";

/**
 * Detect skills that have no associated detector.
 */
export function detectOrphanSkills(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  try {
    const skills = listSkills(shitennoDir);
    const referencedSkills = new Set(Object.values(ISSUE_TYPE_TO_SKILL));

    for (const skill of skills) {
      if (!referencedSkills.has(skill.name)) {
        issues.push({
          type: "orphan_skill",
          severity: 1,
          description: `Skill "${skill.name}" não tem nenhum detector associado — só existe como prosa, sem checagem automática`,
          location: `docs/skills/${skill.filename}`,
          recommendation: `Se a skill documenta uma prática checável por código, considerar criar um detector e registrar em ISSUE_TYPE_TO_SKILL`,
          confidence: 0.7,
        });
      }
    }
  } catch (err) { logger.debug("config/skills", "Error in detectOrphanSkills:", err); }
  return issues;
}

/**
 * Detect empty stack in fingerprint.json.
 */
export function detectEmptyStack(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const fpPath = join(shitennoDir, "fingerprint.json");
  if (!existsSync(fpPath)) return issues;

  try {
    const data = JSON.parse(readFileSync(fpPath, "utf-8"));
    if (Array.isArray(data.stack) && data.stack.length === 0) {
      issues.push({
        type: "empty_stack",
        severity: 3,
        description: "fingerprint.json tem stack: [] vazio — projecto TypeScript não detectado",
        location: "shitenno/fingerprint.json",
        recommendation: 'Actualizar stack para ["typescript"] ou re-executar fingerprint',
        confidence: 0.9,
      });
    }
  } catch (err) { logger.debug("config/skills", "Error in detectEmptyStack:", err); }
  return issues;
}

/**
 * Detect inconsistent maturity scores across three sources.
 */
export function detectTripleMaturityScore(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const fpPath = join(shitennoDir, "fingerprint.json");
  const mpPath = join(shitennoDir, "maturity-profile.json");
  const briefingPath = join(shitennoDir, "BRIEFING.md");

  const scores: { source: string; value: number | null }[] = [];

  if (existsSync(fpPath)) {
    try {
      const data = JSON.parse(readFileSync(fpPath, "utf-8"));
      scores.push({ source: "fingerprint.json", value: data.maturityScore ?? null });
    } catch (fpErr) { logger.debug("config/skills", "Error reading fingerprint.json:", fpErr); }
  }
  if (existsSync(mpPath)) {
    try {
      const data = JSON.parse(readFileSync(mpPath, "utf-8"));
      scores.push({ source: "maturity-profile.json", value: data.overallScore ?? null });
    } catch (mpErr) { logger.debug("config/skills", "Error reading maturity-profile.json:", mpErr); }
  }
  if (existsSync(briefingPath)) {
    try {
      const content = readFileSync(briefingPath, "utf-8");
      const match = content.match(/Maturity:\s*(\d+)/);
      scores.push({ source: "BRIEFING.md", value: match ? Number(match[1]) : null });
    } catch (bErr) { logger.debug("config/skills", "Error reading BRIEFING.md:", bErr); }
  }

  const valid = scores.filter((s) => s.value !== null);
  if (valid.length >= 2) {
    const values = valid.map((s) => s.value!);
    const unique = new Set(values);
    if (unique.size > 1) {
      const details = valid.map((s) => `${s.source}: ${s.value}`).join(", ");
      issues.push({
        type: "triple_maturity_score",
        severity: 3,
        description: `Scores de maturidade inconsistentes: ${details}`,
        location: "shitenno/",
        recommendation: "Reconciliar — todos os ficheiros devem reflectir o mesmo valor",
        confidence: 0.9,
      });
    }
  }
  return issues;
}
