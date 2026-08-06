/**
 * dashboard.ts — shugo dashboard command
 *
 * Launches the interactive terminal dashboard.
 * Supports --json for machine-readable output,
 * --live for auto-refresh, and screen reader mode.
 */

import { Command } from "commander";
import chalk from "chalk";
import { guardNotInitialized, checkLifecycleGate } from "../shared/shared.js";
import { outputJson, healthBar as sharedHealthBar } from "../shared/formatting.js";
import { collectConsoleData } from "../console/data-collector.js";

export function dashboardCommand(): Command {
  const cmd = new Command("dashboard")
    .description("Interactive engineering dashboard with tabs, mouse, and accessibility")
    .option("-d, --dir <path>", "Project directory")
    .option("--json", "Output as JSON instead of TUI")
    .option("--live <seconds>", "Auto-refresh interval in seconds (0 = no refresh)", "0")
    .option("--screen-reader", "Enable screen reader mode (accessible output)")
    .action(async function (this: Command, options: Record<string, unknown>) {
      const isJson = options.json === true;
      const refreshSeconds = parseInt(String(options.live || "0"), 10);
      const refreshInterval = refreshSeconds * 1000;
      const isScreenReader = options.screenReader === true;

      if (!isJson) {
        console.log("");
        console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
        console.log(chalk.bold.cyan("  ║       Engineering Dashboard          ║"));
        console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
        console.log("");
      }

      const ctx = guardNotInitialized(options, isJson);
      if (!ctx) return;

      if (!checkLifecycleGate("dashboard", ctx.projectRoot, ctx.shitennoDir, isJson)) {
        return;
      }

      // JSON mode — output data and exit
      if (isJson) {
        const data = await collectConsoleData(ctx.projectRoot, ctx.shitennoDir);
        outputJson(data as unknown as Record<string, unknown>);
        return;
      }

      // TUI mode — render interactive dashboard
      try {
        // Dynamic import to avoid loading React/Ink when using --json
        const { render } = await import("ink");
        const { ShitennoConsole } = await import("../console/index.js");

        const { waitUntilExit } = render(
          <ShitennoConsole
            projectRoot={ctx.projectRoot}
            shitennoDir={ctx.shitennoDir}
            refreshInterval={refreshInterval}
            isScreenReaderEnabled={isScreenReader}
          />
        );

        await waitUntilExit();
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(chalk.red(`  ✘ Failed to launch dashboard: ${msg}`));
        console.log(chalk.gray("  Falling back to static output..."));
        console.log("");

        // Fallback: static output
        const data = await collectConsoleData(ctx.projectRoot, ctx.shitennoDir);
        displayStaticDashboard(data);
      }
    });

  return cmd;
}

// ── Static Fallback ────────────────────────────────────────────────────────

function displayStaticDashboard(data: import("../console/data-collector.js").ConsoleData): void {
  const { health, maturity, lifecycle, capabilities, stats, graph } = data;

  console.log(chalk.bold.cyan("  ┌─ Health Score ─────────────────────────────────┐"));
  console.log(`  │ Overall:   ${sharedHealthBar(health.overall, 100, 15, false)}  ${health.overall}/100  │`);
  console.log(`  │ Debt:      ${sharedHealthBar(health.knowledgeDebt, 100, 15, false)}  ${health.knowledgeDebt}/100  │`);
  console.log(`  │ Graph:     ${sharedHealthBar(health.knowledgeGraph, 100, 15, false)}  ${health.knowledgeGraph}/100  │`);
  console.log(`  │ Entropy:   ${sharedHealthBar(health.entropy, 100, 15, false)}  ${health.entropy}/100  │`);
  console.log(chalk.bold.cyan("  └────────────────────────────────────────────────┘"));
  console.log("");

  console.log(chalk.bold.cyan("  ┌─ Maturity ─────────────────────────────────────┐"));
  console.log(`  │ Overall: ${maturity?.overallScore ?? "N/A"}/100                                  │`);
  console.log(`  │ Lifecycle: ${lifecycle.padEnd(38)}│`);
  console.log(chalk.bold.cyan("  └────────────────────────────────────────────────┘"));
  console.log("");

  console.log(chalk.bold.cyan("  ┌─ Capabilities ─────────────────────────────────┐"));
  for (const cap of capabilities) {
    console.log(`  │ ✔ ${cap.padEnd(46)}│`);
  }
  console.log(chalk.bold.cyan("  └────────────────────────────────────────────────┘"));
  console.log("");

  console.log(chalk.bold.cyan("  ┌─ Knowledge Graph ──────────────────────────────┐"));
  console.log(`  │ Nodes: ${graph.totalArtifacts}  │  Relations: ${graph.totalRelations}  │  Health: ${graph.healthScore}/100  │`);
  console.log(`  │ Orphans: ${graph.orphanArtifacts.length}  │  Hubs: ${graph.hubArtifacts.length}  │  Cycles: ${graph.cycles.length}      │`);
  console.log(chalk.bold.cyan("  └────────────────────────────────────────────────┘"));
  console.log("");

  console.log(chalk.bold.cyan("  ┌─ Quick Stats ──────────────────────────────────┐"));
  console.log(`  │ Assets: ${stats.totalAssets}  │  Rules: ${stats.totalRules}  │  Skills: ${stats.totalSkills}  │`);
  console.log(`  │ ADRs: ${stats.totalAdrs}  │  Goals: ${stats.totalGoals}  │  Decisions: ${stats.totalDecisions} │`);
  console.log(chalk.bold.cyan("  └────────────────────────────────────────────────┘"));
}


