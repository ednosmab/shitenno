/**
 * Audit module — Supply chain and new detectors (barrel re-export)
 */

export { detectUnpinnedVersions, detectMissingLockFile, detectLockFileDrift } from "./supply/versions.js";
export { detectPhantomDependencies, detectDeprecatedPackages } from "./supply/dependencies.js";
export { detectDependencyVulnerabilities, detectIncompatibleLicenses, detectConfigSecrets } from "./supply/audit.js";
