/**
 * tech-debt-detectors.ts — Barrel file for Tech Debt Detectors
 *
 * Re-exports from tech-debt/cost.ts and tech-debt/trends.ts.
 */

export {
  detectTechDebtCost,
  detectTDR,
  detectRemediationEffort,
  detectROIRefactoring,
} from "./tech-debt/cost.js";

export {
  detectDebtTrend,
  detectHotspotFiles,
  detectDebtByDomain,
  detectDebtAccumulationRate,
} from "./tech-debt/trends.js";
