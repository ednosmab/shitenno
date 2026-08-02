/**
 * state-manager/project-state-reader.ts — Reads current project state
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { analyseProject } from "../analyser.js";
import { logger } from "../logger.js";
import type { ProjectState } from "./types.js";

function loadMaturity(shitennoDir: string): Pick<ProjectState, "maturity" | "installedCapabilities" | "recommendedCapabilities"> {
  const maturityPath = join(shitennoDir, "maturity-profile.json");
  if (!existsSync(maturityPath)) {
    return { maturity: null, installedCapabilities: [], recommendedCapabilities: [] };
  }
  try {
    const content = JSON.parse(readFileSync(maturityPath, "utf-8"));
    return {
      maturity: { overallScore: content.overallScore, dimensions: content.dimensions, computedAt: content.computedAt },
      installedCapabilities: content.installedCapabilities || [],
      recommendedCapabilities: content.recommendedCapabilities || [],
    };
  } catch {
    logger.debug("state-manager", "Failed to parse maturity profile");
    return { maturity: null, installedCapabilities: [], recommendedCapabilities: [] };
  }
}

function loadKnowledgeDebt(shitennoDir: string): ProjectState["knowledgeDebt"] {
  const reportsDir = join(shitennoDir, "reports");
  if (!existsSync(reportsDir)) return null;
  const debtFiles = readdirSync(reportsDir)
    .filter((f) => f.startsWith("knowledge-debt-") && f.endsWith(".json"))
    .sort().slice(-1);
  if (debtFiles.length === 0) return null;
  const debtFile = debtFiles[0];
  if (!debtFile) return null;
  try {
    const content = JSON.parse(readFileSync(join(reportsDir, debtFile), "utf-8"));
    return { totalGaps: content.totalGaps, healthScore: content.healthScore, detectedAt: content.generatedAt };
  } catch {
    logger.debug("state-manager", "Failed to parse knowledge debt report:", debtFile);
    return null;
  }
}

function loadProjectInfo(projectRoot: string): ProjectState["projectInfo"] {
  try {
    const analysis = analyseProject(projectRoot);
    return {
      name: projectRoot.split("/").pop() || "",
      stack: analysis.stack,
      hasGit: analysis.hasGit,
      hasCI: analysis.hasCI,
      hasTests: analysis.hasTests,
      hasTypeScript: analysis.hasTypeScript,
      packageCount: analysis.packageCount,
      sourceFileCount: analysis.sourceFileCount,
    };
  } catch {
    logger.debug("state-manager", "Project analysis unavailable");
    return { name: "", stack: [], hasGit: false, hasCI: false, hasTests: false, hasTypeScript: false, packageCount: 0, sourceFileCount: 0 };
  }
}

export function readProjectState(
  projectRoot: string,
  shitennoDir: string
): ProjectState {
  const maturityData = loadMaturity(shitennoDir);
  return {
    ...maturityData,
    knowledgeDebt: loadKnowledgeDebt(shitennoDir),
    complexity: null,
    projectInfo: loadProjectInfo(projectRoot),
  };
}
