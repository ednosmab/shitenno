/**
 * Audit module — Code Quality Intelligence detectors (barrel re-export)
 */

export { detectJSDocCoverage } from "./quality/jsdoc.js";
export { detectUnsafeTypeAssertions, detectUnreachableCode, detectUnusedImports, detectCoverageThreshold } from "./quality/correctness.js";
export { detectMagicNumbers, detectLongParams, detectDeepNesting, detectGodFunctions } from "./quality/complexity.js";
export { detectDuplicateCode } from "./quality/duplication.js";
