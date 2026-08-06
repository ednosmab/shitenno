/**
 * capability-engine.ts — Capability Engine: First-Class Entity System
 *
 * Thin facade — all logic split into capability-engine/ modules.
 */

export type {
  CapabilityMaturity,
  CapabilityEntity,
  CapabilityMetrics,
  CapabilityEngineResult,
  CapabilityRecommendation,
} from "../capability-engine/types.js";

export { detectCapabilityMaturity, getCapabilityFilesForEngine, buildCapabilityEntity } from "../capability-engine/maturity.js";
export { generateCapabilityRecommendations } from "../capability-engine/recommendations.js";
export { evaluateCapabilities } from "../capability-engine/engine.js";
export { saveCapabilityEngineResult, loadCapabilityEngineResult } from "../capability-engine/persistence.js";
export { capabilityEngineToText } from "../capability-engine/report.js";

import { evaluateCapabilities } from "../capability-engine/engine.js";
import { saveCapabilityEngineResult } from "../capability-engine/persistence.js";
import { getEventBus } from "../infrastructure/event-bus.js";

export function initializeCapabilityEngine(
  projectRoot: string,
  shitennoDir: string
): void {
  const bus = getEventBus();

  bus.subscribe("capability.installed", () => {
    import("./engineering-state.js").then((mod) => {
      const state = mod.consolidateEngineeringState(projectRoot, shitennoDir);
      const result = evaluateCapabilities(state, shitennoDir);
      saveCapabilityEngineResult(shitennoDir, result);
    }).catch(() => {
      // skip
    });
  });
}
