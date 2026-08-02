/**
 * pattern-matcher.ts — Semantic Pattern Detection Engine
 *
 * Analyzes the Change Journal to detect temporal patterns such as
 * architectural shifts, scope drift, security degradation, etc.
 * Uses rules defined in pattern-rules.ts.
 *
 * PRINCIPLE: Pattern detection is deterministic — same journal state
 * always produces the same detected patterns.
 */

import { logger } from "../logger.js";
import { getEventBus } from "../event-bus.js";
import type { ChangeJournal } from "./change-journal.js";
import { PATTERN_RULES, type DetectedPattern, type PatternType } from "./pattern-rules.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface PatternMatcher {
  /** Detect all patterns in the journal. */
  detect(): DetectedPattern[];
  /** Detect patterns for a specific type. */
  detectType(type: PatternType): DetectedPattern | null;
  /** Get pattern detection history. */
  getHistory(): PatternDetectionRun[];
}

export interface PatternDetectionRun {
  id: string;
  timestamp: string;
  patternsFound: number;
  patterns: DetectedPattern[];
  journalSize: number;
  windowSessions: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_WINDOW_SESSIONS = 5;

// ── Implementation ──────────────────────────────────────────────────────────

class DefaultPatternMatcher implements PatternMatcher {
  private journal: ChangeJournal;
  private windowSessions: number;
  private history: PatternDetectionRun[] = [];

  constructor(journal: ChangeJournal, windowSessions: number = DEFAULT_WINDOW_SESSIONS) {
    this.journal = journal;
    this.windowSessions = windowSessions;
  }

  detect(): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const runId = crypto.randomUUID();

    for (const rule of PATTERN_RULES) {
      try {
        const pattern = rule.condition(this.journal, this.windowSessions);
        if (pattern) {
          patterns.push(pattern);
        }
      } catch (err) {
        logger.warn("pattern-matcher", `Error in rule "${rule.type}": ${err}`);
      }
    }

    // Record this detection run
    const run: PatternDetectionRun = {
      id: runId,
      timestamp: new Date().toISOString(),
      patternsFound: patterns.length,
      patterns,
      journalSize: this.journal.getAll().length,
      windowSessions: this.windowSessions,
    };
    this.history.push(run);

    // Publish events for each detected pattern
    if (patterns.length > 0) {
      const bus = getEventBus();
      for (const pattern of patterns) {
        bus.publish("semantic.pattern_detected", {
          patternId: pattern.id,
          patternType: pattern.type,
          domain: pattern.domain,
          confidence: pattern.confidence,
          description: pattern.description,
        });
      }

      logger.info(
        "pattern-matcher",
        `Detected ${patterns.length} pattern(s): ${patterns.map((p) => p.type).join(", ")}`
      );
    }

    return patterns;
  }

  detectType(type: PatternType): DetectedPattern | null {
    const rule = PATTERN_RULES.find((r) => r.type === type);
    if (!rule) return null;

    try {
      return rule.condition(this.journal, this.windowSessions);
    } catch (err) {
      logger.warn("pattern-matcher", `Error in rule "${type}": ${err}`);
      return null;
    }
  }

  getHistory(): PatternDetectionRun[] {
    return [...this.history];
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

let defaultMatcher: DefaultPatternMatcher | null = null;

export function getPatternMatcher(journal: ChangeJournal, windowSessions?: number): DefaultPatternMatcher {
  if (!defaultMatcher) {
    defaultMatcher = new DefaultPatternMatcher(journal, windowSessions);
  }
  return defaultMatcher;
}

export function resetPatternMatcher(): void {
  defaultMatcher = null;
}

/** Convenience: detect all patterns in a journal. */
export function detectPatterns(journal: ChangeJournal, windowSessions?: number): DetectedPattern[] {
  return getPatternMatcher(journal, windowSessions).detect();
}
