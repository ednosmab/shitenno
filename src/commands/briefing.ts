/**
 * briefing.ts — Context Pipeline: CLI Command
 *
 * The `shugo briefing` command. Orchestrates the full pipeline:
 * Collect → Cache → Generate → Output → Feedback
 *
 * Usage:
 *   shugo briefing                  # Cached briefing (standard depth)
 *   shugo briefing basic            # Quick briefing (~200 tokens)
 *   shugo briefing full             # Full briefing (~1000 tokens)
 *   shugo briefing --json           # JSON output
 *   shugo briefing --write          # Write shitenno/BRIEFING.md
 *   shugo briefing --diff           # Show diff since last briefing
 *   shugo briefing --invalidate     # Force cache invalidation
 *   shugo briefing --summary        # One-line summary
 */

import { Command } from "commander";
import ora from "ora";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { type BriefingDepth } from "../token-optimizer.js";
import { outputJson } from "../formatting.js";
import { output, outputSection } from "../output.js";
import { logger } from "../logger.js";
import { getEventBus } from "../event-bus.js";

import { displayFullBriefing } from "./briefing/display.js";
import { promptForChallenges } from "./briefing/challenges.js";
import { collectBriefingData, cacheBriefing, determineBriefingDepth, handleDiffMode, handleSummaryMode } from "./briefing/collectors.js";

// ── Types ───────────────────────────────────────────────────────────────────

interface BriefingOptions {
  dir?: string;
  json?: boolean;
  write?: boolean;
  diff?: boolean;
  compact?: boolean;
  invalidate?: boolean;
  summary?: boolean;
  profile?: string;
  noInteractive?: boolean;
}

// ── Main Runner ─────────────────────────────────────────────────────────────

async function runBriefing(options: BriefingOptions, forcedDepth?: BriefingDepth): Promise<void> {
  const isJson = options.json === true;
  if (!isJson) { output(""); outputSection("shugo briefing — Context Pipeline"); output(""); }
  const ctx = guardNotInitialized(options, isJson);
  if (!ctx) return;
  if (!checkLifecycleGate("briefing", ctx.projectRoot, ctx.shitennoDir, isJson)) return;
  const spinner = ora({ spinner: "dots" }).start(isJson ? "Generating" : "Collecting context...");
  try {
    const { briefing: initialBriefing, snapshot } = await collectBriefingData(ctx.projectRoot, ctx.shitennoDir);
    const { briefing, cacheHit, inputHash, previousBriefing } = cacheBriefing(ctx.shitennoDir, initialBriefing, snapshot, options.invalidate === true);
    if (options.invalidate) spinner.text = "Cache invalidated, using fresh briefing...";
    spinner.stop();
    if (options.diff) { handleDiffMode(briefing, previousBriefing, isJson); return; }
    if (options.summary) { handleSummaryMode(briefing, isJson, cacheHit); return; }
    const depth = determineBriefingDepth(briefing, forcedDepth, options.profile as string | undefined);
    displayFullBriefing({ briefing, isJson, cacheHit, inputHash, depth, projectRoot: ctx.projectRoot, write: options.write === true, noInteractive: options.noInteractive === true, shitennoDir: ctx.shitennoDir });
    await promptForChallenges(ctx.shitennoDir, options.noInteractive === true);
    getEventBus().publish("analysis.complete", { type: "briefing", cacheHit, risk: briefing.risks.overall, domain: briefing.project.domain });
  } catch (error) {
    spinner.fail("Failed to generate briefing");
    if (isJson) outputJson({ error: "briefing_failed", message: String(error) });
    else logger.error("briefing", `Error: ${error}`);
  }
}

// ── Command ────────────────────────────────────────────────────────────────

export function briefingCommand(): Command {
  const cmd = new Command("briefing")
    .description("Pre-session briefing for AI agents (Context Pipeline)")
    .option("-d, --dir <path>", "Project directory")
    .option("--json", "Output as JSON")
    .option("--write", "Write shitenno/BRIEFING.md")
    .option("--diff", "Show diff since last briefing")
    .option("--compact", "Use compact diff format (fewer tokens)")
    .option("--invalidate", "Force cache invalidation")
    .option("--summary", "One-line summary")
    .option("--no-interactive", "Disable interactive challenge prompt")
    .option("--profile <depth>", "Briefing depth: minimal, standard, full (default: auto)")
    .option("--watch [seconds]", "Regenerate briefing periodically (default: 30s)")
    .action((options: Record<string, unknown>) => {
      return runBriefing(options as BriefingOptions);
    });

  cmd
    .command("basic")
    .description("Quick briefing (~200 tokens): project, risk, 1 recommendation")
    .option("-d, --dir <path>", "Project directory")
    .option("--json", "Output as JSON")
    .option("--write", "Write shitenno/BRIEFING.md")
    .action((options: Record<string, unknown>) => {
      return runBriefing(options as BriefingOptions, "minimal");
    });

  cmd
    .command("full")
    .description("Full briefing (~1000 tokens): everything including recent activity")
    .option("-d, --dir <path>", "Project directory")
    .option("--json", "Output as JSON")
    .option("--write", "Write shitenno/BRIEFING.md")
    .option("--diff", "Show diff since last briefing")
    .option("--invalidate", "Force cache invalidation")
    .action((options: Record<string, unknown>) => {
      return runBriefing(options as BriefingOptions, "full");
    });

  return cmd;
}
