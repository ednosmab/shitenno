import type { MaturityDimensions } from "../maturity-profile.js";
import type { CapabilityEntity, CapabilityRecommendation } from "./types.js";

function computeRelevance(cap: CapabilityEntity, dimensions: MaturityDimensions): number {
  let relevance = 0, weightCount = 0;
  for (const [dim, weight] of Object.entries(cap.dimensions)) {
    relevance += dimensions[dim as keyof MaturityDimensions] * weight;
    weightCount += weight;
  }
  return weightCount > 0 ? relevance / weightCount : 0;
}

function checkDependenciesMet(cap: CapabilityEntity, allCaps: CapabilityEntity[]): boolean {
  return cap.dependencies.every((dep) => allCaps.find((c) => c.id === dep)?.isInstalled);
}

function evaluateCapability(cap: CapabilityEntity, allCaps: CapabilityEntity[], dimensions: MaturityDimensions): CapabilityRecommendation | null {
  if (cap.maturity === "dormant") {
    const relevance = computeRelevance(cap, dimensions);
    if (relevance >= 25 && checkDependenciesMet(cap, allCaps)) {
      return { capability: cap.id, action: "activate", priority: "high", reason: `Maturity dimensions warrant ${cap.name} capability`, expectedImpact: `Adds ${cap.name.toLowerCase()} governance to the project`, dependencies: cap.dependencies };
    }
  } else if (cap.maturity === "installed" || cap.maturity === "configured") {
    if (cap.maturityScore < 60) return { capability: cap.id, action: "configure", priority: "medium", reason: `${cap.name} is ${cap.maturity} but not fully configured`, expectedImpact: "Improves capability effectiveness", dependencies: [] };
  } else if (cap.maturity === "active") {
    if (cap.maturityScore < 80) return { capability: cap.id, action: "optimize", priority: "low", reason: `${cap.name} can be further optimized`, expectedImpact: "Maximizes capability value", dependencies: [] };
  }
  return null;
}

export function generateCapabilityRecommendations(capabilities: CapabilityEntity[], dimensions: MaturityDimensions): CapabilityRecommendation[] {
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  return capabilities
    .map((cap) => evaluateCapability(cap, capabilities, dimensions))
    .filter((r): r is CapabilityRecommendation => r !== null)
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}
