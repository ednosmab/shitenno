/**
 * area-scorer.ts — Barrel re-exporting from sub-modules.
 */

export type { AreaMetrics } from "./area-scanner.js";
export { batchScoreArea } from "./area-scanner.js";

export type { PreReadHistory } from "./git-churn.js";
export { batchGitChurn, preReadHistory, countContextPressure } from "./git-churn.js";

export { collectStaticMetrics, collectBehavioralMetrics } from "./behavioral-metrics.js";
