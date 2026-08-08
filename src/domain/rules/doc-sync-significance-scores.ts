/**
 * doc-sync-significance-scores.ts — Scoring Constants
 *
 * Weighted criteria and score maps used by the change significance calculator.
 */

import type { ArtifactType } from "./doc-sync-significance-types.js";

// ── Weights ──────────────────────────────────────────────────────────────────

export const ARTIFACT_WEIGHT = 0.4;
export const DIRECTORY_WEIGHT = 0.3;
export const FREQUENCY_WEIGHT = 0.2;
export const SIZE_WEIGHT = 0.1;

// ── Artifact Scores ──────────────────────────────────────────────────────────

export const ARTIFACT_SCORES: Record<ArtifactType, number> = {
  skill: 1.0,
  adr: 1.0,
  workflow: 0.9,
  rule: 0.7,
  doc: 0.6,
  config: 0.3,
  script: 0.3,
  telemetry: 0.0,
  report: 0.0,
  feedback: 0.0,
  generated: 0.0,
  unknown: 0.1,
};

// ── Directory Scores ─────────────────────────────────────────────────────────

export const DIRECTORY_SCORES: Record<string, number> = {
  "docs/skills/": 1.0,
  "docs/adrs/": 0.9,
  "docs/generated/": 0.0,
  "governance/agents/": 0.9,
  "governance/WORKFLOW": 1.0,
  "governance/context/": 0.6,
  "governance/rules/": 0.7,
  "governance/contracts/": 0.8,
  "governance/handoffs/": 0.6,
  "governance/policies/": 0.7,
  "governance/premortem/": 0.6,
  "governance/reviews/": 0.6,
  "docs/": 0.7,
  "core/": 0.4,
  "scripts/": 0.3,
  "cognition/": 0.5,
  "telemetry/": 0.0,
  "reports/": 0.0,
  "feedback/": 0.0,
  "session-feedback/": 0.0,
};

// ── Artifact Detection Maps ──────────────────────────────────────────────────

export const ARTIFACT_PREFIX_MAP: Array<[string, ArtifactType]> = [
  ["docs/generated/", "generated"],
  ["docs/skills/", "skill"],
  ["docs/adrs/", "adr"],
  ["governance/WORKFLOW", "workflow"],
  ["governance/rules/", "rule"],
  ["governance/agents/", "config"],
  ["governance/", "doc"],
  ["docs/", "doc"],
  ["scripts/", "script"],
  ["telemetry/", "telemetry"],
  ["reports/", "report"],
  ["feedback/", "feedback"],
  ["session-feedback/", "feedback"],
  ["core/", "config"],
  ["cognition/", "doc"],
];

export const ARTIFACT_EXTENSION_MAP: Array<[RegExp, ArtifactType]> = [
  [/\.json$|\.yaml$/, "config"],
  [/\.md$/, "doc"],
  [/\.(ts|tsx|js|jsx|vue|svelte)$/, "script"],
];
