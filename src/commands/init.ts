/**
 * init.ts — Maturity-based Discovery & Installation
 *
 * Substitui a instalação fixa L1/L2/L3 por:
 * 1. Questionário de descoberta (múltiplas categorias)
 * 2. Cálculo de perfil de maturidade (7 dimensões)
 * 3. Recomendação de capacidades
 * 4. Instalação por capacidades modulares
 */

import { Command } from "commander";
import { resolve } from "node:path";
import chalk from "chalk";
import { banner } from "../formatting.js";
import { output, outputBlank } from "../output.js";

import { handleDryRun } from "./init/display.js";
import { shouldBlockInit, handleAlreadyInitialized, analyseAndDisplay, getAnswers, calculateAndDisplayProfile } from "./init/prompts.js";
import { runScaffolding } from "./init/orchestration.js";

export { isStarterProject, shouldBlockInit } from "./init/prompts.js";

// ── Command ────────────────────────────────────────────────────────────────

export const initCommand = new Command("init")
  .description("Initialize Shitenno ecosystem with maturity-based discovery")
  .option("-d, --dir <path>", "Project root directory (default: current)")
  .option("--answers-file <path>", "JSON file with pre-defined answers (skips interactive prompts)")
  .option("--force", "Force creation inside shitenno-cli (not recommended)")
  .option("--dry-run", "Show what would be created without writing files")
  .action(async (options) => {
    const isDryRun = options.dryRun === true;
    outputBlank();
    banner("shugo init", isDryRun ? "Dry Run — No files will be written" : "Maturity-Based Discovery");
    outputBlank();

    const targetDir = options.dir ? resolve(options.dir) : resolve(process.cwd());

    if (shouldBlockInit(targetDir, options.force === true)) {
      output(chalk.yellow("  ⚠ shitenno should be created in your project, not inside shitenno-cli."));
      output(chalk.gray("  Run from your project root: shugo init"));
      output(chalk.gray("  Or:  shugo init --force (to create inside shitenno-cli)"));
      outputBlank();
      return;
    }

    if (await handleAlreadyInitialized(targetDir)) return;

    const analysis = analyseAndDisplay(targetDir);
    const answers = await getAnswers(options, analysis);
    if (!answers) return;

    const { profile } = calculateAndDisplayProfile(targetDir, answers, analysis);

    if (isDryRun) {
      handleDryRun(profile);
      return;
    }

    await runScaffolding(targetDir, analysis, profile, answers);
  });
