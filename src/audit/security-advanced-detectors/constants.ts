/**
 * Constants for advanced security detectors.
 *
 * Popular packages for typosquatting detection,
 * known malicious package patterns, and restrictive licenses.
 */

// ── Popular packages for typosquatting detection ─────────────────────────────

export const POPULAR_PACKAGES = new Set([
  // Core
  "react", "react-dom", "lodash", "axios", "express", "moment", "chalk",
  "commander", "webpack", "babel", "eslint", "prettier", "jest", "mocha",
  "typescript", "ts-node", "tsup", "esbuild", "vite", "next", "nuxt",
  "vue", "angular", "svelte", "jquery", "underscore",
  // Node.js ecosystem
  "bluebird", "async", "request", "node-fetch", "got", "ky",
  "mongoose", "sequelize", "typeorm", "prisma", "drizzle",
  "passport", "jsonwebtoken", "bcrypt", "argon2",
  "winston", "pino", "bunyan", "log4js",
  "prometheus", "grafana", "datadog",
  // Build/dev tools
  "husky", "lint-staged", "commitlint", "concurrently",
  "nodemon", "pm2", "cross-env", "rimraf", "mkdirp",
  // Utilities
  "uuid", "nanoid", "debug", "ms", "dotenv", "glob",
  "minimatch", "semver", "yargs", "inquirer", "ora",
]);

// ── Known malicious package patterns ────────────────────────────────────────

export const MALWARE_PATTERNS = [
  /^peckatron/i,
  /^flatmap-stream/i,
  /^event-stream/i,
  /^ crossenv/i,
  /^ fabric$/i,
  /^ maildev$/i,
  /^ node-uuid$/i,
  /^ angular-ui-router$/i,
];

// ── License conflicts ───────────────────────────────────────────────────────

export const RESTRICTIVE_LICENSES = new Set([
  "GPL-2.0", "GPL-3.0", "AGPL-3.0", "SSPL-1.0",
  "EUPL-1.1", "OSL-3.0", "CPAL-1.0",
]);

/** Common character substitutions used in typosquatting (l→1, o→0, etc.) */
export const CHAR_SUBSTITUTIONS: Record<string, string[]> = {
  "l": ["1", "i"], "o": ["0"], "i": ["l", "1"], "e": ["3"],
  "a": ["4", "@"], "s": ["5", "$"], "t": ["7"], "b": ["8"],
};
