import type { Capability, MaturityDimensions } from "../maturity-profile.js";

/** Capability maturity level. */
export type CapabilityMaturity =
  | "dormant"
  | "installed"
  | "configured"
  | "active"
  | "optimized";

/** A capability entity with full metadata. */
export interface CapabilityEntity {
  id: Capability;
  name: string;
  description: string;
  maturity: CapabilityMaturity;
  maturityScore: number;
  dimensions: Partial<Record<keyof MaturityDimensions, number>>;
  dependencies: Capability[];
  activePolicies: string[];
  activeSkills: string[];
  templates: string[];
  recommendations: string[];
  metrics: CapabilityMetrics;
  alwaysInstalled: boolean;
  isInstalled: boolean;
  files: string[];
}

/** Metrics tracked per capability. */
export interface CapabilityMetrics {
  assetCount: number;
  ruleCount: number;
  policyCount: number;
  healthScore: number;
  lastUpdated: string;
  referenceCount: number;
}

/** Result of capability engine evaluation. */
export interface CapabilityEngineResult {
  evaluatedAt: string;
  capabilities: CapabilityEntity[];
  byMaturity: Record<CapabilityMaturity, CapabilityEntity[]>;
  overallScore: number;
  recommendations: CapabilityRecommendation[];
  summary: string;
}

/** A recommendation for capability evolution. */
export interface CapabilityRecommendation {
  capability: Capability;
  action: "activate" | "upgrade" | "configure" | "optimize" | "deprecate";
  priority: "urgent" | "high" | "medium" | "low";
  reason: string;
  expectedImpact: string;
  dependencies: Capability[];
}
