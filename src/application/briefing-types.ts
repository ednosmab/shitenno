/**
 * briefing-types.ts — Pre-Session Briefing Types
 *
 * Shared types for the briefing generator: reminder metadata,
 * the briefing document shape, and generation options.
 */

import type { ProjectFingerprint } from "../infrastructure/project-fingerprint.js";
import type { RiskMap } from "../infrastructure/risk-map.js";
import type { ContextRule } from "../domain/rules/context-rules.js";
import type { DynamicRule } from "../infrastructure/dynamic-rules.js";
import type { MaturityProfile } from "./maturity-profile.js";
import type { SemanticInsight, Correlation } from "../semantic/index.js";
import type { DetectedPattern } from "../semantic/pattern-rules.js";

/** Reminder priority levels. */
export type ReminderPriority = "high" | "medium" | "low";

/** Reminder categories for filtering and display. */
export type ReminderCategory = "bug" | "feature" | "debt" | "security" | "docs" | "infra";

/** A single reminder with metadata. */
export interface Reminder {
  /** The reminder message */
  message: string;
  /** Priority level (high/medium/low) */
  priority: ReminderPriority;
  /** Category for filtering */
  category: ReminderCategory;
  /** When the reminder was created */
  createdAt: string;
}

export interface Briefing {
  /** When the briefing was generated */
  generatedAt: string;
  /** Project identity */
  project: {
    domain: string;
    scale: string;
    stack: string[];
    maturityScore: number;
  };
  /** Risk summary */
  risks: {
    overall: string;
    criticalAreas: string[];
    highAreas: string[];
  };
  /** Test coverage status */
  tests: {
    hasTests: boolean;
    areasWithoutTests: string[];
  };
  /** Recent patterns */
  patterns: {
    recurringErrors: string[];
    hotAreas: string[];
    /** Detected patterns from pattern-detector (recurring errors, reverted decisions, hot areas). */
    detected: Array<{
      type: string;
      description: string;
      occurrences: number;
      affectedArea: string;
      severity: number;
    }>;
  };
  /** Context rules (top 5) */
  contextRules: ContextRule[];
  /** Dynamic rules (top 3) */
  dynamicRules: DynamicRule[];
  /** Recommended next steps */
  recommendations: string[];
  /** Token economy metrics */
  tokenEconomy: {
    /** Estimated tokens saved vs manual discovery */
    estimatedTokensSaved: number;
    /** Whether this briefing was served from cache */
    cacheHit: boolean;
    /** Number of context rules contributing to savings */
    contextRuleCount: number;
    /** Number of dynamic rules contributing to savings */
    dynamicRuleCount: number;
  };
  /** Quick Board — session state summary for agent reminder */
  quickBoard?: {
    /** Current task in progress (from context_buffer.yaml) */
    currentTask: string;
    /** Next P0 priority item */
    nextP0: string;
    /** P1 debts with due dates */
    p1Debts: string;
    /** Impediments */
    impediments: string;
    /** Last session status */
    lastSessionStatus: string;
  };
  /** Active reminders from context_buffer.yaml */
  reminders: Reminder[];
  /** Recent activity from event bus (last 24h) */
  recentActivity?: {
    events: Array<{
      type: string;
      summary: string;
      timestamp: string;
    }>;
    syncCount: number;
    errorCount: number;
  };
  /** Governance knowledge — lightweight summaries of ADRs and skills */
  governanceKnowledge?: {
    adrs: Array<{ id: string; title: string; status: string }>;
    skills: Array<{ name: string; description: string }>;
  };
  /** Proactive alerts from daemon challenges (A.2) */
  proactiveAlerts?: {
    pendingChallenges: string[];
    unresolvedHealthDips: string[];
    pendingDebts: string[];
  };
  /** Daemon heartbeat status (E.3) */
  daemonHeartbeat?: {
    running: boolean;
    uptime: string;
    lastAudit: string;
    auditCount: number;
    notificationsSent: number;
  };
  /** Semantic layer analysis */
  semantic?: {
    /** Detected semantic patterns (architectural shifts, scope drift, etc.) */
    patterns: DetectedPattern[];
    /** Higher-level insights from the reasoner */
    insights: SemanticInsight[];
    /** Cross-system correlations */
    correlations: Correlation[];
    /** Semantic growth profile snapshot */
    growthProfile: {
      growthCapacity: number;
      challengeLevel: number;
      domainChallengeLevels: Record<string, number>;
      totalChoices: number;
    };
  };
}

export interface BriefingOptions {
  fingerprint: ProjectFingerprint;
  riskMap: RiskMap;
  contextRules: ContextRule[];
  dynamicRules: DynamicRule[];
  maturityProfile?: MaturityProfile;
  projectRoot?: string;
  quickBoard?: {
    currentTask: string;
    nextP0: string;
    p1Debts: string;
    impediments: string;
    lastSessionStatus: string;
  };
  reminders?: Reminder[];
}
