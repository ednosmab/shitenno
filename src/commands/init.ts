/**
 * init.ts — Maturity-based Discovery & Installation
 *
 * Substitui a instalação fixa L1/L2/L3 por:
 * 1. Questionário de descoberta (múltiplas categorias)
 * 2. Cálculo de perfil de maturidade (7 dimensões)
 * 3. Recomendação de capacidades
 * 4. Instalação por capacidades modulares
 *
 * Fluxo (Phase 0 gate):
 * - Pergunta se o projeto é novo ou já existente (antes de qualquer escrita).
 * - Novo → scaffolding padrão direto (sem scanner).
 * - Existente → análise read-only + consentimento + worktree isolado.
 */

import { Command } from "commander";
import { resolve } from "node:path";
import chalk from "chalk";
import { banner } from "../shared/formatting.js";
import { output, outputBlank } from "../shared/output.js";

import { handleDryRun } from "./init/display.js";
import { shouldBlockInit, handleAlreadyInitialized, analyseAndDisplay, getAnswers, calculateAndDisplayProfile } from "./init/prompts.js";
import { runScaffolding } from "./init/orchestration.js";
import { ensureGitRepositoryPrerequisite, resolveProjectType } from "./init/project-type.js";
import { runExistingInstallFlow } from "./init/install-flow.js";
import { runUpgradeFlow } from "./init/upgrade.js";
import { runUndo } from "./init/restore.js";

export { isStarterProject, shouldBlockInit } from "./init/prompts.js";

// ── Command ────────────────────────────────────────────────────────────────

export const initCommand = new Command("init")
  .description("Initialize Shitenno ecosystem with maturity-based discovery")
  .option("-d, --dir <path>", "Project root directory (default: current)")
  .option("--answers-file <path>", "JSON file with pre-defined answers (skips interactive prompts)")
  .option("--project-type <type>", 'Project type gate: "new" or "existing" (skips the interactive question)')
  .option("--consent-level <level>", 'Consent level for existing projects: "1" (observation) or "2" (full integration)')
  .option("--undo", "Restore the pre-init state (Level 2): restore backups and remove init-created files")
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

    // ── Phase 6: undo — restores the pre-init state before anything else ──
    if (options.undo === true) {
      if (runUndo(targetDir)) {
        output(chalk.green("  ✓ Pre-init state restored (Level 2 backup applied)."));
      } else {
        output(chalk.yellow("  ⚠ No Level 2 backup found — nothing to undo."));
      }
      outputBlank();
      return;
    }

    // ── Phase 7: upgrade Level 1 → Level 2 when already initialized ──────
    const upgradeOutcome = await runUpgradeFlow(targetDir, options);
    if (upgradeOutcome === "upgraded" || upgradeOutcome === "already-level-2") return;

    if (await handleAlreadyInitialized(targetDir)) return;

    // ── Phase 0: gate (git prerequisite + new vs existing) ─────────────────
    const gitPrerequisite = await ensureGitRepositoryPrerequisite(targetDir, options);
    if (!gitPrerequisite.ok) {
      output(chalk.red(`  ✘ ${gitPrerequisite.error}`));
      outputBlank();
      process.exitCode = 1;
      return;
    }

    const resolution = await resolveProjectType(targetDir, options);
    if (!resolution) return;

    if (resolution.type === "existing") {
      await runExistingInstallFlow(targetDir, options);
      return;
    }

    // New project — no scanner, standard scaffolding in place
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