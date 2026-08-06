/**
 * growth-profile.ts — Adaptive Dual-Path Growth Profile
 *
 * Tracks user's growth patterns, calculates challenge level,
 * and determines the appropriate level of challenge for recommendations.
 *
 * PRINCIPLE: The system adapts to the user's growth capacity,
 * keeping them in flow state — neither too comfortable nor too challenged.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ── Types ───────────────────────────────────────────────────────────────────

/** A single path choice made by the user. */
export interface PathChoice {
  id: string;
  timestamp: string;
  pathChosen: "comfortable" | "challenging";
  context: {
    command: string;
    recommendationType: string;
    maturityScore: number;
  };
}

/** Detected growth pattern from user's choices. */
export interface GrowthPattern {
  type: "prefers_comfort" | "prefers_growth" | "balanced" | "sporadic_growth";
  confidence: number;
  description: string;
}

/** Complete growth profile for a project. */
export interface GrowthProfile {
  projectId: string;
  createdAt: string;
  updatedAt: string;
  growthCapacity: number;
  challengeLevel: number;
  pathHistory: PathChoice[];
  patterns: GrowthPattern[];
}

// ── Constants ───────────────────────────────────────────────────────────────

const PROFILE_FILENAME = "growth-profile.json";
const HISTORY_LIMIT = 100;
const PATTERN_MIN_CHOICES = 3;
const CHALLENGE_ADAPTATION_WINDOW = 10;

// ── Storage ─────────────────────────────────────────────────────────────────

function getProfilePath(shitennoDir: string): string {
  return join(shitennoDir, PROFILE_FILENAME);
}

// ── Load / Save ─────────────────────────────────────────────────────────────

/** Load growth profile from disk. Returns default profile if not found. */
export function loadGrowthProfile(shitennoDir: string, projectId?: string): GrowthProfile {
  const profilePath = getProfilePath(shitennoDir);

  if (!existsSync(profilePath)) {
    return createDefaultProfile(projectId || "default");
  }

  try {
    const content = JSON.parse(readFileSync(profilePath, "utf-8"));
    return validateProfile(content) ? content : createDefaultProfile(projectId || "default");
  } catch {
    return createDefaultProfile(projectId || "default");
  }
}

/** Save growth profile to disk. */
export function saveGrowthProfile(shitennoDir: string, profile: GrowthProfile): void {
  const dir = join(shitennoDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const updatedProfile = { ...profile, updatedAt: new Date().toISOString() };
  writeFileSync(getProfilePath(shitennoDir), JSON.stringify(updatedProfile, null, 2), "utf-8");
}

// ── Record Choices ──────────────────────────────────────────────────────────

/** Record a path choice and update the profile. Returns updated profile. */
export function recordPathChoice(
  shitennoDir: string,
  choice: Omit<PathChoice, "id" | "timestamp">,
  projectId?: string
): GrowthProfile {
  const profile = loadGrowthProfile(shitennoDir, projectId);

  const fullChoice: PathChoice = {
    ...choice,
    id: `PC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };

  profile.pathHistory.push(fullChoice);

  // Limit history size
  if (profile.pathHistory.length > HISTORY_LIMIT) {
    profile.pathHistory = profile.pathHistory.slice(-HISTORY_LIMIT);
  }

  // Recalculate metrics
  profile.growthCapacity = calculateGrowthCapacity(profile);
  profile.challengeLevel = calculateChallengeLevel(profile);
  profile.patterns = detectGrowthPatterns(profile);

  saveGrowthProfile(shitennoDir, profile);
  return profile;
}

// ── Calculations ────────────────────────────────────────────────────────────

/** Calculate growth capacity based on path history (0-1). */
export function calculateGrowthCapacity(profile: GrowthProfile): number {
  const history = profile.pathHistory;
  if (history.length === 0) return 0.3; // Default: moderate capacity

  const recent = history.slice(-CHALLENGE_ADAPTATION_WINDOW);
  const challengingCount = recent.filter((c) => c.pathChosen === "challenging").length;
  const ratio = challengingCount / recent.length;

  // Smooth transition: ratio 0 → capacity 0.1, ratio 1 → capacity 0.9
  return 0.1 + ratio * 0.8;
}

/** Calculate challenge level based on growth capacity (0-1). */
export function calculateChallengeLevel(profile: GrowthProfile): number {
  const capacity = profile.growthCapacity;

  // Challenge level slightly above capacity to encourage growth
  // but not so high as to cause frustration
  const challenge = capacity * 0.7 + 0.15;

  // Clamp to 0-1
  return Math.max(0.0, Math.min(1.0, challenge));
}

// ── Pattern Detection ───────────────────────────────────────────────────────

/** Detect growth patterns from path history. */
export function detectGrowthPatterns(profile: GrowthProfile): GrowthPattern[] {
  const patterns: GrowthPattern[] = [];
  const history = profile.pathHistory;

  if (history.length < PATTERN_MIN_CHOICES) {
    patterns.push({
      type: "balanced",
      confidence: 0.3,
      description: "Insufficient data — defaulting to balanced pattern",
    });
    return patterns;
  }

  const recent = history.slice(-CHALLENGE_ADAPTATION_WINDOW);
  const challengingCount = recent.filter((c) => c.pathChosen === "challenging").length;
  const comfortableCount = recent.filter((c) => c.pathChosen === "comfortable").length;
  const total = recent.length;

  const challengingRatio = challengingCount / total;
  const comfortableRatio = comfortableCount / total;

  const dominant = detectDominantPattern(challengingRatio, comfortableRatio);
  if (dominant) {
    patterns.push(dominant);
  } else {
    const sporadic = detectSporadicGrowth(recent);
    if (sporadic) {
      patterns.push(sporadic);
    }
  }

  if (patterns.length === 0) {
    patterns.push({
      type: "balanced",
      confidence: 0.5,
      description: "Default balanced pattern",
    });
  }

  return patterns;
}

function detectDominantPattern(challengingRatio: number, comfortableRatio: number): GrowthPattern | null {
  if (challengingRatio >= 0.7) {
    return {
      type: "prefers_growth",
      confidence: challengingRatio,
      description: `User chooses growth path ${Math.round(challengingRatio * 100)}% of the time`,
    };
  }
  if (comfortableRatio >= 0.7) {
    return {
      type: "prefers_comfort",
      confidence: comfortableRatio,
      description: `User chooses comfortable path ${Math.round(comfortableRatio * 100)}% of the time`,
    };
  }
  if (challengingRatio >= 0.3 && challengingRatio <= 0.7) {
    return {
      type: "balanced",
      confidence: 1 - Math.abs(challengingRatio - 0.5) * 2,
      description: "User balances between comfort and growth",
    };
  }
  return null;
}

function detectSporadicGrowth(recent: PathChoice[]): GrowthPattern | null {
  let alternations = 0;
  for (let i = 1; i < recent.length; i++) {
    const current = recent[i];
    const previous = recent[i - 1];
    if (current && previous && current.pathChosen !== previous.pathChosen) {
      alternations++;
    }
  }
  const alternationRatio = alternations / (recent.length - 1);
  if (alternationRatio > 0.6) {
    return {
      type: "sporadic_growth",
      confidence: alternationRatio,
      description: "User alternates between comfort and growth sporadically",
    };
  }
  return null;
}

// ── Validation ──────────────────────────────────────────────────────────────

function validateProfile(data: unknown): data is GrowthProfile {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;

  return (
    typeof obj.projectId === "string" &&
    typeof obj.createdAt === "string" &&
    typeof obj.updatedAt === "string" &&
    typeof obj.growthCapacity === "number" &&
    typeof obj.challengeLevel === "number" &&
    Array.isArray(obj.pathHistory) &&
    Array.isArray(obj.patterns)
  );
}

function createDefaultProfile(projectId: string): GrowthProfile {
  const now = new Date().toISOString();
  return {
    projectId,
    createdAt: now,
    updatedAt: now,
    growthCapacity: 0.3,
    challengeLevel: 0.36,
    pathHistory: [],
    patterns: [
      {
        type: "balanced",
        confidence: 0.3,
        description: "Default pattern — no choices recorded yet",
      },
    ],
  };
}
