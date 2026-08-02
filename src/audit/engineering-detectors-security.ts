/**
 * Audit module — Security pattern detectors (barrel re-export)
 *
 * Re-exports all security detectors from sub-modules.
 * This file maintains backward compatibility.
 */

export {
  detectHardcodedSecrets,
  detectConsoleSecrets,
  detectDependencyConfusion,
} from "./security/secrets.js";

export {
  detectSQLInjection,
  detectXSS,
  detectUnsafeEval,
  detectUnsafeDeserialization,
} from "./security/injection.js";

export {
  detectWeakCrypto,
  detectWeakRandomness,
} from "./security/crypto.js";

export { detectPathTraversal } from "./security/path-traversal.js";

export {
  detectInsecureCORS,
  detectInsecureCookies,
} from "./security/cors.js";

export {
  detectRegexDos,
  detectPrototypePollution,
  detectInsecureHTTP,
} from "./security/misc.js";
