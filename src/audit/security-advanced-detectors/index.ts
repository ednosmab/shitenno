/**
 * Advanced Security detectors — barrel export.
 *
 * Re-exports all detectors from focused sub-modules:
 * - sbom-provenance: SBOM coverage and dependency provenance
 * - typosquatting: Levenshtein, character substitution, hyphen variants
 * - license-malware: License conflicts and known malicious patterns
 * - vulnerabilities: Transitive vulnerabilities and dependency staleness
 */

export { detectSBOMCoverage, detectDependencyProvenance } from "./sbom-provenance.js";
export { detectTyposquatting } from "./typosquatting.js";
export { detectLicenseConflicts, detectMalwarePatterns } from "./license-malware.js";
export { detectTransitiveVulns, detectDependencyStaleness } from "./vulnerabilities.js";
