/**
 * shared.ts — Shared Infrastructure for CLI Commands
 *
 * Extracts duplicated patterns from commands into reusable functions.
 * Reduces ~280 lines of duplicated code across 10 commands.
 *
 * PRINCIPLE: DRY — Don't Repeat Yourself.
 */

import { existsSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { outputJson } from "./formatting.js";
import { SHITENNO_DIR_NAME } from "./constants.js";
import { output, outputBlank } from "./output.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProjectContext {
  projectRoot: string;
  shitennoDir: string;
  isInitialized: boolean;
  hasMaturityProfile: boolean;
}

// ── Project Context Resolution ───────────────────────────────────────────────

/** Resolve project context from CLI options. Replaces duplicated init guards. */
export function resolveProjectContext(options: { dir?: string }): ProjectContext {
  const projectRoot = options.dir || process.cwd();
  const shitennoDir = join(projectRoot, SHITENNO_DIR_NAME);

  const isInitialized = existsSync(shitennoDir);

  const hasMaturityProfile = existsSync(join(shitennoDir, "maturity-profile.json"));

  return { projectRoot, shitennoDir, isInitialized, hasMaturityProfile };
}

// ── Lifecycle Gate ─────────────────────────────────────────────────────────

import { detectLifecycleState, canRunCommand, type ShitennoLifecycleState } from "./shitenno-state-machine.js";
import { COMMAND_GATES } from "./constants.js";

/**
 * Check if a command is allowed to run in the current lifecycle state.
 * Outputs error and returns false if not allowed.
 */
export function checkLifecycleGate(
  command: string,
  projectRoot: string,
  shitennoDir: string,
  isJson: boolean
): boolean {
  const state = detectLifecycleState(projectRoot, shitennoDir);

  if (!canRunCommand(command, state)) {
    if (isJson) {
      outputJson({
        error: "lifecycle_gate",
        message: `Command '${command}' requires state '${getRequiredState(command)}' but current state is '${state}'.`,
        currentState: state,
        requiredState: getRequiredState(command),
      });
    } else {
      output(chalk.yellow(`  ⚠ Command '${command}' cannot run in '${state}' state.`));
      output(chalk.gray(`  Required state: ${getRequiredState(command)} or later.`));
      outputBlank();
    }
    return false;
  }

  return true;
}

function getRequiredState(command: string): ShitennoLifecycleState {
  return (COMMAND_GATES[command] || "discovered") as ShitennoLifecycleState;
}

// ── Report Writer ────────────────────────────────────────────────────────────

/** Write a report to shitenno/reports/. Returns filename or null. */
export function writeReport(
  shitennoDir: string,
  prefix: string,
  report: Record<string, unknown>
): string | null {
  const reportsDir = join(shitennoDir, "reports");
  if (!existsSync(reportsDir)) return null;

  const date = new Date().toISOString().split("T")[0];
  const existing = readdirSync(reportsDir).filter((f) =>
    f.startsWith(`${prefix}-${date}`)
  );
  const sessionNum = existing.length + 1;

  const filename = `${prefix}-${date}-session${sessionNum}.json`;
  const filepath = join(reportsDir, filename);

  writeFileSync(filepath, JSON.stringify(report, null, 2));
  return filename;
}

// ── Init Guard ──────────────────────────────────────────────────────────────

/**
 * Common initialization guard for all commands.
 * Resolves project context, checks if initialized, outputs error if not.
 * Returns context if initialized, or null if guard handled the error.
 */
export function guardNotInitialized(
  options: { dir?: string },
  isJson: boolean
): ProjectContext | null {
  const ctx = resolveProjectContext(options);

  if (!ctx.isInitialized) {
    if (isJson) {
      outputJson({ error: "not_initialized", message: "Run 'shugo init' to initialize governance." });
    } else {
      output(chalk.yellow("  ⚠ This project is not initialized with shugo."));
      output(chalk.gray("  Run 'shugo init' to initialize governance."));
      outputBlank();
    }
    return null;
  }

  // Validate shitennoDir exists
  if (!existsSync(ctx.shitennoDir)) {
    if (isJson) {
      outputJson({ error: "shitenno_dir_missing", message: "shitenno/ directory not found. Run 'shugo init' to recreate." });
    } else {
      output(chalk.yellow("  ⚠ shitenno/ directory not found."));
      output(chalk.gray("  Run 'shugo init' to recreate it."));
      outputBlank();
    }
    return null;
  }

  return ctx;
}

// ── Cache Wrapper ────────────────────────────────────────────────────────────

export interface WithCacheOptions {
  projectRoot: string;
  shitennoDir: string;
  key: string;
  compute: () => unknown | Promise<unknown>;
  force?: boolean;
}

export async function withCache<T>(
  opts: WithCacheOptions
): Promise<{ data: T; cacheHit: boolean }> {
  const { getCached, setCache, computeKeyChecksums } = await import("./cache.js");
  const { projectRoot, shitennoDir, key, compute, force } = opts;
  const cacheKey = key as "complexity" | "patterns" | "health";
  const checksums = () => computeKeyChecksums(projectRoot, shitennoDir);

  if (!force) {
    const cached = getCached({ projectRoot, key: cacheKey, computeChecksumsFn: checksums });
    if (cached) return { data: cached as T, cacheHit: true };
  }

  const data = await compute();
  setCache({ projectRoot, shitennoDir, key: cacheKey,
    data: data as Record<string, unknown>, checksums: checksums() });
  return { data: data as T, cacheHit: false };
}

// ── Interactive Guard ────────────────────────────────────────────────────────

/**
 * Guard against running interactive prompts in non-interactive environments.
 * Returns true if safe to proceed (interactive or answers-file provided).
 * Returns false if should abort (non-interactive without answers-file).
 */
export function guardInteractive(
  options: { answersFile?: string },
  isJson: boolean
): boolean {
  if (options.answersFile) return true;
  if (process.stdin.isTTY) return true;

  if (isJson) {
    outputJson({
      error: "non_interactive",
      message: "Non-interactive environment detected and no --answers-file provided.",
      hint: "Pass --answers-file <path> to run in non-interactive mode.",
    });
  } else {
    output(chalk.red("  ✘ Non-interactive environment detected and no --answers-file provided."));
    output(chalk.gray("    Pass --answers-file <path> to run non-interactively."));
    outputBlank();
  }
  process.exitCode = 1;
  return false;
}
