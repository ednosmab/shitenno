/**
 * Security detectors — Barrel re-exports
 */

export { detectHardcodedSecrets, detectConsoleSecrets, detectDependencyConfusion } from "./secrets.js";
export { detectSQLInjection, detectXSS, detectUnsafeEval, detectUnsafeDeserialization } from "./injection.js";
export { detectWeakCrypto, detectWeakRandomness } from "./crypto.js";
export { detectPathTraversal } from "./path-traversal.js";
export { detectInsecureCORS, detectInsecureCookies } from "./cors.js";
export { detectRegexDos, detectPrototypePollution, detectInsecureHTTP } from "./misc.js";
