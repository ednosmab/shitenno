import chalk from "chalk";
import ora from "ora";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type ProjectAnalysis } from "../../infrastructure/analyser.js";
import { askQuestions } from "../../interface/cli/prompts.js";
import {
  calculateMaturityProfile,
  loadMaturityProfile,
  type MaturityProfile,
} from "../../application/maturity-profile.js";
import { outputJson } from "../../shared/formatting.js";
import { output, outputBlank } from "../../shared/output.js";
import { guardInteractive } from "../../shared/shared.js";
import { recordDimensionFeedback, type PerformanceMetric } from "../../application/feedback-loops.js";

interface AssessContext { projectRoot: string; shitennoDir: string; isJson: boolean; }

export function buildSyntheticAnswersFromProfile(previousProfile: MaturityProfile, _analysis: ProjectAnalysis) {
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

export function buildDefaultSyntheticAnswers(analysis: ProjectAnalysis) {
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

export function calculateProfileInJsonMode(actx: AssessContext, previousProfile: MaturityProfile | null, analysis: ProjectAnalysis): MaturityProfile {
  const calcSpinner = ora("Calculating maturity profile...").start();
  const answers = previousProfile ? buildSyntheticAnswersFromProfile(previousProfile, analysis) : buildDefaultSyntheticAnswers(analysis);
  const profile = calculateMaturityProfile(answers, analysis, actx.shitennoDir);
  calcSpinner.succeed("Maturity profile calculated");
  return profile;
}

export async function calculateProfileInteractively(actx: AssessContext, options: { answersFile?: string }, analysis: ProjectAnalysis): Promise<MaturityProfile> {
  if (!guardInteractive(options, actx.isJson)) {
    // Non-interactive mode without --answers-file: use synthetic answers
    // This allows 'shugo assess' to work in CI/daemon/non-TTY environments
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

export function recordFeedbackForProfile(shitennoDir: string, newProfile: MaturityProfile): void {
  // Only record dimension feedback, not automatic deferred for capabilities
  // Capabilities are recommendations, not decisions — they should only be recorded
  // when the user actually accepts/rejects them via `shugo upgrade`
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
