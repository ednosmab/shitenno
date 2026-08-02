export { detectTestHealth, detectTestCoverageGaps } from "./testing.js";
export { detectOrphanModules, detectComplexityHotspots, detectCircularDeps, detectUnusedExports } from "./code-health.js";
export { detectTypeSafetyIssues } from "./type-safety.js";
export { detectConsoleUsage, detectEmptyCatchBlocks, detectHighComplexity, detectLintIssues, detectDeadCodePatterns } from "./hygiene.js";
