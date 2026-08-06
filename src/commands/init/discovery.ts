/**
 * commands/init/discovery.ts — Phase 1: read-only project discovery
 *
 * For existing projects, `shugo init` runs a read-only assessment before any
 * write happens. This module inventories pre-existing governance artifacts and
 * computes the real health of the project using the standard audit engine.
 * Nothing is written during discovery.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { auditHealth, type HealthAuditReport } from "../../application/health-auditor.js";
import { SHITENNO_DIR_NAME } from "../../domain/types/constants.js";
import { analyseProject, type ProjectAnalysis } from "../../infrastructure/analyser.js";

export interface ArtifactPresence {
  present: boolean;
  path?: string;
}

export interface AgentsFilePresence {
  present: boolean;
  file: "AGENTS.md" | "CLAUDE.md" | null;
  path?: string;
}

export interface GovernanceInventory {
  opencodeJson: ArtifactPresence;
  agentsFile: AgentsFilePresence;
  adrDirs: string[];
  plansDirs: string[];
  contributing: ArtifactPresence;
  codeowners: ArtifactPresence;
  cis: string[];
}

export interface IssuesBySeverity {
  1: number;
  2: number;
  3: number;
}

export interface DiscoveryResult {
  projectRoot: string;
  inventory: GovernanceInventory;
  analysis: ProjectAnalysis;
  health: HealthAuditReport;
  healthScore: number;
  issuesBySeverity: IssuesBySeverity;
}

const CI_FILE_CANDIDATES = [
  ".github/workflows",
  ".gitlab-ci.yml",
  ".travis.yml",
  "Jenkinsfile",
  "azure-pipelines.yml",
  "bitbucket-pipelines.yml",
  ".circleci/config.yml",
] as const;

function exists(path: string): boolean {
  return existsSync(path);
}

function readDirSafe(dir: string): Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }> {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/**
 * Inventory of pre-existing governance artifacts. Only looks, never writes.
 */
export function inventoryGovernance(projectRoot: string): GovernanceInventory {
  const presence = (path: string): ArtifactPresence =>
    exists(path) ? { present: true, path } : { present: false };

  const agentsFileEntry = (): AgentsFilePresence => {
    for (const file of ["AGENTS.md", "CLAUDE.md"] as const) {
      const path = join(projectRoot, file);
      if (exists(path)) return { present: true, file, path };
    }
    return { present: false, file: null };
  };

  return {
    opencodeJson: presence(join(projectRoot, "opencode.json")),
    agentsFile: agentsFileEntry(),
    adrDirs: collectMatchingDirs(projectRoot, (name) => name.startsWith("adr")),
    plansDirs: collectMatchingDirs(projectRoot, (name) => name.startsWith("plans")),
    contributing: presence(join(projectRoot, "CONTRIBUTING.md")),
    codeowners: presence(join(projectRoot, "CODEOWNERS")),
    cis: collectCis(projectRoot),
  };
}

/**
 * Collect directories like docs/adr, docs/adrs, docs/plans, governance/plans.
 */
function collectMatchingDirs(projectRoot: string, match: (name: string) => boolean): string[] {
  const found: string[] = [];
  for (const base of ["docs", "governance"]) {
    const baseDir = join(projectRoot, base);
    if (!exists(baseDir)) continue;
    for (const entry of readDirSafe(baseDir)) {
      if (entry.isDirectory() && match(entry.name)) found.push(join(baseDir, entry.name));
    }
  }
  return found;
}

function collectCis(projectRoot: string): string[] {
  const found: string[] = [];
  for (const candidate of CI_FILE_CANDIDATES) {
    const path = join(projectRoot, candidate);
    if (candidate.endsWith("/workflows") && exists(path)) {
      for (const entry of readDirSafe(path)) {
        if (entry.isFile() && /\.(yml|yaml)$/.test(entry.name)) found.push(join(path, entry.name));
      }
      continue;
    }
    if (exists(path)) found.push(path);
  }
  return found;
}

/**
 * Run the standard health audit in read-only discovery mode.
 *
 * The `.shitenno` directory does not exist yet; the audit engine tolerates that
 * (empty rules/history/suppressions). The result is a decision input, not an
 * installation output — nothing is written to the project.
 */
export async function discoverProject(projectRoot: string): Promise<DiscoveryResult> {
  const inventory = inventoryGovernance(projectRoot);
  const analysis = analyseProject(projectRoot);
  const health = await auditHealth(projectRoot, join(projectRoot, SHITENNO_DIR_NAME), "standard");

  const issuesBySeverity: IssuesBySeverity = {
    1: health.issues.filter((i) => i.severity === 1).length,
    2: health.issues.filter((i) => i.severity === 2).length,
    3: health.issues.filter((i) => i.severity === 3).length,
  };

  return {
    projectRoot,
    inventory,
    analysis,
    health,
    healthScore: health.healthScore,
    issuesBySeverity,
  };
}