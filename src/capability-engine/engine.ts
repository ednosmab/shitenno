import { CAPABILITIES } from "../maturity-profile.js";
import type { EngineeringState } from "../engineering-state.js";
import type { CapabilityEngineResult, CapabilityMaturity, CapabilityEntity, CapabilityRecommendation } from "./types.js";
import { buildCapabilityEntity } from "./maturity.js";
import { generateCapabilityRecommendations } from "./recommendations.js";

function buildMaturityMap(capabilities: CapabilityEntity[]): Record<CapabilityMaturity, CapabilityEntity[]> {
  const map: Record<CapabilityMaturity, CapabilityEntity[]> = { dormant: [], installed: [], configured: [], active: [], optimized: [] };
  for (const cap of capabilities) map[cap.maturity].push(cap);
  return map;
}

function buildCapabilitiesSummary(capabilities: CapabilityEntity[], byMaturity: Record<CapabilityMaturity, CapabilityEntity[]>, overallScore: number, recommendations: CapabilityRecommendation[]): string {
  const parts: string[] = [`${capabilities.length} capabilities evaluated.`];
  const activeCount = byMaturity.active.length + byMaturity.optimized.length;
  parts.push(`${activeCount} active/optimized.`);
  const dormantCount = byMaturity.dormant.length;
  if (dormantCount > 0) parts.push(`${dormantCount} dormant.`);
  parts.push(`Score: ${overallScore}/100.`);
  if (recommendations.length > 0) parts.push(`${recommendations.length} recommendation(s).`);
  return parts.join(" ");
}

export function evaluateCapabilities(state: EngineeringState, shitennoDir: string): CapabilityEngineResult {
  const capabilities = CAPABILITIES.map((capInfo) => buildCapabilityEntity({ capInfo, shitennoDir, installedCapabilities: state.capabilities, assets: state.assets, maturityScore: state.maturity?.overallScore ?? 0 }));
  const byMaturity = buildMaturityMap(capabilities);
  const totalScore = capabilities.reduce((sum, c) => sum + c.maturityScore, 0);
  const overallScore = capabilities.length > 0 ? Math.round(totalScore / capabilities.length) : 0;
  const dimensions = state.maturity?.dimensions ?? { architecture: 0, governance: 0, quality: 0, automation: 0, ai: 0, documentation: 0, observability: 0 };
  const recommendations = generateCapabilityRecommendations(capabilities, dimensions);

  return {
    evaluatedAt: new Date().toISOString(),
    capabilities,
    byMaturity,
    overallScore,
    recommendations,
    summary: buildCapabilitiesSummary(capabilities, byMaturity, overallScore, recommendations),
  };
}
