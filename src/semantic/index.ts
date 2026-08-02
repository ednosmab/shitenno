/**
 * index.ts — Semantic Layer Barrel Export
 *
 * Re-exports all public types and functions from the semantic layer.
 */

export type {
  SemanticDomain,
  SubdomainMap,
  SignalType,
  SemanticClassification,
  ClassificationRule,
  DomainInfo,
  SubdomainMap as Subdomains,
} from "./taxonomy.js";

export {
  SUBDOMAINS,
  DOMAIN_INFO,
} from "./taxonomy.js";

export {
  SORTED_RULES,
  getRulesForSignal,
  getRulesByDomain,
  getRuleCount,
} from "./rules.js";

export type {
  JournalEntry,
  JournalFilter,
  JournalStats,
} from "./change-journal.js";

export {
  ChangeJournal,
  getChangeJournal,
  resetChangeJournal,
} from "./change-journal.js";

export type {
  PatternType,
  DetectedPattern,
  PatternRule,
} from "./pattern-rules.js";

export {
  PATTERN_RULES,
  getPatternRule,
  getPatternTypes,
} from "./pattern-rules.js";

export type {
  PatternMatcher,
  PatternDetectionRun,
} from "./pattern-matcher.js";

export {
  getPatternMatcher,
  resetPatternMatcher,
  detectPatterns,
} from "./pattern-matcher.js";

export type {
  SemanticPathChoice,
  SemanticGrowthProfile,
} from "./growth-profile.js";

export {
  loadSemanticGrowthProfile,
  saveSemanticGrowthProfile,
  recordSemanticPathChoice,
  getDomainChallengeLevel,
  getMostFrequentPattern,
  isDomainChallenging,
} from "./growth-profile.js";

export type {
  SemanticPathOption,
  SemanticDualPath,
} from "./dual-path-presenter.js";

export {
  createSemanticDualPath,
  formatSemanticDualPath,
  formatSemanticDualPathJson,
} from "./dual-path-presenter.js";

export type {
  InsightType,
  SemanticInsight,
  Evidence,
  ReasonerContext,
} from "./reasoner.js";

export {
  getSemanticReasoner,
  resetSemanticReasoner,
  generateInsights,
} from "./reasoner.js";

export type {
  Correlation,
  CorrelationType,
  CorrelationSignal,
  CorrelatorContext,
} from "./correlator.js";

export {
  getSemanticCorrelator,
  resetSemanticCorrelator,
  detectCorrelations,
} from "./correlator.js";

export type {
  SignalClassifier,
  ClassifierStats,
} from "./signal-classifier.js";

export {
  getSignalClassifier,
  resetSignalClassifier,
  classifyEvent,
  classifyEvents,
} from "./signal-classifier.js";

// ── Semantic Analysis Helper ────────────────────────────────────────────────

import { getChangeJournal } from "./change-journal.js";
import { detectPatterns as detectSemanticPatterns } from "./pattern-matcher.js";
import { loadSemanticGrowthProfile } from "./growth-profile.js";
import { generateInsights } from "./reasoner.js";
import { detectCorrelations } from "./correlator.js";

/** Complete semantic analysis result — used by detect, briefing, evolve, and audit commands. */
export interface SemanticAnalysisResult {
  /** Semantic growth profile */
  profile: import("./growth-profile.js").SemanticGrowthProfile;
  /** Detected semantic patterns */
  patterns: import("./pattern-rules.js").DetectedPattern[];
  /** Higher-level insights from the reasoner */
  insights: import("./reasoner.js").SemanticInsight[];
  /** Cross-system correlations */
  correlations: import("./correlator.js").Correlation[];
}

/**
 * Run the full semantic analysis pipeline: load journal, detect patterns,
 * generate insights, and detect correlations.
 *
 * @param shitennoDir - Path to the .shitenno directory
 * @param projectRoot - Path to the project root
 * @returns SemanticAnalysisResult with all analysis outputs
 */
export function runSemanticAnalysis(
  shitennoDir: string,
  projectRoot: string,
): SemanticAnalysisResult {
  const profile = loadSemanticGrowthProfile(shitennoDir);
  const journal = getChangeJournal(shitennoDir);
  const patterns = detectSemanticPatterns(journal);
  const recentEntries = journal.getAll().slice(-30);
  const reasonerPatterns = recentEntries.length > 0 ? patterns : [];
  const insights = generateInsights(shitennoDir, projectRoot, reasonerPatterns, journal);
  const correlations = detectCorrelations(shitennoDir, projectRoot, journal);
  return { profile, patterns, insights, correlations };
}
