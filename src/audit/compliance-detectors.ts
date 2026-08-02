/**
 * Audit module — Compliance detectors (barrel re-export)
 */

export { detectOWASPTop10, detectCWEMapping, detectSOC2Controls, detectNISTAlignment } from "./compliance/frameworks.js";
export { detectLGPDCompliance, detectDataRetention, detectConsentTracking } from "./compliance/privacy.js";
export { detectSecretsInConfig, detectEncryptionAtRest, detectAccessControls, detectAuditLogging } from "./compliance/controls.js";
export { detectComplianceReport } from "./compliance/reporting.js";
