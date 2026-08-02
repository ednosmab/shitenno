/**
 * assess.ts — Maturity Assessment & Evolution Recommendations
 *
 * Re-avalia a maturidade do projeto e recomenda novas capacidades.
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyseProject, type ProjectAnalysis } from "../analyser.js";
import { askQuestions } from "../prompts.js";
import {
  calculateMaturityProfile,
  saveMaturityProfile,
  recordMaturitySnapshot,
  loadMaturityProfile,
  type MaturityProfile,
} from "../maturity-profile.js";
import { outputJson } from "../formatting.js";
import { output, outputBlank } from "../output.js";
import { guardNotInitialized, guardInteractive, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { printDaemonBanner } from "../daemon-context-banner.js";
import { recordDimensionFeedback, type PerformanceMetric } from "../feedback-loops.js";
import { displayComplexity, displayAssessmentResults } from "./assess/display.js";

interface AssessContext { projectRoot: string; shitennoDir: string; isJson: boolean; }

function buildSyntheticAnswersFromProfile(previousProfile: MaturityProfile, _analysis: ProjectAnalysis) {
  return {
    usedShitennoBefore: previousProfile.installedCapabilities.length > 1,
    isFirstProject: false,
    projectAge: "established" as const,
    teamSize: "small" as const,
    hasDedicatedTeam: previousProfile.installedCapabilities.length > 3,
    hasArchitectureDocs: previousProfile.installedCapabilities.includes("architecture"),
    hasADRs: previousProfile.installedCapabilities.includes("architecture"),
    hasTechnicalReviews: previousProfile.installedCapabilities.includes("governance"),
    hasCICD: previousProfile.dimensions.automation > 30,
    hasAutomatedTests: previousProfile.dimensions.quality > 30,
    hasValidationPipeline: previousProfile.dimensions.automation > 50,
    intendsToUseAI: previousProfile.dimensions.ai > 20,
    aiWillImplement: previousProfile.dimensions.ai > 50,
    requiresHumanReview: previousProfile.dimensions.governance > 30,
    hasDefinedPatterns: previousProfile.dimensions.governance > 25,
    hasReviewProcess: previousProfile.dimensions.governance > 40,
    hasDecisionControl: previousProfile.dimensions.governance > 50,
  };
}

function buildDefaultSyntheticAnswers(analysis: ProjectAnalysis) {
  return {
    usedShitennoBefore: false,
    isFirstProject: false,
    projectAge: "new" as const,
    teamSize: "solo" as const,
    hasDedicatedTeam: false,
    hasArchitectureDocs: false,
    hasADRs: false,
    hasTechnicalReviews: false,
    hasCICD: analysis.hasCI,
    hasAutomatedTests: analysis.hasTests,
    hasValidationPipeline: false,
    intendsToUseAI: true,
    aiWillImplement: true,
    requiresHumanReview: true,
    hasDefinedPatterns: false,
    hasReviewProcess: false,
    hasDecisionControl: false,
  };
}

function calculateProfileInJsonMode(actx: AssessContext, previousProfile: MaturityProfile | null, analysis: ProjectAnalysis): MaturityProfile {
  const calcSpinner = ora("Calculating maturity profile...").start();
  const answers = previousProfile ? buildSyntheticAnswersFromProfile(previousProfile, analysis) : buildDefaultSyntheticAnswers(analysis);
  const profile = calculateMaturityProfile(answers, analysis, actx.shitennoDir);
  calcSpinner.succeed("Maturity profile calculated");
  return profile;
}

async function calculateProfileInteractively(actx: AssessContext, options: { answersFile?: string }, analysis: ProjectAnalysis): Promise<MaturityProfile> {
  if (!guardInteractive(options, actx.isJson)) {
    if (!actx.isJson) output(chalk.gray("  Non-interactive mode — using synthetic answers from project analysis"));
    const calcSpinner = ora("Calculating maturity profile...").start();
    const existingProfile = loadMaturityProfile(actx.shitennoDir);
    const answers = existingProfile
      ? buildSyntheticAnswersFromProfile(existingProfile, analysis)
      : buildDefaultSyntheticAnswers(analysis);
    const profile = calculateMaturityProfile(answers, analysis, actx.shitennoDir);
    calcSpinner.succeed("Maturity profile calculated");
    return profile;
  }
  output(chalk.bold("  Re-evaluate your maturity profile:"));
  outputBlank();
  let answers: Awaited<ReturnType<typeof askQuestions>>;
  if (options.answersFile) {
    const answersPath = resolve(options.answersFile);
    if (!existsSync(answersPath)) {
      if (actx.isJson) outputJson({ error: "answers_file_not_found", message: `File not found: ${answersPath}` });
      else output(chalk.red(`  ✘ Answers file not found: ${answersPath}`));
      process.exitCode = 1;
      throw new Error("exit");
    }
    const raw = readFileSync(answersPath, "utf-8");
    answers = JSON.parse(raw);
    if (!actx.isJson) output(chalk.gray(`  Loaded answers from ${options.answersFile}`));
  } else {
    answers = await askQuestions(analysis);
  }
  const calcSpinner = ora("Calculating maturity profile...").start();
  const profile = calculateMaturityProfile(answers.maturity, analysis, actx.shitennoDir);
  calcSpinner.succeed("Maturity profile calculated");
  return profile;
}

function recordFeedbackForProfile(shitennoDir: string, newProfile: MaturityProfile): void {
  const dimensionToMetric: Record<string, PerformanceMetric> = {
    architecture: "architectural_vision", governance: "decision_making", quality: "technical_communication",
    automation: "sustainable_velocity", ai: "prompt_quality", documentation: "scope_management", observability: "risk_management",
  };
  for (const [dim, score] of Object.entries(newProfile.dimensions)) {
    const metric = dimensionToMetric[dim];
    if (metric) {
      recordDimensionFeedback(shitennoDir, { recommendationId: `maturity-${dim}`, dimension: metric,
        action: score >= 65 ? "accepted" : score < 35 ? "rejected" : "deferred",
        evidence: `Maturity score: ${score}/100`,
        context: { maturityScore: newProfile.overallScore, installedCapabilities: newProfile.installedCapabilities, knowledgeDebt: 0 } });
    }
  }
}

export const assessCommand = new Command("assess")
  .description("Re-evaluate project maturity and recommend new capabilities")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--json", "Output results as JSON")
  .option("--answers-file <path>", "JSON file with pre-defined answers (skips interactive prompts)")
  .option("--complexity", "Show project complexity analysis and active rules")
  .action(async (options) => {
    const isJson = options.json === true;
    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;
    void printDaemonBanner(ctx.shitennoDir, isJson);
    if (options.complexity) { displayComplexity(ctx.projectRoot, ctx.shitennoDir, isJson); return; }
    if (!isJson) {
      outputBlank();
      output(chalk.bold.cyan("  ╔══════════════════════════════════════════╗"));
      output(chalk.bold.cyan("  ║  shugo assess — Maturity Assessment      ║"));
      output(chalk.bold.cyan("  ╚══════════════════════════════════════════╝"));
      outputBlank();
    }
    if (!checkLifecycleGate("assess", ctx.projectRoot, ctx.shitennoDir, isJson)) return;
    const previousProfile = loadMaturityProfile(ctx.shitennoDir);
    const analyseSpinner = ora("Analysing project...").start();
    const analysis = analyseProject(ctx.projectRoot);
    analyseSpinner.succeed("Project analysis complete");
    const actx = { projectRoot: ctx.projectRoot, shitennoDir: ctx.shitennoDir, isJson };
    let newProfile: MaturityProfile;
    if (isJson) {
      newProfile = calculateProfileInJsonMode(actx, previousProfile, analysis);
    } else {
      try { newProfile = await calculateProfileInteractively(actx, options, analysis); }
      catch (e) { if ((e as Error).message === "exit") return; throw e; }
    }
    saveMaturityProfile(ctx.shitennoDir, newProfile);
    recordMaturitySnapshot(ctx.shitennoDir, newProfile);
    const scoreDelta = previousProfile ? newProfile.overallScore - previousProfile.overallScore : undefined;
    getEventBus().publish("maturity.changed", { dimension: "overall", previousScore: previousProfile?.overallScore ?? newProfile.overallScore,
      newScore: newProfile.overallScore, delta: scoreDelta ?? 0 });
    recordFeedbackForProfile(ctx.shitennoDir, newProfile);
    if (isJson) {
      outputJson({ projectRoot: ctx.projectRoot, previousScore: previousProfile?.overallScore,
        newProfile: { dimensions: newProfile.dimensions, overallScore: newProfile.overallScore, installedCapabilities: newProfile.installedCapabilities,
          recommendedCapabilities: newProfile.recommendedCapabilities, futureCapabilities: newProfile.futureCapabilities },
        scoreDelta, computedAt: newProfile.computedAt });
      return;
    }
    displayAssessmentResults(ctx.shitennoDir, previousProfile, newProfile, scoreDelta);
  });
