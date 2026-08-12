/**
 * challenge-generator.ts — Challenge Alternative Generator
 *
 * Takes a "comfortable" recommendation and generates a "challenging" alternative
 * that pushes the user beyond their current thinking.
 *
 * PRINCIPLE: The challenge is always an invitation, never a command.
 * The user's intention drives growth, not the system's recommendations.
 */

import type { EvolutionRecommendation, RecommendationType } from "./auto-evolution.js";
import type { GrowthProfile } from "../infrastructure/growth-profile.js";
import type { ShitennoState } from "./state-manager.js";

// ── Types ───────────────────────────────────────────────────────────────────

/** Knowledge gap that makes a recommendation challenging. */
export interface KnowledgeGap {
  requiredKnowledge: string[];
  currentKnowledge: string[];
  gapDescription: string;
  severity: "low" | "medium" | "high";
}

/** Paradigm shift required for a challenging recommendation. */
export interface ParadigmShift {
  currentParadigm: string;
  newParadigm: string;
  shiftDescription: string;
  difficulty: "minor" | "moderate" | "major";
}

/** A dual path with comfortable and challenging alternatives. */
export interface DualPath {
  comfortable: EvolutionRecommendation;
  challenging: EvolutionRecommendation;
  challengeLevel: number;
}

// ── Challenge Templates ─────────────────────────────────────────────────────

const CHALLENGE_TEMPLATES: Record<RecommendationType, {
  challengingTitlePrefix: string;
  challengingDescriptionTemplate: string;
  paradigmShift: ParadigmShift;
}> = {
  capability_install: {
    challengingTitlePrefix: "Master",
    challengingDescriptionTemplate:
      "Instead of just installing {capability}, extract the patterns from your existing code that led to this need. Document WHY your architecture requires this capability.",
    paradigmShift: {
      currentParadigm: "Installing capabilities to solve problems",
      newParadigm: "Understanding why problems occur to prevent them",
      shiftDescription: "Move from reactive installation to proactive understanding",
      difficulty: "moderate",
    },
  },
  capability_upgrade: {
    challengingTitlePrefix: "Deep-dive",
    challengingDescriptionTemplate:
      "Before upgrading {capability}, analyse how the current version shapes your thinking. What would change if you redesigned from scratch with the new capabilities?",
    paradigmShift: {
      currentParadigm: "Upgrading to get new features",
      newParadigm: "Upgrading to expand thinking possibilities",
      shiftDescription: "Move from feature acquisition to cognitive expansion",
      difficulty: "moderate",
    },
  },
  knowledge_creation: {
    challengingTitlePrefix: "Extract and formalize",
    challengingDescriptionTemplate:
      "Don't just create the document. Extract the tacit knowledge from your team's practices and formalize it into reusable patterns that others can apply.",
    paradigmShift: {
      currentParadigm: "Documenting what was decided",
      newParadigm: "Extracting patterns from what was decided",
      shiftDescription: "Move from documentation to knowledge engineering",
      difficulty: "major",
    },
  },
  governance_enhancement: {
    challengingTitlePrefix: "Design the governance",
    challengingDescriptionTemplate:
      "Don't just create the governance document. Design the governance system that will evolve with your project. Include feedback mechanisms and adaptation rules.",
    paradigmShift: {
      currentParadigm: "Creating rules to follow",
      newParadigm: "Designing systems that learn and adapt",
      shiftDescription: "Move from static rules to adaptive governance",
      difficulty: "major",
    },
  },
  automation_addition: {
    challengingTitlePrefix: "Design the automation",
    challengingDescriptionTemplate:
      "Instead of automating a single task, design an automation framework that can be extended. What patterns can you extract from this task that apply to others?",
    paradigmShift: {
      currentParadigm: "Automating repetitive tasks",
      newParadigm: "Designing automation systems",
      shiftDescription: "Move from task automation to system design",
      difficulty: "moderate",
    },
  },
  debt_remediation: {
    challengingTitlePrefix: "Prevent the debt",
    challengingDescriptionTemplate:
      "Don't just fix the current debt. Design the system that would prevent this type of debt from occurring in the future. What feedback mechanisms would catch it early?",
    paradigmShift: {
      currentParadigm: "Fixing problems when they appear",
      newParadigm: "Designing systems that prevent problems",
      shiftDescription: "Move from remediation to prevention",
      difficulty: "major",
    },
  },
  pattern_extraction: {
    challengingTitlePrefix: "Generalize the patterns",
    challengingDescriptionTemplate:
      "Don't just extract patterns from your code. Generalize them into principles that apply beyond your project. How would these patterns help other teams?",
    paradigmShift: {
      currentParadigm: "Extracting project-specific patterns",
      newParadigm: "Extracting universal principles",
      shiftDescription: "Move from project knowledge to universal knowledge",
      difficulty: "major",
    },
  },
  architecture_improvement: {
    challengingTitlePrefix: "Reimagine the architecture",
    challengingDescriptionTemplate:
      "Don't just improve the current architecture. Reimagine what the architecture could be if you had no constraints. Then find the bridge between current and ideal.",
    paradigmShift: {
      currentParadigm: "Improving incrementally",
      newParadigm: "Reimagining from first principles",
      shiftDescription: "Move from incremental improvement to radical redesign",
      difficulty: "major",
    },
  },
};

// ── Main Functions ──────────────────────────────────────────────────────────

/** Generate a challenging alternative for a comfortable recommendation. */
export function generateChallengingAlternative(
  comfortable: EvolutionRecommendation,
  profile: GrowthProfile,
  state?: ShitennoState
): EvolutionRecommendation {
  const template = CHALLENGE_TEMPLATES[comfortable.type];

  // Calculate challenge level based on profile
  const challengeLevel = profile.challengeLevel;

  // Generate knowledge gap analysis
  const knowledgeGap = state ? calculateKnowledgeGap(comfortable, state) : null;

  // Build challenging recommendation
  const challenging: EvolutionRecommendation = {
    ...comfortable,
    id: comfortable.id.replace(/^EVO/, "CHL"),
    title: `${template.challengingTitlePrefix}: ${comfortable.title}`,
    description: template.challengingDescriptionTemplate
      .replace("{capability}", comfortable.title)
      .replace("{knowledge}", knowledgeGap?.gapDescription || "new knowledge"),
    expectedImpact: `${comfortable.expectedImpact} + expands thinking beyond current paradigms`,
    action: comfortable.action.replace(
      /Run '(.+)'/,
      "Run '$1' after reflecting on the paradigm shift"
    ),
    confidence: Math.max(0.3, comfortable.confidence - 0.1),
    evidence: [
      ...comfortable.evidence,
      `Paradigm shift: ${template.paradigmShift.shiftDescription}`,
      ...(knowledgeGap ? [`Knowledge gap: ${knowledgeGap.gapDescription}`] : []),
    ],
  };

  // Adjust confidence based on growth capacity
  challenging.confidence = adjustConfidenceForChallenge(
    challenging.confidence,
    challengeLevel,
    profile.growthCapacity
  );

  return challenging;
}

/** Calculate knowledge gap for a recommendation. */
export function calculateKnowledgeGap(
  recommendation: EvolutionRecommendation,
  state: ShitennoState
): KnowledgeGap {
  const requiredKnowledge: string[] = [];
  const currentKnowledge: string[] = [];

  // Analyze what knowledge is required
  switch (recommendation.type) {
    case "capability_install":
      requiredKnowledge.push(`${recommendation.title} patterns`);
      if (state.project.installedCapabilities.length > 0) {
        currentKnowledge.push(...state.project.installedCapabilities.map((c) => `${c} patterns`));
      }
      break;
    case "knowledge_creation":
      requiredKnowledge.push("Documentation patterns", "Knowledge extraction techniques");
      if (state.knowledge.adrs.length > 0) {
        currentKnowledge.push("ADR creation");
      }
      break;
    case "governance_enhancement":
      requiredKnowledge.push("Governance design", "Adaptive systems");
      if (state.knowledge.governanceDocs.length > 0) {
        currentKnowledge.push("Governance documentation");
      }
      break;
    case "pattern_extraction":
      requiredKnowledge.push("Pattern recognition", "Abstraction techniques");
      if (state.knowledge.skills.length > 0) {
        currentKnowledge.push("Pattern extraction");
      }
      break;
    default:
      requiredKnowledge.push("General project knowledge");
  }

  const gapItems = requiredKnowledge.filter((k) => !currentKnowledge.includes(k));
  const severity = gapItems.length >= 3 ? "high" : gapItems.length >= 2 ? "medium" : "low";

  return {
    requiredKnowledge,
    currentKnowledge,
    gapDescription: gapItems.length > 0
      ? `Requires: ${gapItems.join(", ")}`
      : "Knowledge requirements met",
    severity,
  };
}

/** Ensure the challenge is in flow state (not too easy, not too hard). */
export function ensureFlowState(
  challengeLevel: number,
  capacity: number
): number {
  // Flow state: challenge slightly above capacity
  // Csikszentmihalyi's flow channel
  const targetChallenge = capacity * 1.2;
  // Blend current challenge with target
  const flowChallenge = (challengeLevel + targetChallenge) / 2;

  // Clamp to 0-1
  return Math.max(0.0, Math.min(1.0, flowChallenge));
}

// ── Helper Functions ────────────────────────────────────────────────────────

function adjustConfidenceForChallenge(
  baseConfidence: number,
  challengeLevel: number,
  growthCapacity: number
): number {
  // Higher growth capacity = higher confidence in challenging recommendations
  const capacityBonus = growthCapacity * 0.2;

  // Higher challenge level = slightly lower confidence (more risky)
  const challengePenalty = challengeLevel * 0.1;

  return Math.max(0.1, Math.min(0.9, baseConfidence + capacityBonus - challengePenalty));
}
