/**
 * doc-sync-significance-types.ts — Change Significance Types
 *
 * Shared types for the change significance calculator.
 */

export type ArtifactType =
  | "skill"
  | "adr"
  | "workflow"
  | "rule"
  | "doc"
  | "config"
  | "script"
  | "telemetry"
  | "report"
  | "feedback"
  | "generated"
  | "unknown";

export type SignificanceLevel = "ignore" | "low" | "medium" | "high";

export interface SignificanceResult {
  score: number;
  level: SignificanceLevel;
  reasons: string[];
  shouldSync: boolean;
  outputLevel: "silent" | "minimal" | "verbose";
}

export interface ChangeFrequency {
  count: number;
  windowStart: number;
  lastChange: number;
}

export interface SignificanceInput {
  filePath: string;
  shitennoDir: string;
  oldContent: string | null;
  newContent: string;
  frequency: ChangeFrequency;
}
