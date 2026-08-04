/**
 * Audit module — Governance docs detectors (barrel re-export)
 *
 * Re-exports all docs detectors from sub-modules.
 * This file maintains backward compatibility.
 */

export {
  detectMissingDocs,
  detectOrphanDirs,
  detectEmptyDirs,
  detectMissingGitignore,
  detectMissingPackageJson,
} from "./docs/structure.js";

export {
  detectBrokenRefs,
  detectBrokenDirRefs,
  detectNonBacktickFileRefs,
  detectBrokenManifestRefs,
} from "./docs/refs.js";

export {
  detectStaleBuffer,
  detectDatePlaceholders,
  detectDeadRules,
  detectViolationHotspots,
} from "./docs/config.js";

export { detectMaturityInconsistency } from "./docs/maturity.js";
