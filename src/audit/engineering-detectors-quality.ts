/**
 * Audit module — Engineering detectors (barrel re-export)
 */

export { detectTestHealth, detectTestCoverageGaps } from "./engineering/testing.js";
export { detectOrphanModules, detectComplexityHotspots, detectCircularDeps, detectUnusedExports } from "./engineering/code-health.js";
export { detectTypeSafetyIssues } from "./engineering/type-safety.js";
export { detectConsoleUsage, detectEmptyCatchBlocks, detectHighComplexity, detectLintIssues, detectDeadCodePatterns } from "./engineering/hygiene.js";
