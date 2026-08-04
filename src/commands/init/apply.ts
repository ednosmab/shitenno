/**
 * commands/init/apply.ts — Phase 4: apply installation per consent level
 *
 * Level 1 (observation): only `.shitenno/` is created — no project file is
 * touched (no opencode.json, no .gitignore, no .mcp.json, no hooks).
 *
 * Level 2 (full integration): agent config files (opencode.json, .mcp.json,
 * .gitignore) are backed up to `.shitenno/backup/pre-init/` and then replaced;
 * MCP registration and git hooks are installed (hooks caveat disclosed).
 *
 * All writes happen inside the isolated worktree path.
 */

import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { scaffoldShitenno, type ScaffoldResult } from "../../scaffolder.js";
import {
  calculateMaturityProfile,
  saveMaturityProfile,
  recordMaturitySnapshot,
  type MaturityProfile,
  type Capability,
} from "../../maturity-profile.js";
import { initializeRules } from "../../rule-engine.js";
import { createManifest, writeManifest } from "../../manifest.js";
import { SHITENNO_DIR_NAME } from "../../constants.js";
import type { UserAnswers } from "../../prompts.js";
import type { ProjectAnalysis } from "../../analyser.js";
import type { ConsentLevel } from "./consent.js";
import type { DiscoveryResult, GovernanceInventory } from "./discovery.js";
import { writeExternalIndex } from "./manifest-refs.js";
import { generateMcpJson } from "./mcp.js";
import {
  installGitHooks,
  generateFingerprintAndBriefing,
  getCliVersion,
} from "./orchestration.js";

/** Root-level files that Level 2 may replace (always backed up first). */
export const REPLACEABLE_ROOT_FILES = ["opencode.json", ".mcp.json", ".gitignore"] as const;

export const BACKUP_DIR = join(SHITENNO_DIR_NAME, "backup", "pre-init");

/**
 * Synthetic answers derived from the read-only discovery. The existing-project
 * flow skips the interactive questionnaire; sensible defaults keep the
 * scaffold deterministic and non-interactive.
 */
export function buildSyntheticAnswers(
  analysis: ProjectAnalysis,
  inventory: GovernanceInventory,
): UserAnswers {
  return {
    principalModel: "opencode/mimo-v2.5-free",
    executorModel: "opencode/deepseek-v4-flash-free",
    stack: analysis.stack.length > 0 ? analysis.stack : ["a definir"],
    database: "none",
    styling: "none",
    maturity: {
      usedShitennoBefore: false,
      isFirstProject: false,
      projectAge: analysis.totalCommits === 0 ? "new" : "established",
      teamSize: "solo",
      hasDedicatedTeam: false,
      hasArchitectureDocs: inventory.adrDirs.length > 0,
      hasADRs: inventory.adrDirs.length > 0,
      hasTechnicalReviews: false,
      hasCICD: inventory.cis.length > 0,
      hasAutomatedTests: analysis.hasTests,
      hasValidationPipeline: false,
      intendsToUseAI: true,
      aiWillImplement: true,
      requiresHumanReview: true,
      hasDefinedPatterns: false,
      hasReviewProcess: false,
      hasDecisionControl: false,
    },
    enableMcpRegistration: true,
  };
}

/**
 * Back up existing replaceable root files into `.shitenno/backup/pre-init/`.
 * `sourceDir` is the project root whose pre-init state is preserved — when
 * applying inside an isolated worktree, untracked configs live only in the
 * original project dir, so the backup must be copied from there, not from
 * the (fresh checkout) worktree. Returns the names of the backed-up files.
 */
export function backupExistingConfigs(
  worktreePath: string,
  shitennoDir: string,
  backupSourceDir: string = worktreePath,
): string[] {
  const backupDir = join(shitennoDir, "backup", "pre-init");
  const backedUp: string[] = [];
  for (const file of REPLACEABLE_ROOT_FILES) {
    const src = join(backupSourceDir, file);
    if (!existsSync(src)) continue;
    mkdirSync(backupDir, { recursive: true });
    copyFileSync(src, join(backupDir, file));
    backedUp.push(file);
  }
  return backedUp;
}

export interface ApplyResult {
  filesCreated: string[];
  backups: string[];
  capabilities: Capability[];
  profile: MaturityProfile;
}

/**
 * Re-anchor inventory dirs (absolute paths in the original project) to the
 * worktree. Versioned artifacts exist inside the worktree checkout, so the
 * manifest must reference the repo-relative location (`docs/adr/...`), which
 * is where they live after merge. Artifacts outside the repo are kept as-is.
 */
function remapInventoryToWorktree(
  inventory: GovernanceInventory,
  projectRoot: string,
  worktreePath: string,
): GovernanceInventory {
  const remap = (dir: string): string => {
    const rel = relative(projectRoot, dir);
    if (rel.startsWith("..")) return dir;
    return join(worktreePath, rel);
  };
  return {
    ...inventory,
    adrDirs: inventory.adrDirs.map(remap),
    plansDirs: inventory.plansDirs.map(remap),
  };
}

/**
 * Apply the installation inside the isolated worktree according to the
 * consent level.
 */
export async function applyByLevel(
  worktreePath: string,
  discovery: DiscoveryResult,
  level: ConsentLevel,
  options?: { enableMcpRegistration?: boolean; backupSourceDir?: string; projectRoot?: string },
): Promise<ApplyResult> {
  const shitennoDir = join(worktreePath, SHITENNO_DIR_NAME);
  const answers = buildSyntheticAnswers(discovery.analysis, discovery.inventory);
  const profile = calculateMaturityProfile(answers.maturity, discovery.analysis, shitennoDir);
  const capabilities: Capability[] =
    level === 1 ? ["core"] : ["core", ...profile.recommendedCapabilities];

  let backups: string[] = [];
  if (level === 2) {
    backups = backupExistingConfigs(
      worktreePath,
      shitennoDir,
      options?.backupSourceDir ?? worktreePath,
    );
  }

  const result: ScaffoldResult = scaffoldShitenno(worktreePath, answers, capabilities, {
    rootConfig: level === 2,
  });

  initializeRules(shitennoDir);
  saveMaturityProfile(shitennoDir, profile);
  recordMaturitySnapshot(shitennoDir, profile);

  const cliVersion = await getCliVersion();
  const manifest = createManifest(cliVersion, shitennoDir, capabilities, profile.overallScore);
  writeManifest(shitennoDir, manifest);

  await generateFingerprintAndBriefing(worktreePath, shitennoDir, discovery.analysis, profile);

  const hasExternalArtifacts =
    discovery.inventory.adrDirs.length > 0 || discovery.inventory.plansDirs.length > 0;
  if (hasExternalArtifacts) {
    const remapped = options?.projectRoot
      ? remapInventoryToWorktree(discovery.inventory, options.projectRoot, worktreePath)
      : discovery.inventory;
    writeExternalIndex(worktreePath, shitennoDir, remapped);
  }

  if (level === 2) {
    if (options?.enableMcpRegistration !== false) {
      generateMcpJson(worktreePath, result);
    }
    installGitHooks(worktreePath);
  }

  return { filesCreated: result.filesCreated, backups, capabilities, profile };
}