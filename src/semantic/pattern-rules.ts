import type { SemanticDomain } from "./taxonomy.js";
import type { JournalEntry, ChangeJournal } from "./change-journal.js";

export type PatternType =
  | "architectural_shift"
  | "scope_drift"
  | "security_degradation"
  | "tech_debt_accumulation"
  | "capability_gap"
  | "maturity_regression";

export interface DetectedPattern {
  id: string;
  type: PatternType;
  domain: SemanticDomain;
  domains: SemanticDomain[];
  confidence: number;
  description: string;
  signals: string[];
  suggestedActions: string[];
  detectedAt: string;
  windowSessions: number;
  evidence: JournalEntry[];
}

export interface PatternRule {
  type: PatternType;
  name: string;
  description: string;
  condition: (journal: ChangeJournal, windowSessions: number) => DetectedPattern | null;
}

import { PATTERN_RULES_DATA } from "./pattern-rules-data.js";

export const PATTERN_RULES: PatternRule[] = PATTERN_RULES_DATA;

export function getPatternRule(type: PatternType): PatternRule | undefined {
  return PATTERN_RULES.find((r) => r.type === type);
}

export function getPatternTypes(): PatternType[] {
  return PATTERN_RULES.map((r) => r.type);
}
