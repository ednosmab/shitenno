/**
 * Detector map — Engineering quality detectors builder
 */

import type { HealthIssue } from "../types.js";
import type { DetectorContext } from "./context.js";
import { TaintAnalyzer } from "../taint/index.js";
import type { TaintIssue } from "../taint/types.js";

import {
  detectOrphanModules,
  detectComplexityHotspots,
  detectTestCoverageGaps,
  detectConsoleUsage,
  detectEmptyCatchBlocks,
  detectHighComplexity,
  detectCircularDeps,
  detectUnusedExports,
  detectDeadCodePatterns,
  detectTestHealth,
  detectLintIssues,
  detectTypeSafetyIssues,
  detectUnpinnedVersions,
  detectMissingLockFile,
  detectLockFileDrift,
  detectPhantomDependencies,
  detectDeprecatedPackages,
  detectDependencyVulnerabilities,
  detectIncompatibleLicenses,
  detectConfigSecrets,
  detectHardcodedSecrets,
  detectSQLInjection,
  detectXSS,
  detectUnsafeEval,
  detectConsoleSecrets,
  detectWeakCrypto,
  detectInsecureHTTP,
  detectPrototypePollution,
  detectPathTraversal,
  detectRegexDos,
  detectUnsafeDeserialization,
  detectDependencyConfusion,
  detectInsecureCORS,
  detectInsecureCookies,
  detectWeakRandomness,
} from "../engineering-detectors.js";

/** Lower confidence for truly generic sink names that overlap with non-security methods
 *  (e.g. React.render(), Angular.compile()). The taint engine guards against false
 *  positives by only flagging when tainted data flows to the sink. */
const GENERIC_SINK_PATTERNS = /^(where|render|compile)$/;

function buildTaintDetector(ctx: DetectorContext) {
  return () => {
    try {
      const analyzer = new TaintAnalyzer({ projectRoot: ctx.projectRoot });
      return analyzer.analyze().map((ti: TaintIssue) => {
        const isGeneric = GENERIC_SINK_PATTERNS.test(ti.sinkType);
        return {
          type: ti.type as HealthIssue["type"], severity: ti.severity, description: ti.description,
          location: ti.location, recommendation: ti.recommendation,
          confidence: isGeneric ? 0.55 : 0.95,
        };
      });
    } catch (err) {
      return [{ type: "tainted_input" as const, severity: 2 as const,
        description: `Taint analysis não pôde ser executada — resultados de segurança incompletos: ${err instanceof Error ? err.message : String(err)}`,
        location: "taint-analyzer", recommendation: "Rodar com --debug para ver o erro completo" }] as HealthIssue[];
    }
  };
}

export function buildEngineeringQualityDetectors(ctx: DetectorContext): Record<string, () => HealthIssue[] | Promise<HealthIssue[]>> {
  return {
    detectOrphanModules: () => detectOrphanModules(ctx.projectRoot, ctx.sourceFiles),
    detectComplexityHotspots: () => detectComplexityHotspots(ctx.projectRoot, ctx.sourceFiles),
    detectTestCoverageGaps: () => detectTestCoverageGaps(ctx.projectRoot, ctx.sourceFiles),
    detectConsoleUsage: () => detectConsoleUsage(ctx.projectRoot, ctx.sourceFiles),
    detectEmptyCatchBlocks: () => detectEmptyCatchBlocks(ctx.projectRoot, ctx.sourceFiles),
    detectHighComplexity: () => detectHighComplexity(ctx.projectRoot, ctx.sourceFiles),
    detectCircularDeps: () => detectCircularDeps(ctx.projectRoot, ctx.sourceFiles),
    detectUnusedExports: () => detectUnusedExports(ctx.projectRoot, ctx.sourceFiles),
    detectDeadCodePatterns: () => detectDeadCodePatterns(ctx.projectRoot, ctx.sourceFiles),
    detectTestHealth: () => detectTestHealth(ctx.projectRoot),
    detectLintIssues: () => detectLintIssues(ctx.projectRoot),
    detectTypeSafetyIssues: () => detectTypeSafetyIssues(ctx.projectRoot, ctx.sourceFiles),
    detectUnpinnedVersions: () => detectUnpinnedVersions(ctx.projectRoot),
    detectMissingLockFile: () => detectMissingLockFile(ctx.projectRoot),
    detectLockFileDrift: () => detectLockFileDrift(ctx.projectRoot),
    detectPhantomDependencies: () => detectPhantomDependencies(ctx.projectRoot, ctx.sourceFiles),
    detectDeprecatedPackages: () => detectDeprecatedPackages(ctx.projectRoot),
    detectDependencyVulnerabilities: () => detectDependencyVulnerabilities(ctx.projectRoot),
    detectIncompatibleLicenses: () => detectIncompatibleLicenses(ctx.projectRoot),
    detectConfigSecrets: () => detectConfigSecrets(ctx.projectRoot),
    detectHardcodedSecrets: () => detectHardcodedSecrets(ctx.projectRoot, ctx.sourceFiles),
    detectSQLInjection: () => detectSQLInjection(ctx.projectRoot, ctx.sourceFiles),
    detectXSS: () => detectXSS(ctx.projectRoot, ctx.sourceFiles),
    detectUnsafeEval: () => detectUnsafeEval(ctx.projectRoot, ctx.sourceFiles),
    detectConsoleSecrets: () => detectConsoleSecrets(ctx.projectRoot, ctx.sourceFiles),
    detectWeakCrypto: () => detectWeakCrypto(ctx.projectRoot, ctx.sourceFiles),
    detectInsecureHTTP: () => detectInsecureHTTP(ctx.projectRoot, ctx.sourceFiles),
    detectPrototypePollution: () => detectPrototypePollution(ctx.projectRoot, ctx.sourceFiles),
    detectPathTraversal: () => detectPathTraversal(ctx.projectRoot, ctx.sourceFiles),
    detectRegexDos: () => detectRegexDos(ctx.projectRoot, ctx.sourceFiles),
    detectUnsafeDeserialization: () => detectUnsafeDeserialization(ctx.projectRoot, ctx.sourceFiles),
    detectDependencyConfusion: () => detectDependencyConfusion(ctx.projectRoot, ctx.sourceFiles),
    detectInsecureCORS: () => detectInsecureCORS(ctx.projectRoot, ctx.sourceFiles),
    detectInsecureCookies: () => detectInsecureCookies(ctx.projectRoot, ctx.sourceFiles),
    detectWeakRandomness: () => detectWeakRandomness(ctx.projectRoot, ctx.sourceFiles),
    detectTaintFlow: buildTaintDetector(ctx),
  };
}
