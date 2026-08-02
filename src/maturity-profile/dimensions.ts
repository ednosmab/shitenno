import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import type { MaturityDimensions } from "../domain/entities/engineering-state.js";

export interface MaturityAnswers {
  usedShitennoBefore: boolean;
  isFirstProject: boolean;
  projectAge: "new" | "few_months" | "established" | "mature";
  teamSize: "solo" | "small" | "medium" | "large";
  hasDedicatedTeam: boolean;
  hasArchitectureDocs: boolean;
  hasADRs: boolean;
  hasTechnicalReviews: boolean;
  hasCICD: boolean;
  hasAutomatedTests: boolean;
  hasValidationPipeline: boolean;
  intendsToUseAI: boolean;
  aiWillImplement: boolean;
  requiresHumanReview: boolean;
  hasDefinedPatterns: boolean;
  hasReviewProcess: boolean;
  hasDecisionControl: boolean;
}

export interface ProjectAnalysis {
  monorepo: boolean;
  packageCount: number;
  hasTests: boolean;
  hasLinter: boolean;
  hasTypeScript: boolean;
  sourceFileCount: number;
}

function scoreArchitecture(answers: MaturityAnswers, analysis: ProjectAnalysis): number {
  let score = 0;
  if (answers.hasArchitectureDocs) score += 30;
  if (answers.hasADRs) score += 25;
  if (answers.hasTechnicalReviews) score += 20;
  if (analysis.monorepo) score += 15;
  if (analysis.packageCount >= 3) score += 10;
  return score;
}

function scoreGovernance(answers: MaturityAnswers, shitennoDir?: string): number {
  let score = 0;
  if (shitennoDir) score += detectGovernanceArtifactsScore(shitennoDir);
  if (answers.hasDefinedPatterns) score += 25;
  if (answers.hasReviewProcess) score += 25;
  if (answers.hasDecisionControl) score += 25;
  if (answers.usedShitennoBefore) score += 15;
  if (answers.teamSize === "medium" || answers.teamSize === "large") score += 10;
  return score;
}

function scoreQuality(answers: MaturityAnswers, analysis: ProjectAnalysis): number {
  let score = 0;
  if (answers.hasAutomatedTests) score += 30;
  if (answers.hasCICD) score += 25;
  if (answers.hasValidationPipeline) score += 20;
  if (analysis.hasTests) score += 15;
  if (analysis.hasLinter) score += 10;
  return score;
}

function scoreAutomation(answers: MaturityAnswers, analysis: ProjectAnalysis): number {
  let score = 0;
  if (answers.hasCICD) score += 40;
  if (answers.hasValidationPipeline) score += 30;
  if (answers.hasAutomatedTests) score += 20;
  if (analysis.hasTypeScript) score += 10;
  return score;
}

function scoreAi(answers: MaturityAnswers): number {
  let score = 0;
  if (answers.intendsToUseAI) score += 30;
  if (answers.aiWillImplement) score += 35;
  if (answers.requiresHumanReview) score += 25;
  if (!answers.isFirstProject) score += 10;
  return score;
}

function scoreDocumentation(answers: MaturityAnswers, analysis: ProjectAnalysis): number {
  let score = 0;
  if (answers.hasArchitectureDocs) score += 30;
  if (answers.hasADRs) score += 25;
  if (answers.hasDefinedPatterns) score += 20;
  if (answers.usedShitennoBefore) score += 15;
  if (analysis.sourceFileCount >= 100) score += 10;
  return score;
}

function scoreObservability(answers: MaturityAnswers, analysis: ProjectAnalysis): number {
  let score = 0;
  if (answers.hasCICD) score += 25;
  if (answers.hasValidationPipeline) score += 25;
  if (answers.hasAutomatedTests) score += 20;
  if (answers.teamSize === "medium" || answers.teamSize === "large") score += 15;
  if (analysis.monorepo) score += 15;
  return score;
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function calculateDimensions(
  answers: MaturityAnswers,
  analysis: ProjectAnalysis,
  shitennoDir?: string
): MaturityDimensions {
  return {
    architecture: clamp(scoreArchitecture(answers, analysis)),
    governance: clamp(scoreGovernance(answers, shitennoDir)),
    quality: clamp(scoreQuality(answers, analysis)),
    automation: clamp(scoreAutomation(answers, analysis)),
    ai: clamp(scoreAi(answers)),
    documentation: clamp(scoreDocumentation(answers, analysis)),
    observability: clamp(scoreObservability(answers, analysis)),
  };
}

function staticArtifactsScore(shitennoDir: string): number {
  let score = 0;
  if (existsSync(join(shitennoDir, "governance", "WORKFLOW.md"))) score += 10;
  if (existsSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"))) score += 5;
  if (existsSync(join(shitennoDir, "governance", "context", "context_buffer.yaml"))) score += 5;
  if (existsSync(join(shitennoDir, "docs", "FORBIDDEN_OPERATIONS.md"))) score += 5;
  if (existsSync(join(shitennoDir, "docs", "DESDO.md"))) score += 5;
  if (existsSync(join(shitennoDir, "docs", "adrs"))) score += 5;
  return score;
}

interface DirScoreConfig {
  highThreshold: number;
  highScore: number;
  lowScore: number;
}

function directoryFileScore(
  dirPath: string,
  filterFn: (name: string) => boolean,
  config: DirScoreConfig,
): number {
  if (!existsSync(dirPath)) return 0;
  try {
    const files = readdirSync(dirPath).filter(filterFn);
    if (files.length >= config.highThreshold) return config.highScore;
    if (files.length >= 1) return config.lowScore;
  } catch (error) {
    logger.debug("maturity-profile", "Suppressed error", { error });
  }
  return 0;
}

export function detectGovernanceArtifactsScore(shitennoDir: string): number {
  if (!existsSync(shitennoDir)) return 0;
  let score = staticArtifactsScore(shitennoDir);
  score += directoryFileScore(
    join(shitennoDir, "governance", "agents"),
    (f) => f.endsWith(".yaml"),
    { highThreshold: 3, highScore: 5, lowScore: 3 },
  );
  score += directoryFileScore(
    join(shitennoDir, "governance", "rules"),
    (f) => f.endsWith(".json"),
    { highThreshold: 2, highScore: 5, lowScore: 3 },
  );
  score += directoryFileScore(
    join(shitennoDir, "governance", "policies"),
    (f) => f.endsWith(".md") && f !== "POLICY-TEMPLATE.md",
    { highThreshold: 3, highScore: 10, lowScore: 5 },
  );
  return score;
}

export function calculateOverallScore(dimensions: MaturityDimensions): number {
  const weights: Record<keyof MaturityDimensions, number> = {
    architecture: 0.18,
    governance: 0.12,
    quality: 0.18,
    automation: 0.15,
    ai: 0.12,
    documentation: 0.15,
    observability: 0.10,
  };

  let total = 0;
  let weightSum = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += dimensions[key as keyof MaturityDimensions] * weight;
    weightSum += weight;
  }

  return Math.round(total / weightSum);
}
