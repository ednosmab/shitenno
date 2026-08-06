/**
 * Audit module — Constants
 *
 * All shared constants for the health audit system.
 */

// ── Re-exports from sub-modules ──────────────────────────────────────────────

export { DETECTORS_BY_LEVEL } from "./constants/detector-levels.js";

// ── Engineering Audit Constants ───────────────────────────────────────────────

export const ORPHAN_SEVERITY_THRESHOLD = 200;
export const OVERSIZED_WARNING_THRESHOLD = 1000;
export const OVERSIZED_INFO_THRESHOLD = 500;
export const MISSING_TEST_WARNING_THRESHOLD = 10;
export const ANY_TYPE_SEVERITY_THRESHOLD = 10;

// ── Source File Patterns ─────────────────────────────────────────────────────

export const SOURCE_SKIP_PATTERNS = [/\.test\.(ts|tsx|js|jsx)$/, /\.bench\.(ts|tsx|js|jsx)$/];

// ── Violation Keywords ───────────────────────────────────────────────────────
// Re-export from single source of truth in src/constants.ts
export { VIOLATION_KEYWORDS } from "../domain/types/constants.js";

// ── Blocked Licenses ─────────────────────────────────────────────────────────

export const BLOCKED_LICENSES = ["GPL-3.0", "AGPL-3.0", "SSPL-1.0", "EUPL-1.1"];

// ── Security Detector Pattern Files ─────────────────────────────────────────
// Only the files that literally DEFINE detection patterns (name/regex lists).
// No directory exclusions: a real secret in src/audit/security/ must be detected.

export const DETECTOR_PATTERN_FILES = new Set([
  "src/audit/taint/sinks.ts",
  "src/audit/taint/sources.ts",
  "src/audit/taint/sanitizers.ts",
  "src/audit/security/secrets.ts",
  "src/audit/security/crypto.ts",
  "src/audit/security/cors.ts",
  "src/audit/security/path-traversal.ts",
  "src/audit/security/injection.ts",
]);

// ── Complexity Thresholds ────────────────────────────────────────────────────

export const COMPLEXITY_WARNING_THRESHOLD = 15;
export const COMPLEXITY_CRITICAL_THRESHOLD = 25;

// ── Placeholder Names ────────────────────────────────────────────────────────

export const PLACEHOLDER_NAMES = new Set(["TEMPLATE.md", "RULE-TEMPLATE.json", ".gitkeep", "README.md"]);

// ── Cross-File Detectors (require full project scan) ────────────────────────

/**
 * Detectors that require analysis of the entire project graph.
 * These must ALWAYS run on the full project, even in --changed mode.
 * Running them on a subset of files would produce false negatives.
 */
export const CROSS_FILE_ONLY_DETECTORS = new Set([
  "detectCircularDeps",
  "detectOrphanModules",
  "detectSystemMapMismatch",
  "detectModuleCoupling",
  "detectBarrelFileCycles",
  "detectDeadRules",
  "detectCrossDocP0Contradiction",
  "detectDocCountMismatch",
  "detectNumberingGap",
  "detectPhantomRuleRefs",
  "detectOrphanSkills",
  "detectOrphanSkillFiles",
  "detectBrokenSkillManifestEntries",
  "detectAgentContractRefs",
  // Enterprise cross-file detectors
  "detectSchemaConsistency",
  "detectDataOwnership",
  "detectPipelineGaps",
  "detectOWASPTop10",
  "detectCWEMapping",
  "detectSOC2Controls",
  "detectNISTAlignment",
  "detectLGPDCompliance",
  "detectSBOMCoverage",
  "detectLicenseConflicts",
  "detectTransitiveVulns",
  "detectMalwarePatterns",
  "detectTechDebtCost",
  "detectTDR",
  "detectDebtTrend",
  "detectDebtByDomain",
  "detectDebtAccumulationRate",
  "detectSBOMExists",
  "detectSBOMCompleteness",
  "detectDuplicateDeps",
  "detectDepAuditStatus",
]);
