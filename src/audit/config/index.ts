/**
 * Config detectors — Barrel re-exports
 */

export { detectAdrCoverage } from "./adr.js";

export {
  detectReportNaming,
  detectUnreferencedDirs,
} from "./naming.js";

export {
  detectBareWordRefs,
  detectTemplateDirRefs,
  detectExtensionMismatch,
  detectSystemMapMismatch,
  detectBrokenCommands,
  detectP0Inconsistency,
} from "./consistency.js";

export {
  detectOrphanSkills,
  detectEmptyStack,
  detectTripleMaturityScore,
} from "./skills.js";
