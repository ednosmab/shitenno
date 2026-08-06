/**
 * constants.ts — Shared Constants for Shugo
 *
 * Eliminates duplication of VIOLATION_KEYWORDS and COMMAND_GATES.
 */

/**
 * Single source of truth for the metadata directory name.
 * NEVER hardcode "shitenno" in other files — use this constant.
 * This is the ONLY place where the string literal should appear.
 */
export const SHITENNO_DIR_NAME = ".shitenno";

/** Keywords indicating violations in commits/logs. Unified from src/constants.ts + src/audit/constants.ts. */
export const VIOLATION_KEYWORDS = [
  // Portuguese
  "erro", "bug", "corrigi", "falhou", "rollback", "violação",
  "regressão", "problema", "incidente", "falha", "crash",
  // English
  "fix", "error", "issue", "broken", "exception", "reverted",
  "revert", "violated", "violacao", "undeclared", "missing",
  "unexpected", "failed", "regression",
];

/** Command → minimum lifecycle state mapping. */
export const COMMAND_GATES: Record<string, string> = {
  init: "uninitialized",
  status: "discovered",
  detect: "discovered",
  audit: "discovered",
  upgrade: "assessed",
  validate: "assessed",
  assess: "discovered",
  doctor: "discovered",
  run: "assessed",
  sync: "governed",
  clean: "governed",
  evolve: "governed",
  briefing: "discovered",
  feedback: "discovered",
  bench: "discovered",
  dashboard: "discovered",
  "docs-audit": "discovered",
};

/** Timeout for git commands (ms). */
export const GIT_TIMEOUT = 5000;

/** Timeout for rule scripts (ms). */
export const RULE_SCRIPT_TIMEOUT = 30000;

/** Knowledge-artifact reference manifest inside .shitenno/docs. */
export const EXTERNAL_INDEX_REL_PATH = "docs/external-index.json";

/** npm package name (used for node_modules/shitenno resolution). */
export const NPM_PACKAGE_NAME = "shitenno";

/** Metadata subfolder name used inside the git common dir (consent records). */
export const GIT_METADATA_DIR_NAME = "shitenno";

/** Valid action types for rule engine — single source of truth in rule-engine.ts. */
export { VALID_ACTION_TYPES } from "../../application/rule-engine.js";
