/**
 * bench.ts — Context Pipeline: Automated Benchmark
 *
 * Measures real-world performance of the Context Pipeline:
 * - Briefing generation time (fresh vs cached)
 * - Token savings estimate
 * - Comparison with manual discovery approach
 *
 * Usage:
 *   shugo bench                    # Full benchmark
 *   shugo bench --json             # JSON output
 *   shugo bench --iterations <n>   # Number of iterations (default: 5)
 *   shugo bench --compare          # Compare with previous benchmark
 */

import { Command } from "commander";
import chalk from "chalk";
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { collectContext, type ContextSnapshot } from "../context-collector.js";
import { computeInputHash, setCachedBriefing, readCache, invalidateBriefingCache } from "../briefing-cache.js";
import { outputJson } from "../formatting.js";
import { SHITENNO_DIR_NAME } from "../constants.js";
import { output, outputBlank, outputSection } from "../output.js";

// ── Benchmark Helpers ──────────────────────────────────────────────────────

/** Estimate tokens needed for manual discovery based on project size. */
function estimateManualTokens(projectRoot: string): number {
  let fileCount = 0;
  let totalSize = 0;

  function walkDir(dir: string) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== SHITENNO_DIR_NAME) {
          walkDir(fullPath);
        }
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".js") || entry.name.endsWith(".json")) {
        fileCount++;
        try {
          totalSize += readFileSync(fullPath, "utf-8").length;
        } catch { /* ignore */ }
      }
    }
  }

  walkDir(projectRoot);

  // Base: ~100 tokens per file + ~0.5 tokens per character of code
  const fileTokens = fileCount * 100;
  const charTokens = Math.round(totalSize / 4); // ~4 chars per token
  return Math.max(2000, fileTokens + charTokens);
}

/** Briefing markdown is typically proportional to project complexity. */
function estimateBriefingTokens(snapshot: ContextSnapshot): number {
  const baseTokens = 200;
  const ruleTokens = (snapshot.contextRules.length + snapshot.dynamicRules.length) * 30;
  const highRiskCount = snapshot.riskMap.areas.filter(a => a.riskLevel === "high" || a.riskLevel === "critical").length;
  const riskTokens = highRiskCount * 20;
  return baseTokens + ruleTokens + riskTokens;
}

// ── Benchmark Runner ───────────────────────────────────────────────────────

interface BenchmarkResult {
  briefingFresh: { timeMs: number; tokens: number };
  briefingCached: { timeMs: number; tokens: number };
  manualDiscovery: { estimatedTokens: number };
  savings: { tokens: number; percent: number; timeMs: number };
  iterations: number;
}

function benchmarkCachedReads(shitennoDir: string, snapshot: ContextSnapshot | null, iterations: number): number {
  const cachedTimes: number[] = [];
  if (snapshot) {
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      readCache(shitennoDir);
      cachedTimes.push(performance.now() - start);
    }
  }
  return cachedTimes.length > 0 ? cachedTimes.reduce((a, b) => a + b, 0) / cachedTimes.length : 0;
}

function runBenchmark(projectRoot: string, shitennoDir: string, iterations: number): BenchmarkResult {
  collectContext(projectRoot, shitennoDir);
  const freshTimes: number[] = [];
  let lastSnapshot: ContextSnapshot | undefined;
  for (let i = 0; i < iterations; i++) {
    invalidateBriefingCache(shitennoDir);
    const start = performance.now();
    const snap = collectContext(projectRoot, shitennoDir);
    freshTimes.push(performance.now() - start);
    lastSnapshot = snap;
  }
  const avgFreshTime = freshTimes.reduce((a, b) => a + b, 0) / freshTimes.length;
  const snapshot = lastSnapshot ?? null;
  if (snapshot) {
    const hash = computeInputHash({ fingerprintHash: snapshot.fingerprint.hash, riskMapHash: snapshot.riskMap.generatedAt, contextRuleCount: snapshot.contextRules.length, dynamicRuleCount: snapshot.dynamicRules.length, maturityScore: snapshot.maturityProfile?.overallScore ?? null });
    setCachedBriefing(shitennoDir, snapshot.briefing, hash);
  }
  const avgCachedTime = benchmarkCachedReads(shitennoDir, snapshot, iterations);
  const manualTokens = estimateManualTokens(projectRoot);
  const briefingTokens = snapshot ? estimateBriefingTokens(snapshot) : 500;
  const tokensSaved = manualTokens - briefingTokens;
  const percentSaved = Math.round((tokensSaved / manualTokens) * 100);
  const timeSaved = avgFreshTime;

  return {
    briefingFresh: { timeMs: Math.round(avgFreshTime * 100) / 100, tokens: briefingTokens },
    briefingCached: { timeMs: Math.round(avgCachedTime * 100) / 100, tokens: 0 },
    manualDiscovery: { estimatedTokens: manualTokens },
    savings: { tokens: tokensSaved, percent: percentSaved, timeMs: Math.round(timeSaved * 100) / 100 },
    iterations,
  };
}

// ── Benchmark History ──────────────────────────────────────────────────────

interface BenchmarkHistory {
  timestamp: string;
  result: BenchmarkResult;
}

function getBenchHistoryPath(shitennoDir: string): string {
  return join(shitennoDir, "reports", "bench-history.json");
}

function loadBenchHistory(shitennoDir: string): BenchmarkHistory[] {
  const path = getBenchHistoryPath(shitennoDir);
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return [];
  }
}

function saveBenchResult(shitennoDir: string, result: BenchmarkResult): void {
  const history = loadBenchHistory(shitennoDir);
  history.push({ timestamp: new Date().toISOString(), result });

  // Keep last 20 results
  const trimmed = history.slice(-20);
  const dir = join(shitennoDir, "reports");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(getBenchHistoryPath(shitennoDir), JSON.stringify(trimmed, null, 2));
}

function displayComparison(current: BenchmarkResult, previous: BenchmarkResult): void {
  outputBlank();
  outputSection("shugo bench — Comparison");
  outputBlank();

  const timeDiff = current.briefingFresh.timeMs - previous.briefingFresh.timeMs;
  const timeImproved = timeDiff < 0;
  const timeIcon = timeImproved ? "📈" : "📉";
  const timeColor = timeImproved ? chalk.green : chalk.red;
  const timeSign = timeImproved ? "" : "+";

  outputSection("⏱ Performance vs Previous");
  output(`     Previous:  ${chalk.gray(`${previous.briefingFresh.timeMs}ms`)}`);
  output(`     Current:   ${chalk.cyan(`${current.briefingFresh.timeMs}ms`)}`);
  output(`     ${timeIcon} Delta:    ${timeColor(`${timeSign}${timeDiff.toFixed(2)}ms`)}`);
  outputBlank();

  const tokenDiff = current.savings.tokens - previous.savings.tokens;
  const tokensImproved = tokenDiff > 0;
  const tokenIcon = tokensImproved ? "📈" : "📉";
  const tokenColor = tokensImproved ? chalk.green : chalk.red;
  const tokenSign = tokensImproved ? "+" : "";

  outputSection("💰 Token Savings vs Previous");
  output(`     Previous:  ${chalk.gray(`~${previous.savings.tokens.toLocaleString()} tokens (${previous.savings.percent}%)`)}`);
  output(`     Current:   ${chalk.cyan(`~${current.savings.tokens.toLocaleString()} tokens (${current.savings.percent}%)`)}`);
  output(`     ${tokenIcon} Delta:    ${tokenColor(`${tokenSign}${tokenDiff.toLocaleString()} tokens`)}`);
  outputBlank();
}

// ── Display ────────────────────────────────────────────────────────────────

function displayBenchmark(result: BenchmarkResult): void {
  outputBlank();
  outputSection("shugo bench — Token Benchmark");
  outputBlank();

  outputSection("⏱ Performance");
  output(`     Fresh briefing:   ${chalk.cyan(`${result.briefingFresh.timeMs}ms`)} (avg of ${result.iterations} runs)`);
  output(`     Cached briefing:  ${chalk.green(`${result.briefingCached.timeMs}ms`)} (cache hit)`);
  outputBlank();

  outputSection("💰 Token Comparison");
  output(`     Manual discovery: ${chalk.red(`~${result.manualDiscovery.estimatedTokens.toLocaleString()} tokens`)}`);
  output(`     With briefing:    ${chalk.green(`~${result.briefingFresh.tokens.toLocaleString()} tokens`)}`);
  output(`     With cache:       ${chalk.green("~0 tokens")}`);
  outputBlank();

  outputSection("📊 Savings");
  output(chalk.green(`     Tokens saved:     ~${result.savings.tokens.toLocaleString()} tokens (${result.savings.percent}%)`));
  output(chalk.green(`     Per session:      ~${result.savings.timeMs}ms faster`));

  const monthlyTokens = result.savings.tokens * 10;
  const monthlyCost = (monthlyTokens / 1_000_000) * 5;
  outputBlank();
  outputSection("📈 Monthly Projection (10 sessions)");
  output(chalk.green(`     Tokens saved:     ~${monthlyTokens.toLocaleString()}`));
  output(chalk.green(`     Cost saved:       ~$${monthlyCost.toFixed(2)}/month`));
  outputBlank();
}

// ── Command ────────────────────────────────────────────────────────────────

export function benchCommand(): Command {
  const cmd = new Command("bench")
    .description("Benchmark token economy and Context Pipeline performance")
    .option("-d, --dir <path>", "Project directory")
    .option("--json", "Output as JSON")
    .option("--iterations <n>", "Number of benchmark iterations", "5")
    .option("--compare", "Compare with previous benchmark result")
    .action(async function (this: Command, options: Record<string, unknown>) {
      const isJson = options.json === true;
      const iterations = parseInt(String(options.iterations || "5"), 10);

      if (!isJson) {
        output("");
        outputSection("shugo bench — Token Benchmark");
        outputBlank();
      }

      const ctx = guardNotInitialized(options, isJson);
      if (!ctx) return;

      if (!checkLifecycleGate("bench", ctx.projectRoot, ctx.shitennoDir, isJson)) {
        return;
      }

      // Load previous result for comparison
      let previousResult: BenchmarkResult | null = null;
      if (options.compare) {
        const history = loadBenchHistory(ctx.shitennoDir);
        if (history.length > 0) {
          previousResult = history.at(-1)!.result;
        }
      }

      const result = runBenchmark(ctx.projectRoot, ctx.shitennoDir, iterations);

      // Save result
      saveBenchResult(ctx.shitennoDir, result);

      if (isJson) {
        outputJson({
          ...(result as unknown as Record<string, unknown>),
          previous: previousResult,
        });
        return;
      }

      displayBenchmark(result);

      if (previousResult) {
        displayComparison(result, previousResult);
      }
    });

  return cmd;
}
