/**
 * semantic-growth-profile.ts — Semantic Layer Growth Profile
 *
 * Extends the base growth profile to work with semantic patterns.
 * Tracks how the user responds to semantic pattern presentations
 * and adapts the level of challenge accordingly.
 *
 * PRINCIPLE: The system learns from semantic feedback and adapts
 * which patterns to surface and how to present them.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import type { PatternType } from "./pattern-rules.js";
import type { GrowthProfile, PathChoice } from "../growth-profile.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface SemanticPathChoice extends PathChoice {
  /** Semantic pattern type that triggered this choice */
  patternType: PatternType;
  /** Semantic domain involved */
  domain: string;
}

export interface SemanticGrowthProfile extends GrowthProfile {
  /** Semantic-specific path choices */
  semanticChoices: SemanticPathChoice[];
  /** Pattern presentation frequency (which patterns get shown more) */
  patternFrequency: Record<PatternType, number>;
  /** Domain-specific challenge levels */
  domainChallengeLevels: Record<string, number>;
}

// ── Constants ───────────────────────────────────────────────────────────────

const PROFILE_FILENAME = "semantic-growth-profile.json";
const SEMANTIC_HISTORY_LIMIT = 200;
const FREQUENCY_DECAY = 0.95;

// ── Storage ─────────────────────────────────────────────────────────────────

function getProfilePath(shitennoDir: string): string {
  return join(shitennoDir, "governance", PROFILE_FILENAME);
}

// ── Load / Save ─────────────────────────────────────────────────────────────

export function loadSemanticGrowthProfile(shitennoDir: string): SemanticGrowthProfile {
  const profilePath = getProfilePath(shitennoDir);

  if (!existsSync(profilePath)) {
    return createDefaultSemanticProfile();
  }

  try {
    const content = JSON.parse(readFileSync(profilePath, "utf-8"));
    if (validateSemanticProfile(content)) {
      return content;
    }
    return createDefaultSemanticProfile();
  } catch {
    return createDefaultSemanticProfile();
  }
}

export function saveSemanticGrowthProfile(shitennoDir: string, profile: SemanticGrowthProfile): void {
  const dir = join(shitennoDir, "governance");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const updated = { ...profile, updatedAt: new Date().toISOString() };
  writeFileSync(getProfilePath(shitennoDir), JSON.stringify(updated, null, 2), "utf-8");
}

// ── Record Choices ──────────────────────────────────────────────────────────

export function recordSemanticPathChoice(
  shitennoDir: string,
  choice: Omit<SemanticPathChoice, "id" | "timestamp">
): SemanticGrowthProfile {
  const profile = loadSemanticGrowthProfile(shitennoDir);

  const fullChoice: SemanticPathChoice = {
    ...choice,
    id: `SPC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };

  profile.semanticChoices.push(fullChoice);
  profile.pathHistory.push(fullChoice);

  // Limit history
  if (profile.semanticChoices.length > SEMANTIC_HISTORY_LIMIT) {
    profile.semanticChoices = profile.semanticChoices.slice(-SEMANTIC_HISTORY_LIMIT);
  }
  if (profile.pathHistory.length > SEMANTIC_HISTORY_LIMIT) {
    profile.pathHistory = profile.pathHistory.slice(-SEMANTIC_HISTORY_LIMIT);
  }

  // Update pattern frequency (decay existing, boost chosen)
  for (const type of Object.keys(profile.patternFrequency) as PatternType[]) {
    profile.patternFrequency[type] = (profile.patternFrequency[type] ?? 0) * FREQUENCY_DECAY;
  }
  profile.patternFrequency[choice.patternType] =
    (profile.patternFrequency[choice.patternType] ?? 0) + 1;

  // Update domain challenge level
  const currentLevel = profile.domainChallengeLevels[choice.domain] ?? 0.5;
  if (choice.pathChosen === "challenging") {
    profile.domainChallengeLevels[choice.domain] = Math.min(currentLevel + 0.05, 1.0);
  } else {
    profile.domainChallengeLevels[choice.domain] = Math.max(currentLevel - 0.03, 0.0);
  }

  // Recalculate base metrics
  profile.growthCapacity = calculateSemanticGrowthCapacity(profile);
  profile.challengeLevel = calculateSemanticChallengeLevel(profile);
  profile.patterns = detectSemanticGrowthPatterns(profile);

  saveSemanticGrowthProfile(shitennoDir, profile);
  return profile;
}

// ── Calculations ────────────────────────────────────────────────────────────

function calculateSemanticGrowthCapacity(profile: SemanticGrowthProfile): number {
  const history = profile.semanticChoices;
  if (history.length === 0) return 0.3;

  const recent = history.slice(-15);
  const challengingCount = recent.filter((c) => c.pathChosen === "challenging").length;
  const ratio = challengingCount / recent.length;

  return 0.1 + ratio * 0.8;
}

function calculateSemanticChallengeLevel(profile: SemanticGrowthProfile): number {
  const capacity = profile.growthCapacity;
  const challenge = capacity * 0.7 + 0.15;
  return Math.max(0.0, Math.min(1.0, challenge));
}

// ── Pattern Detection ───────────────────────────────────────────────────────

function detectSemanticGrowthPatterns(profile: SemanticGrowthProfile): GrowthProfile["patterns"] {
  const history = profile.semanticChoices;

  if (history.length < 3) {
    return [
      {
        type: "balanced",
        confidence: 0.3,
        description: "Insufficient semantic data — defaulting to balanced",
      },
    ];
  }

  const recent = history.slice(-15);
  const challengingCount = recent.filter((c) => c.pathChosen === "challenging").length;
  const ratio = challengingCount / recent.length;

  if (ratio >= 0.7) {
    return [
      {
        type: "prefers_growth",
        confidence: ratio,
        description: `User accepts semantic challenges ${Math.round(ratio * 100)}% of the time`,
      },
    ];
  }
  if (ratio <= 0.3) {
    return [
      {
        type: "prefers_comfort",
        confidence: 1 - ratio,
        description: `User prefers comfortable path ${Math.round((1 - ratio) * 100)}% of the time`,
      },
    ];
  }

  return [
    {
      type: "balanced",
      confidence: 1 - Math.abs(ratio - 0.5) * 2,
      description: "User balances semantic comfort and growth",
    },
  ];
}

// ── Query Helpers ───────────────────────────────────────────────────────────

/** Get the appropriate challenge level for a specific domain. */
export function getDomainChallengeLevel(profile: SemanticGrowthProfile, domain: string): number {
  return profile.domainChallengeLevels[domain] ?? profile.challengeLevel;
}

/** Get the most frequent pattern type. */
export function getMostFrequentPattern(profile: SemanticGrowthProfile): PatternType | null {
  const entries = Object.entries(profile.patternFrequency) as [PatternType, number][];
  if (entries.length === 0) return null;
  entries.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  return entries[0]?.[0] ?? null;
}

/** Check if the user tends to accept challenges in a specific domain. */
export function isDomainChallenging(profile: SemanticGrowthProfile, domain: string): boolean {
  const level = profile.domainChallengeLevels[domain] ?? 0.5;
  return level >= 0.6;
}

// ── Validation ──────────────────────────────────────────────────────────────

function validateSemanticProfile(data: unknown): data is SemanticGrowthProfile {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.projectId === "string" &&
    typeof obj.growthCapacity === "number" &&
    typeof obj.challengeLevel === "number" &&
    Array.isArray(obj.semanticChoices) &&
    Array.isArray(obj.pathHistory) &&
    typeof obj.patternFrequency === "object" &&
    typeof obj.domainChallengeLevels === "object"
  );
}

function createDefaultSemanticProfile(): SemanticGrowthProfile {
  const now = new Date().toISOString();
  return {
    projectId: "default",
    createdAt: now,
    updatedAt: now,
    growthCapacity: 0.3,
    challengeLevel: 0.36,
    pathHistory: [],
    patterns: [
      {
        type: "balanced",
        confidence: 0.3,
        description: "Default pattern — no semantic choices recorded yet",
      },
    ],
    semanticChoices: [],
    patternFrequency: {} as Record<PatternType, number>,
    domainChallengeLevels: {},
  };
}
