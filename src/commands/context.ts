/**
 * context.ts — Context command for AI agents
 *
 * Provides a single command that outputs the full project context
 * optimized for AI agent consumption.
 *
 * PRINCIPLE: One command, complete context.
 */

import { getEngineeringState } from "../engineering-state/index.js";
import { generateForecast } from "../domain/rules/trend-engine.js";
import { logger } from "../shared/logger.js";
import { join } from "node:path";
import { SHITENNO_DIR_NAME } from "../domain/types/constants.js";
import chalk from "chalk";
import { output, outputBlank } from "../shared/output.js";
import { Command } from "commander";


// ── Types ───────────────────────────────────────────────────────────────────

export interface ContextOutput {
  version: string;
  timestamp: string;
  project: {
    name: string;
    root: string;
    stack: string[];
  };
  engineeringState: {
    consolidatedAt: string;
    lifecycle: string;
    healthScores: {
      overall: number;
      knowledgeDebt: number;
      knowledgeGraph: number;
    };
    entropy: {
      score: number;
    };
    maturity: {
      score: number;
      level: string;
    } | null;
    capabilities: string[];
    assets: {
      type: string;
      path: string;
      status: string;
    }[];
    rules: number;
    policies: number;
  };
  trend: {
    direction: string;
    confidence: number;
  } | null;
  challenges: {
    type: string;
    severity: string;
    description: string;
  }[];
}

// ── Context Generation ──────────────────────────────────────────────────────

/**
 * Generate context output for AI agents.
 */
function buildContextOutput(
  state: ReturnType<typeof getEngineeringState>,
  trend: ReturnType<typeof generateForecast>,
  trendDirection: string,
  challenges: ContextOutput["challenges"]
): ContextOutput {
  return {
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    project: {
      name: state.project.name,
      root: state.project.root,
      stack: state.project.stack,
    },
    engineeringState: {
      consolidatedAt: state.consolidatedAt,
      lifecycle: state.lifecycle,
      healthScores: state.healthScores,
      entropy: state.entropy,
      maturity: state.maturity ? {
        score: state.maturity.overallScore,
        level: "defined",
      } : null,
      capabilities: state.capabilities,
      assets: state.assets.map((a) => ({
        type: a.type,
        path: a.path,
        status: a.status,
      })),
      rules: state.activeRules,
      policies: state.activePolicies,
    },
    trend: trend ? {
      direction: trendDirection,
      confidence: trend.confidence,
    } : null,
    challenges,
  };
}

export async function generateContext(shitennoDir: string): Promise<ContextOutput | null> {
  const projectRoot = process.cwd();

  let state;
  try {
    state = getEngineeringState(projectRoot, shitennoDir);
  } catch {
    logger.debug("context", "No engineering state found");
    return null;
  }

  const trend = generateForecast(loadHistoricalStates(shitennoDir));
  const challenges = loadChallenges(state);
  const trendDirection = trend?.trends.find((t) => t.metric === "health")?.direction ?? "unknown";

  return buildContextOutput(state, trend, trendDirection, challenges);
}

/**
 * Load historical states for trend analysis.
 */
function loadHistoricalStates(shitennoDir: string) {
  const projectRoot = process.cwd();
  try {
    const state = getEngineeringState(projectRoot, shitennoDir);
    return [state];
  } catch {
    return [];
  }
}

/**
 * Load challenges from engineering state.
 */
function loadChallenges(state: ReturnType<typeof getEngineeringState>): ContextOutput["challenges"] {
  const challenges: ContextOutput["challenges"] = [];

  if (state.entropy.score > 50) {
    challenges.push({
      type: "entropy",
      severity: "high",
      description: `Entropy score is ${state.entropy.score}/100 — consider cleanup`,
    });
  }

  if (state.healthScores.knowledgeDebt < 70) {
    challenges.push({
      type: "knowledge_debt",
      severity: "medium",
      description: `Knowledge debt score is ${state.healthScores.knowledgeDebt}/100`,
    });
  }

  if (state.healthScores.knowledgeGraph < 70) {
    challenges.push({
      type: "knowledge_graph",
      severity: "medium",
      description: `Knowledge graph score is ${state.healthScores.knowledgeGraph}/100`,
    });
  }

  return challenges;
}

// ── CLI Integration ─────────────────────────────────────────────────────────

/**
 * Execute the context command.
 */
export async function executeContextCommand(options: { json?: boolean; forAgent?: string }): Promise<void> {
  const projectRoot = process.cwd();
  const shitennoDir = join(projectRoot, SHITENNO_DIR_NAME);
  let context = await generateContext(shitennoDir);

  if (!context) {
    output("No engineering state found. Run 'shugo init' first.");
    return;
  }

  if (options.forAgent) {
    context = filterContextForAgent(context, options.forAgent);
  }

  if (options.json) {
    // Use force:true to bypass global JSON mode gate
    output(JSON.stringify(context, null, 2), { force: true });
  } else {
    printContext(context);
  }
}

function printProjectHeader(context: ContextOutput): void {
  output("📋 Project Context");
  output("==================");
  output(`Project: ${context.project.name}`);
  output(`Stack: ${context.project.stack.join(", ")}`);
  output(`Root: ${context.project.root}`);
  outputBlank();
}

function printEngineeringState(es: ContextOutput["engineeringState"]): boolean {
  if (!es) {
    output(chalk.yellow("⚠️  Engineering state not available"));
    return false;
  }

  const hs = es.healthScores;
  const kv = (val: unknown, fallback = "N/A") => val ?? fallback;
  output("📊 Engineering State");
  output("====================");
  output(`Lifecycle: ${kv(es.lifecycle)}`);
  output(`Health: ${kv(hs?.overall)}/100`);
  output(`Knowledge Debt: ${kv(hs?.knowledgeDebt)}/100`);
  output(`Knowledge Graph: ${kv(hs?.knowledgeGraph)}/100`);
  output(`Entropy: ${kv(es.entropy?.score)}/100`);
  output(`Capabilities: ${kv(es.capabilities?.join(", "))}`);
  output(`Assets: ${es.assets?.length ?? 0}`);
  output(`Rules: ${kv(es.rules)}`);
  output(`Policies: ${kv(es.policies)}`);
  outputBlank();
  return true;
}

function printTrend(trend: ContextOutput["trend"]): void {
  if (!trend) return;
  output("📈 Trend");
  output("========");
  output(`Direction: ${trend.direction}`);
  output(`Confidence: ${(trend.confidence * 100).toFixed(0)}%`);
  outputBlank();
}

function printChallenges(challenges: ContextOutput["challenges"]): void {
  if (challenges.length === 0) return;
  output("⚠️  Challenges");
  output("==============");
  for (const challenge of challenges) {
    output(`  [${challenge.severity}] ${challenge.description}`);
  }
}

function printContext(context: ContextOutput): void {
  printProjectHeader(context);
  if (!printEngineeringState(context.engineeringState)) return;
  printTrend(context.trend);
  printChallenges(context.challenges);
}

// ── Agent Filtering ────────────────────────────────────────────────────────

function filterContextForAgent(context: ContextOutput, agentName: string): ContextOutput {
  return {
    ...context,
    project: {
      ...context.project,
      name: `${context.project.name} (agent: ${agentName})`,
    },
  };
}

// ── CLI Command ────────────────────────────────────────────────────────────

export const contextCommand = new Command("context")
  .description("Show project context for AI agents")
  .option("--json", "Output as JSON")
  .option("--for-agent <name>", "Filter context for a specific agent")
  .action(async (options) => {
    await executeContextCommand(options);
  });
