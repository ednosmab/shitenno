/**
 * profile.ts — User Profile Management
 *
 * The `shugo profile` command. Allows users to view, set, and update
 * their profile for personalized feedback.
 *
 * Usage:
 *   shugo profile                    # Show current profile
 *   shugo profile --set              # Interactive setup
 *   shugo profile --name "Edson"     # Set name
 *   shugo profile --role "Tech Lead em Formação"  # Set role
 *   shugo profile --architecture senior  # Set architecture level
 *   shugo profile --coding pleno     # Set coding level
 *   shugo profile --leadership senior # Set leadership level
 *   shugo profile --tone mentor      # Set feedback tone
 *   shugo profile --language pt      # Set language
 *   shugo profile --code-free 95     # Set code-free percentage
 *   shugo profile --focus "visão,leadership"  # Set focus areas
 */

import { Command } from "commander";
import chalk from "chalk";

import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { outputJson } from "../formatting.js";
import {
  loadUserProfile,
  saveUserProfile,
  type UserProfile,
  type SkillLevel,
  type FeedbackTone,
} from "../feedback-engine.js";
import { getEventBus } from "../event-bus.js";
import { output, outputBlank, outputSection, outputSuccess, outputError } from "../output.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function displayProfile(profile: UserProfile): void {
  outputBlank();
  outputSection("shugo profile — User Profile");
  outputBlank();
  outputSection("📋 Perfil Actual");
  output(`     Nome:          ${chalk.cyan(profile.name)}`);
  output(`     Cargo:         ${chalk.cyan(profile.role)}`);
  output(`     Arquitectura:  ${chalk.cyan(profile.architecture)}`);
  output(`     Código:        ${chalk.cyan(profile.coding)}`);
  output(`     Leadership:    ${chalk.cyan(profile.leadership)}`);
  output(`     Tom:           ${chalk.cyan(profile.tone)}`);
  output(`     Idioma:        ${chalk.cyan(profile.language)}`);
  output(`     % No-code:     ${chalk.cyan(String(profile.codeFreePercent))}%`);
  output(`     Áreas foco:    ${chalk.cyan(profile.focusAreas.join(", ") || "nenhuma")}`);
  outputBlank();
  displayCalibration(profile);
}

function displayCalibration(profile: UserProfile): void {
  const toneLabel = profile.tone === "mentor" ? "Mentor (suportivo, didático)"
    : profile.tone === "peer" ? "Peer (direto, entre pares)"
    : "Relatório (técnico, impessoal)";
  outputSection("🎯 Calibragem de Feedback");
  output(`     Tom:           ${toneLabel}`);
  output(`     No-code:       ${profile.codeFreePercent >= 80 ? "Forte (foco em visão/leadership)" : profile.codeFreePercent >= 50 ? "Moderado" : "Técnico (foco em código)"}`);
  outputBlank();
  output(chalk.gray("  Para alterar: shugo profile --name 'Novo Nome'"));
  output(chalk.gray("  Para configurar interactivamente: shugo profile --set"));
  outputBlank();
}

function outputProfile(isJson: boolean, profile: UserProfile): void {
  if (isJson) {
    outputJson({ type: "profile", ...profile });
  } else {
    displayProfile(profile);
  }
}

function validateAndAssign(profile: UserProfile, { key, value, valid, errorKey, errorMsg, isJson }: { key: keyof UserProfile; value: string; valid: string[]; errorKey: string; errorMsg: string; isJson: boolean }): boolean {
  if (!valid.includes(value)) {
    if (isJson) {
      outputJson({ error: errorKey, message: errorMsg });
    } else {
      outputError(`  ✘ ${errorMsg}`);
    }
    return false;
  }
  (profile as unknown as Record<string, unknown>)[key] = value;
  return true;
}

async function runInteractiveSetup(profile: UserProfile): Promise<boolean> {
  output("");
  outputSection("shugo profile — Setup Interactivo");
  outputBlank();
  output(chalk.gray("  Pressiona Enter para manter o valor actual."));
  outputBlank();

  const readline = await import("node:readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string, current: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(`  ${question} (${chalk.gray(current)}): `, (answer) => {
        resolve(answer.trim() || current);
      });
    });
  };

  profile.name = await ask("Nome", profile.name);
  profile.role = await ask("Cargo", profile.role);
  profile.architecture = await ask("Arquitectura (junior/pleno/senior)", profile.architecture) as SkillLevel;
  profile.coding = await ask("Código (junior/pleno/senior)", profile.coding) as SkillLevel;
  profile.leadership = await ask("Leadership (junior/pleno/senior)", profile.leadership) as SkillLevel;
  profile.tone = await ask("Tom (mentor/peer/relatorio)", profile.tone) as FeedbackTone;
  profile.language = await ask("Idioma (pt/en)", profile.language) as "pt" | "en";
  profile.codeFreePercent = parseInt(await ask("% No-code (0-100)", String(profile.codeFreePercent)), 10);
  profile.focusAreas = (await ask("Áreas foco (vírgula-separado)", profile.focusAreas.join(", ")))
    .split(",")
    .map((a: string) => a.trim())
    .filter(Boolean);

  rl.close();
  return true;
}

// ── Command ────────────────────────────────────────────────────────────────

function applySkillLevel(profile: UserProfile, options: Record<string, unknown>, key: "architecture" | "coding" | "leadership", isJson: boolean): boolean | null {
  const raw = options[key];
  if (raw === undefined) return null;
  const val = String(raw) as SkillLevel;
  return validateAndAssign(profile, { key, value: val, valid: ["junior", "pleno", "senior"], errorKey: "invalid_level", errorMsg: "Level must be junior, pleno, or senior", isJson });
}

function applyTone(profile: UserProfile, options: Record<string, unknown>, isJson: boolean): boolean | null {
  const raw = options.tone;
  if (raw === undefined) return null;
  const val = String(raw) as FeedbackTone;
  return validateAndAssign(profile, { key: "tone", value: val, valid: ["mentor", "peer", "relatorio"], errorKey: "invalid_tone", errorMsg: "Tone must be mentor, peer, or relatorio", isJson });
}

function applyLanguage(profile: UserProfile, options: Record<string, unknown>, isJson: boolean): boolean | null {
  const raw = options.language;
  if (raw === undefined) return null;
  const val = String(raw) as "pt" | "en";
  return validateAndAssign(profile, { key: "language", value: val, valid: ["pt", "en"], errorKey: "invalid_language", errorMsg: "Language must be pt or en", isJson });
}

function applyCodeFree(profile: UserProfile, options: Record<string, unknown>, isJson: boolean): boolean | null {
  const raw = options["code-free"];
  if (raw === undefined) return null;
  const val = parseInt(String(raw), 10);
  if (isNaN(val) || val < 0 || val > 100) {
    if (isJson) {
      outputJson({ error: "invalid_percent", message: "Code-free must be 0-100" });
    } else {
      outputError("  ✘ Code-free must be 0-100");
    }
    return false;
  }
  profile.codeFreePercent = val;
  return true;
}

function applyFocus(profile: UserProfile, options: Record<string, unknown>): boolean | null {
  const raw = options.focus;
  if (raw === undefined) return null;
  profile.focusAreas = String(raw)
    .split(",")
    .map((a: string) => a.trim())
    .filter(Boolean);
  return true;
}

function applyAllFlags(profile: UserProfile, options: Record<string, unknown>, isJson: boolean): { applied: boolean; error: boolean } {
  let applied = false;

  if (options.name !== undefined) { profile.name = String(options.name); applied = true; }
  if (options.role !== undefined) { profile.role = String(options.role); applied = true; }

  for (const key of ["architecture", "coding", "leadership"] as const) {
    const result = applySkillLevel(profile, options, key, isJson);
    if (result === false) return { applied: false, error: true };
    if (result === true) applied = true;
  }

  const tone = applyTone(profile, options, isJson);
  if (tone === false) return { applied: false, error: true };
  if (tone === true) applied = true;

  const lang = applyLanguage(profile, options, isJson);
  if (lang === false) return { applied: false, error: true };
  if (lang === true) applied = true;

  const cf = applyCodeFree(profile, options, isJson);
  if (cf === false) return { applied: false, error: true };
  if (cf === true) applied = true;

  const focus = applyFocus(profile, options);
  if (focus === true) applied = true;

  return { applied, error: false };
}

async function profileAction(this: Command, options: Record<string, unknown>): Promise<void> {
  const isJson = options.json === true;

  const ctx = guardNotInitialized(options, isJson);
  if (!ctx) return;

  if (!checkLifecycleGate("profile", ctx.projectRoot, ctx.shitennoDir, isJson)) return;

  const profile = loadUserProfile(ctx.shitennoDir);
  let updated = false;

  if (options.set) {
    if (isJson) {
      outputJson({
        error: "interactive_not_supported",
        message: "Interactive setup not supported with --json. Use individual flags.",
      });
      return;
    }
    await runInteractiveSetup(profile);
    updated = true;
  }

  const flags = applyAllFlags(profile, options, isJson);
  if (flags.error) return;
  if (flags.applied) updated = true;

  if (updated) {
    saveUserProfile(ctx.shitennoDir, profile);
    if (isJson) {
      outputJson({ type: "profile_updated", ...profile });
    } else {
      outputSuccess("  ✔ Perfil actualizado com sucesso.");
      displayProfile(profile);
    }
    getEventBus().publish("analysis.complete", {
      type: "profile_updated",
      profile: { name: profile.name, role: profile.role },
    });
    return;
  }

  outputProfile(isJson, profile);
}

export function profileCommand(): Command {
  const cmd = new Command("profile")
    .description("View and update your user profile for personalized feedback")
    .option("-d, --dir <path>", "Project directory")
    .option("--set", "Interactive profile setup")
    .option("--name <name>", "Set user name")
    .option("--role <role>", "Set role description")
    .option("--architecture <level>", "Set architecture skill level (junior/pleno/senior)")
    .option("--coding <level>", "Set coding skill level (junior/pleno/senior)")
    .option("--leadership <level>", "Set leadership skill level (junior/pleno/senior)")
    .option("--tone <tone>", "Set feedback tone (mentor/peer/relatorio)")
    .option("--language <lang>", "Set language (pt/en)")
    .option("--code-free <percent>", "Set code-free percentage (0-100)")
    .option("--focus <areas>", "Set focus areas (comma-separated)")
    .option("--json", "Output as JSON")
    .action(profileAction);

  return cmd;
}
