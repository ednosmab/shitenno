/**
 * Docs detectors — Barrel re-exports
 */

export {
  detectMissingDocs,
  detectOrphanDirs,
  detectEmptyDirs,
  detectMissingGitignore,
  detectMissingPackageJson,
} from "./structure.js";

export {
  detectBrokenRefs,
  detectBrokenDirRefs,
  detectNonBacktickFileRefs,
} from "./refs.js";

export {
  detectStaleBuffer,
  detectDatePlaceholders,
  detectDeadRules,
  detectViolationHotspots,
} from "./config.js";

export { detectMaturityInconsistency } from "./maturity.js";
