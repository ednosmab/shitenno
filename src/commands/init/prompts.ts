/**
 * commands/init/prompts.ts — Prompt and analysis functions
 *
 * Extracted from commands/init.ts to keep modules focused.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { analyseProject } from "../../analyser.js";
import { askQuestions, type UserAnswers } from "../../prompts.js";
import { guardInteractive } from "../../shared.js";
import { loadMaturityProfile, calculateMaturityProfile, type MaturityProfile } from "../../maturity-profile.js";
import { healthBar } from "../../formatting.js";
import { output, outputBlank } from "../../output.js";
import { SHITENNO_DIR_NAME } from "../../constants.js";
import { displayProjectAnalysis, displayMaturityDimensions, displayCapabilities } from "./display.js";
import type { ProjectAnalysis } from "../../analyser.js";

// ── Starter Detection ───────────────────────────────────────────────────────

/**
 * Determines if a project is a "starter" (just framework installed, minimal code)
 * vs "active" (has meaningful implementation).
 *
 * Logic: sourceFileCount < 10 AND totalCommits < 1
 */
export function isStarterProject(analysis: ProjectAnalysis): boolean {
  return analysis.sourceFileCount < 10 && analysis.totalCommits < 1;
}

// ── Safety Guard ────────────────────────────────────────────────────────────

/**
 * Determines if init should be blocked because the target is inside shitenno-cli.
 */
export function shouldBlockInit(targetDir: string, force: boolean): boolean {
  return targetDir.includes("shitenno-cli") && !force;
}

// ── Already Initialized ─────────────────────────────────────────────────────

export async function handleAlreadyInitialized(targetDir: string): Promise<boolean> {
  if (!existsSync(resolve(targetDir, SHITENNO_DIR_NAME))) return false;

  output(chalk.yellow("  ⚠ Shugo is already initialized in this directory."));
  outputBlank();
  output(chalk.bold("  Your project has grown — let me re-analyze your maturity:"));
  outputBlank();

  const analyseSpinner = ora("Re-analysing project complexity...").start();
  const analysis = analyseProject(targetDir);
  analyseSpinner.succeed("Project analysis complete");

  outputBlank();
  displayProjectAnalysis(analysis, "Current state");

  const shitennoDir = resolve(targetDir, SHITENNO_DIR_NAME);
  const previousProfile = loadMaturityProfile(shitennoDir);

  if (previousProfile) {
    output(chalk.bold("  Previous maturity score:"));
    output(`    ${previousProfile.overallScore}/100 ${healthBar(previousProfile.overallScore, 100)}`);
    outputBlank();
  }

  output(chalk.gray("  Or:  shugo init --accept-recommended"));
  outputBlank();

  return true;
}

// ── Analysis & Display ──────────────────────────────────────────────────────

export function analyseAndDisplay(targetDir: string): ProjectAnalysis {
  const analyseSpinner = ora("Analysing project...").start();
  const analysis = analyseProject(targetDir);
  analyseSpinner.succeed("Project analysis complete");
  outputBlank();
  displayProjectAnalysis(analysis, "Detected");
  return analysis;
}

// ── Answer Collection ───────────────────────────────────────────────────────

export async function getAnswers(
  options: { answersFile?: string },
  analysis: ProjectAnalysis,
): Promise<UserAnswers | null> {
  if (options.answersFile) {
    const answersPath = resolve(options.answersFile);
    if (!existsSync(answersPath)) {
      output(chalk.red(`  ✘ Answers file not found: ${answersPath}`));
      process.exitCode = 1;
      return null;
    }
    const raw = readFileSync(answersPath, "utf-8");
    output(chalk.gray(`  Loaded answers from ${options.answersFile}`));
    return JSON.parse(raw);
  }

  if (!guardInteractive(options, false)) return null;

  output(chalk.bold("  Answer a few questions to determine your maturity profile:"));
  outputBlank();
  return await askQuestions(analysis);
}

// ── Profile Calculation ─────────────────────────────────────────────────────

export function calculateAndDisplayProfile(
  targetDir: string,
  answers: UserAnswers,
  analysis: ProjectAnalysis,
): { profile: MaturityProfile; shitennoDir: string } {
  const profileSpinner = ora("Calculating maturity profile...").start();
  const shitennoDir = resolve(targetDir, SHITENNO_DIR_NAME);
  const profile = calculateMaturityProfile(answers.maturity, analysis, shitennoDir);
  profileSpinner.succeed("Maturity profile calculated");

  outputBlank();
  output(chalk.bold.green("  ═══ Maturity Profile ═══"));
  outputBlank();
  displayMaturityDimensions(profile);
  outputBlank();
  displayCapabilities(profile);

  return { profile, shitennoDir };
}
