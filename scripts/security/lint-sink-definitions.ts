/**
 * lint-sink-definitions.ts — Structural lint for sink/source definitions
 *
 * Runs in CI, warns without blocking. Catches:
 * 1. Bare sinks without suffix-match justification (class of bug like item 18)
 * 2. Directory-level exclusions in SECURITY_DETECTOR_SELF_PATHS (class of regression 2)
 *
 * See: PLANO-UNICO-CONSOLIDADO-2026-08-01-v2.md — Phase D.20
 */

import { ALL_SINKS } from "../../src/audit/taint/sinks.js";
import { SECURITY_DETECTOR_SELF_PATHS } from "../../src/audit/constants.js";

/**
 * Bare sink names that intentionally rely on suffix matching.
 * E.g. "query" matches "pool.query()", "find" matches "collection.find()".
 * If a NEW bare sink is added that should NOT suffix-match, remove it from this set.
 */
const KNOWN_BARE_SINKS = new Set([
  // Code execution
  "eval", "Function", "new Function", "setTimeout", "setInterval",
  // Command execution
  "exec", "execSync", "spawn", "spawnSync", "execFile",
  // Path traversal
  "readFile", "readFileSync", "writeFile", "writeFileSync", "unlink", "createReadStream",
  // SQL injection
  "query", "execute", "raw",
  // NoSQL injection (all bare for suffix matching)
  "find", "findOne", "findOneAndUpdate", "findOneAndDelete",
  "updateOne", "updateMany", "deleteOne", "deleteMany",
  "aggregate", "countDocuments", "distinct", "where", "$where",
  // SSTI (generic bare names for destructured imports)
  "render", "compile", "renderFile",
  // XSS (property sinks are bare by design)
  "innerHTML", "dangerouslySetInnerHTML", "outerHTML",
  // Redirect
  "redirect",
  // SSRF
  "fetch", "axios", "request", "got", "node-fetch", "undici",
]);

let warnings = 0;

for (const sink of ALL_SINKS) {
  if (!sink.name.includes(".") && !KNOWN_BARE_SINKS.has(sink.name)) {
    console.warn(
      `⚠️  Sink "${sink.name}" is bare without justification — confirm suffix-match covers qualified call. (same class as item 18)`,
    );
    warnings++;
  }
}

for (const path of SECURITY_DETECTOR_SELF_PATHS) {
  if (path.endsWith("/")) {
    console.warn(
      `⚠️  "${path}" excludes an ENTIRE DIRECTORY — confirm no production code lives there. (same class as Regression 2)`,
    );
    warnings++;
  }
}

if (warnings > 0) {
  console.log(`\n${warnings} warning(s) — review before merge.`);
  process.exitCode = 0; // warn, don't block
} else {
  console.log("✅ All sink definitions and exclusion paths are clean.");
}
