/**
 * Audit module — Governance rule detectors (barrel re-export)
 */

export { detectScriptWiring } from "./rules/script-wiring.js";
export { detectAgentContractRefs, detectBufferSchemaMismatch } from "./rules/contracts.js";
export { detectRuleTypo, detectNumberingGap, detectPhantomRuleRefs } from "./rules/validation.js";
export { detectDocCountMismatch, detectCrossDocP0Contradiction, detectEmptyDataFiles } from "./rules/documents.js";
