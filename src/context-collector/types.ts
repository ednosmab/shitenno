/**
 * context-collector/types.ts — Type definitions for context collection
 */

import type { ProjectFingerprint } from "../project-fingerprint.js";
import type { RiskMap } from "../risk-map.js";
import type { ContextRule } from "../context-rules.js";
import type { DynamicRule } from "../dynamic-rules.js";
import type { Briefing, BriefingOptions } from "../briefing.js";
import type { MaturityProfile } from "../maturity-profile.js";
import type { ProjectAnalysis } from "../analyser.js";
import type { PatternDetectionReport } from "../pattern-detector.js";

export interface ContextDeps {
  loadFingerprint: (shitennoDir: string) => ProjectFingerprint | null;
  saveFingerprint: (shitennoDir: string, fp: ProjectFingerprint) => void;
  isFingerprintStale: (shitennoDir: string) => boolean;
  analyseProject: (projectRoot: string) => ProjectAnalysis;
  loadMaturityProfile: (shitennoDir: string) => MaturityProfile | null;
  generateProjectFingerprint: (root: string, analysis: ProjectAnalysis, score?: number) => ProjectFingerprint;
  generateRiskMap: (root: string, shitennoDir: string) => RiskMap;
  generateContextRules: (fp: ProjectFingerprint, risk: RiskMap) => ContextRule[];
  generateDynamicRules: (root: string, shitennoDir: string) => DynamicRule[];
  generateBriefing: (options: BriefingOptions) => Briefing;
  detectPatterns: (projectRoot: string, shitennoDir: string) => PatternDetectionReport;
  computeKeyChecksums?: (projectRoot: string, shitennoDir: string) => Record<string, string>;
  getCached?: <T>(input: { projectRoot: string; key: "complexity" | "patterns" | "health"; computeChecksumsFn: () => Record<string, string> }) => T | null;
  setCache?: <T>(input: { projectRoot: string; shitennoDir: string; key: string; data: T; checksums: Record<string, string> }) => void;
}

export interface ContextSnapshot {
  collectedAt: string;
  inputHash: string;
  fingerprint: ProjectFingerprint;
  riskMap: RiskMap;
  contextRules: ContextRule[];
  dynamicRules: DynamicRule[];
  maturityProfile: MaturityProfile | null;
  briefing: Briefing;
}
