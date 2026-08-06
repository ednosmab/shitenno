/**
 * commands/init/orchestration.ts — Scaffolding orchestration
 *
 * Extracted from commands/init.ts to keep modules focused.
 */

import { existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import ora from "ora";
import fse from "fs-extra";
import { scaffoldShitenno } from "../../infrastructure/scaffolder.js";
import { invalidateCache } from "../../infrastructure/cache.js";
import { loadPlugins, getHookBus } from "../../infrastructure/plugin-system.js";
import {
  saveMaturityProfile,
  recordMaturitySnapshot,
  loadMaturityProfile,
  type MaturityProfile,
  type Capability,
} from "../../application/maturity-profile.js";
import { saveUserProfile } from "../../application/feedback-engine.js";
import { initializeRules } from "../../application/rule-engine.js";
import { createManifest, writeManifest } from "../../infrastructure/manifest.js";
import { getEventBus } from "../../infrastructure/event-bus.js";
import { logger } from "../../shared/logger.js";
import { SHITENNO_DIR_NAME } from "../../domain/types/constants.js";
import { installReactiveHooks } from "../../infrastructure/git-hooks-installer.js";
import { output, outputBlank, outputError } from "../../shared/output.js";
import { displaySuccessResults } from "./display.js";
import { generateMcpJson } from "./mcp.js";
import type { ProjectAnalysis } from "../../infrastructure/analyser.js";
import type { UserAnswers } from "../../interface/cli/prompts.js";

// ── Event Publishing ────────────────────────────────────────────────────────

interface PublishInitEventsOptions {
  bus: ReturnType<typeof getEventBus>;
  result: { filesCreated: string[] };
  capsToInstall: Capability[];
  cliVersion: string;
  previousProfile: MaturityProfile | null;
  profile: MaturityProfile;
}

export function publishInitEvents(options: PublishInitEventsOptions): void {
  const { bus, result, capsToInstall, cliVersion, previousProfile, profile } = options;
  for (const file of result.filesCreated) {
    bus.publish("asset.created", {
      assetId: file,
      assetType: "governance",
      path: file,
    });
  }

  for (const cap of capsToInstall) {
    bus.publish("capability.installed", {
      capabilityId: cap,
      capabilityName: cap,
      version: cliVersion,
    });
  }

  if (previousProfile) {
    bus.publish("maturity.changed", {
      dimension: "overall",
      previousScore: previousProfile.overallScore,
      newScore: profile.overallScore,
      delta: profile.overallScore - previousProfile.overallScore,
    });
  }
}

// ── Git Hooks ───────────────────────────────────────────────────────────────

export function installGitHooks(targetDir: string): void {
  try {
    const hooksResult = installReactiveHooks(targetDir, "shugo");
    if (hooksResult.installed.length > 0) {
      output(chalk.gray(`  ✓ Shugo git hooks installed: ${hooksResult.installed.join(", ")}`));
    } else if (hooksResult.skipped.length > 0 && hooksResult.skipped[0] !== "not-a-git-repo") {
      output(chalk.gray(`  • Git hooks already configured`));
    }
  } catch (error) {
    logger.debug("init", "Failed to install git hooks", { error });
  }
}

// ── CLI Version ─────────────────────────────────────────────────────────────

export async function getCliVersion(): Promise<string> {
  try {
    const { readFileSync: readFS } = await import("node:fs");
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const pkg = JSON.parse(readFS(join(__dirname, "..", "..", "..", "package.json"), "utf-8"));
    return pkg.version || "unknown";
  } catch (error) {
    logger.debug("init", "Suppressed error", { error });
    return "unknown";
  }
}

// ── User Profile ────────────────────────────────────────────────────────────

export function saveUserProfileFromAnswers(shitennoDir: string, answers: UserAnswers): void {
  if (answers.userProfile) {
    saveUserProfile(shitennoDir, {
      name: answers.userProfile.name,
      role: answers.userProfile.role,
      architecture: answers.userProfile.architecture,
      coding: answers.userProfile.coding,
      leadership: answers.userProfile.leadership,
      tone: answers.userProfile.tone,
      language: answers.userProfile.language,
      codeFreePercent: answers.userProfile.codeFreePercent,
      focusAreas: answers.userProfile.focusAreas,
    });
  }
}

// ── Fingerprint & Briefing ──────────────────────────────────────────────────

export async function generateFingerprintAndBriefing(
  targetDir: string,
  shitennoDir: string,
  analysis: ProjectAnalysis,
  profile: MaturityProfile,
): Promise<void> {
  const { generateProjectFingerprint, saveFingerprint } = await import("../../infrastructure/project-fingerprint.js");
  const fingerprint = generateProjectFingerprint(targetDir, analysis, profile.overallScore);
  saveFingerprint(shitennoDir, fingerprint);

  try {
    const { generateRiskMap } = await import("../../infrastructure/risk-map.js");
    const { generateBriefing, briefingToMarkdown } = await import("../../application/briefing.js");
    const riskMap = generateRiskMap(targetDir, shitennoDir);
    const briefing = generateBriefing({ fingerprint, riskMap, contextRules: [], dynamicRules: [], maturityProfile: profile, projectRoot: targetDir });
    const briefingPath = join(shitennoDir, "BRIEFING.md");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(briefingPath, briefingToMarkdown(briefing), "utf-8");
  } catch (error) {
    logger.debug("init", "Suppressed error", { error });
  }
}

// ── Plugin Loading ──────────────────────────────────────────────────────────

export async function loadAndRegisterPlugins(targetDir: string): Promise<void> {
  const plugins = await loadPlugins(targetDir);
  const hookBus = getHookBus();
  for (const plugin of plugins) {
    hookBus.registerPlugin(plugin);
  }
  if (plugins.length > 0) {
    output(chalk.gray(`  🔌 Loaded ${plugins.length} plugin(s)`));
  }
}

// ── Error Handling ──────────────────────────────────────────────────────────

export function handleScaffoldError(error: unknown, shitennoDir: string): void {
  outputError(chalk.red(`  Error: ${error}`));
  if (existsSync(shitennoDir)) {
    try {
      fse.removeSync(shitennoDir);
      output(chalk.gray("  Cleaned up partial shitenno/ directory."));
    } catch {
      output(chalk.yellow("  ⚠ Could not clean up shitenno/ — remove manually."));
    }
  }
  process.exitCode = 1;
}

// ── Main Scaffolding ────────────────────────────────────────────────────────

export async function runScaffolding(
  targetDir: string,
  analysis: ProjectAnalysis,
  profile: MaturityProfile,
  answers: UserAnswers,
): Promise<void> {
  const scaffoldSpinner = ora("Installing governance ecosystem...").start();
  const shitennoDir = resolve(targetDir, SHITENNO_DIR_NAME);
  const previousProfile = existsSync(shitennoDir) ? loadMaturityProfile(shitennoDir) : null;

  try {
    const capsToInstall: Capability[] = ["core", ...profile.recommendedCapabilities];
    const result = scaffoldShitenno(targetDir, answers, capsToInstall);
    scaffoldSpinner.succeed("Framework installed!");

    initializeRules(shitennoDir);
    saveMaturityProfile(shitennoDir, profile);
    recordMaturitySnapshot(shitennoDir, profile);

    const cliVersion = await getCliVersion();
    const manifest = createManifest(cliVersion, shitennoDir, capsToInstall, profile.overallScore);
    writeManifest(shitennoDir, manifest);

    saveUserProfileFromAnswers(shitennoDir, answers);
    await generateFingerprintAndBriefing(targetDir, shitennoDir, analysis, profile);

    displaySuccessResults(result);
    invalidateCache({ projectRoot: targetDir });

    if (answers.enableMcpRegistration) {
      generateMcpJson(targetDir, result);
    }

    installGitHooks(targetDir);
    await loadAndRegisterPlugins(targetDir);

    if (profile.futureCapabilities.length > 0) {
      output(chalk.gray("  As your project grows, run 'shugo assess' to discover new capabilities."));
    }
    outputBlank();

    const bus = getEventBus();
    publishInitEvents({ bus, result, capsToInstall, cliVersion, previousProfile, profile });
  } catch (error) {
    scaffoldSpinner.fail("Failed to install ecosystem");
    handleScaffoldError(error, shitennoDir);
  }
}
