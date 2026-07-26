/**
 * Audit module — Governance config detectors (barrel re-export)
 *
 * Re-exports all config detectors from sub-modules.
 * This file maintains backward compatibility.
 */

export { detectAdrCoverage } from "./config/adr.js";

export {
  detectReportNaming,
  detectUnreferencedDirs,
} from "./config/naming.js";

export {
  detectBareWordRefs,
  detectTemplateDirRefs,
  detectExtensionMismatch,
  detectSystemMapMismatch,
  detectBrokenCommands,
  detectP0Inconsistency,
} from "./config/consistency.js";

export {
  detectOrphanSkills,
  detectEmptyStack,
  detectTripleMaturityScore,
} from "./config/skills.js";
