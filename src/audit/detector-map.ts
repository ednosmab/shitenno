/**
 * Detector map — Orchestrator
 *
 * Composes all detector builders into a single map.
 */

import type { HealthIssue, SourceFileInfo, HistoryEntry } from "./types.js";
import { buildGovernanceDetectors } from "./detector-map/governance.js";
import { buildEngineeringQualityDetectors } from "./detector-map/engineering.js";
import { buildGitEnforcementDetectors } from "./detector-map/git.js";
import { buildArchReliabilityDetectors } from "./detector-map/arch.js";
import { buildOpsComplianceDetectors } from "./detector-map/ops.js";
import { buildSupplyChainTechDebtDetectors } from "./detector-map/supply-chain.js";

interface BuildDetectorMapOptions {
  projectRoot: string;
  shitennoDir: string;
  sourceFiles: SourceFileInfo[];
  rules: string[];
  history: HistoryEntry[];
}

export function buildDetectorMap(
  options: BuildDetectorMapOptions
): Record<string, () => HealthIssue[] | Promise<HealthIssue[]>> {
  const ctx = {
    projectRoot: options.projectRoot,
    shitennoDir: options.shitennoDir,
    sourceFiles: options.sourceFiles,
    rules: options.rules,
    history: options.history,
  };
  return {
    ...buildGovernanceDetectors(ctx),
    ...buildEngineeringQualityDetectors(ctx),
    ...buildGitEnforcementDetectors(ctx),
    ...buildArchReliabilityDetectors(ctx),
    ...buildOpsComplianceDetectors(ctx),
    ...buildSupplyChainTechDebtDetectors(ctx),
  };
}

export type { DetectorContext } from "./detector-map/context.js";
