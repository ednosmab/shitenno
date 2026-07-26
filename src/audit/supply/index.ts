export { detectUnpinnedVersions, detectMissingLockFile, detectLockFileDrift } from "./versions.js";
export { detectPhantomDependencies, detectDeprecatedPackages } from "./dependencies.js";
export { detectDependencyVulnerabilities, detectIncompatibleLicenses, detectConfigSecrets } from "./audit.js";
