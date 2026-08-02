/**
 * Audit module — Governance detectors (barrel re-export)
 *
 * Re-exports all governance detectors from sub-modules.
 * This file maintains backward compatibility.
 */

export {
  detectDeadRules,
  detectViolationHotspots,
  detectMissingDocs,
  detectOrphanDirs,
  detectStaleBuffer,
  detectDatePlaceholders,
  detectEmptyDirs,
  detectBrokenRefs,
  detectBrokenDirRefs,
  detectNonBacktickFileRefs,
  detectMissingGitignore,
  detectMissingPackageJson,
  detectMaturityInconsistency,
} from "./governance-detectors-docs.js";

export {
  detectAdrCoverage,
  detectUnreferencedDirs,
  detectReportNaming,
  detectBareWordRefs,
  detectTemplateDirRefs,
  detectExtensionMismatch,
  detectSystemMapMismatch,
  detectBrokenCommands,
  detectP0Inconsistency,
  detectTripleMaturityScore,
  detectEmptyStack,
  detectOrphanSkills,
} from "./governance-detectors-config.js";

export {
  detectScriptWiring,
  detectAgentContractRefs,
  detectBufferSchemaMismatch,
  detectRuleTypo,
  detectNumberingGap,
  detectPhantomRuleRefs,
  detectDocCountMismatch,
  detectCrossDocP0Contradiction,
  detectEmptyDataFiles,
} from "./governance-detectors-rules.js";

export {
  detectOrphanSkillFiles,
  detectBrokenSkillManifestEntries,
} from "./skill-manifest-detectors.js";
