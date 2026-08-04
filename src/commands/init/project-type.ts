/**
 * commands/init/project-type.ts — Phase 0 gate: new vs existing project
 *
 * The `shugo init` flow first asks whether the project is new or already
 * exists. A "new" project skips the read-only assessment (Phase 1) and goes
 * straight to the standard scaffold. An "existing" project must pass the
 * assessment before anything is written.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import inquirer from "inquirer";
import chalk from "chalk";
import { analyseProject, type ProjectAnalysis } from "../../analyser.js";
import { guardInteractive } from "../../shared.js";
import { output, outputBlank } from "../../output.js";
import { isGitRepository, initGitRepository } from "./git.js";

export type ProjectType = "new" | "existing";

export const NEW_PROJECT_MAX_COMMITS = 3;
export const NEW_PROJECT_MAX_SOURCE_FILES = 20;

/**
 * Whether the project signals "new" (few commits, few source files).
 * A fresh third-party scaffold usually has a couple of commits and few files.
 */
export function looksLikeNewProject(analysis: ProjectAnalysis): boolean {
  return (
    analysis.totalCommits <= NEW_PROJECT_MAX_COMMITS &&
    analysis.sourceFileCount < NEW_PROJECT_MAX_SOURCE_FILES
  );
}

/**
 * Whether the project shows existing-code signals worth confirming.
 */
export function requiresNewProjectConfirmation(analysis: ProjectAnalysis): boolean {
  return !looksLikeNewProject(analysis);
}

export interface ProjectTypeGuard {
  proceed: boolean;
  warning: boolean;
}

/**
 * Evaluate a declared project type against the detected signals.
 * A "new" declaration on existing-looking code must be reconfirmed.
 */
export function evaluateNewProjectDeclaration(
  declared: ProjectType,
  analysis: ProjectAnalysis,
): ProjectTypeGuard {
  if (declared !== "new") return { proceed: true, warning: false };
  const warning = requiresNewProjectConfirmation(analysis);
  return { proceed: !warning, warning };
}

export interface ProjectTypeOptions {
  projectType?: string;
  answersFile?: string;
  consentLevel?: string;
}

export interface DeclaredProjectType {
  type: ProjectType | null;
  error: string | null;
}

const PROJECT_TYPE_VALUES: readonly string[] = ["new", "existing"];

function isProjectType(value: unknown): value is ProjectType {
  return typeof value === "string" && PROJECT_TYPE_VALUES.includes(value);
}

/**
 * Read a declared project type from the --project-type flag or the
 * `projectType` key in the answers file (for non-interactive runs).
 * The flag takes precedence over the answers file.
 */
export async function readDeclaredProjectType(
  options: ProjectTypeOptions,
): Promise<DeclaredProjectType> {
  if (options.projectType) {
    if (!isProjectType(options.projectType)) {
      return {
        type: null,
        error: `Invalid --project-type "${options.projectType}". Use "new" or "existing".`,
      };
    }
    return { type: options.projectType, error: null };
  }

  if (options.answersFile) {
    const answersPath = resolve(options.answersFile);
    if (!existsSync(answersPath)) {
      return { type: null, error: `Answers file not found: ${options.answersFile}` };
    }
    try {
      const raw = JSON.parse(readFileSync(answersPath, "utf-8")) as { projectType?: unknown };
      if (raw.projectType === undefined) return { type: null, error: null };
      if (!isProjectType(raw.projectType)) {
        return {
          type: null,
          error: `Invalid projectType "${String(raw.projectType)}" in answers file. Use "new" or "existing".`,
        };
      }
      return { type: raw.projectType, error: null };
    } catch (err) {
      return {
        type: null,
        error: `Failed to read answers file: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return { type: null, error: null };
}

/**
 * Whether the init run is happening in an interactive terminal and has no
 * answers file (so interactive prompts may appear).
 */
export function isInteractiveInit(options: ProjectTypeOptions): boolean {
  return !options.answersFile && Boolean(process.stdin.isTTY);
}

/**
 * Interactive prompt: new vs existing project.
 */
export async function promptProjectType(): Promise<ProjectType | null> {
  const { projectType } = await inquirer.prompt<{ projectType: ProjectType }>([
    {
      type: "list",
      name: "projectType",
      message: "Is this a new project or an existing one?",
      choices: [
        { name: "New project — nothing to preserve yet (scaffold directly)", value: "new" },
        { name: "Existing project — analyze before touching anything", value: "existing" },
      ],
    },
  ]);
  return projectType;
}

/**
 * Interactive confirmation when the user declares "new" but the project shows
 * existing-code signals (git history or a meaningful amount of source files).
 */
export async function confirmNewProjectDespiteSignals(): Promise<boolean> {
  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: "confirm",
      name: "confirmed",
      message:
        "This project shows existing-code signals (commits or source files). Proceed as a new project?",
      default: false,
    },
  ]);
  return confirmed;
}

export interface GitPrerequisiteResult {
  ok: boolean;
  initialized: boolean;
  error: string | null;
}

/**
 * Git repository prerequisite for init.
 *
 * git worktree (Phase 3) guarantees installation isolation — there is no
 * isolation without a git repository, so init requires one. Interactive runs
 * are offered to run `git init`; non-interactive runs fail with a clear error.
 */
export async function ensureGitRepositoryPrerequisite(
  targetDir: string,
  options: ProjectTypeOptions,
): Promise<GitPrerequisiteResult> {
  if (await isGitRepository(targetDir)) return { ok: true, initialized: false, error: null };

  if (isInteractiveInit(options)) {
    const { initialize } = await inquirer.prompt<{ initialize: boolean }>([
      {
        type: "confirm",
        name: "initialize",
        message: "No git repository detected. Initialize one (git init)?",
        default: true,
      },
    ]);
    if (!initialize) {
      return {
        ok: false,
        initialized: false,
        error: "shugo init requires a git repository for safe installation (git worktree).",
      };
    }
    const done = await initGitRepository(targetDir);
    return done
      ? { ok: true, initialized: true, error: null }
      : { ok: false, initialized: false, error: "git init failed. Check permissions and git availability." };
  }

  return {
    ok: false,
    initialized: false,
    error: "shugo init requires a git repository. Run 'git init' first (interactive mode offers this automatically).",
  };
}

export interface ProjectTypeResolution {
  type: ProjectType;
  analysis: ProjectAnalysis;
}

/**
 * Phase 0 gate resolver.
 *
 * - Reads the declared type (flag/answers file) or asks interactively.
 * - Reconfirms "new" declarations that look like existing code.
 * - Returns null (aborting the run) when the type cannot be resolved or the
 *   user cancels.
 */
export async function resolveProjectType(
  targetDir: string,
  options: ProjectTypeOptions,
): Promise<ProjectTypeResolution | null> {
  const declared = await readDeclaredProjectType(options);
  if (declared.error) {
    output(chalk.red(`  ✘ ${declared.error}`));
    outputBlank();
    process.exitCode = 1;
    return null;
  }

  let type = declared.type;
  if (!type && options.answersFile) {
    output(chalk.red('  ✘ The answers file must define "projectType" ("new" or "existing") in non-interactive mode.'));
    outputBlank();
    process.exitCode = 1;
    return null;
  }
  if (!type) {
    if (!guardInteractive(options, false)) return null;
    type = await promptProjectType();
  }
  if (!type) return null;

  const analysis = analyseProject(targetDir);
  const guard = evaluateNewProjectDeclaration(type, analysis);

  if (guard.warning) {
    if (isInteractiveInit(options)) {
      const confirmed = await confirmNewProjectDespiteSignals();
      if (!confirmed) {
        const fallback = await promptProjectType();
        if (!fallback) return null;
        return { type: fallback, analysis: analyseProject(targetDir) };
      }
    } else {
      output(
        chalk.yellow(
          `  ⚠ Project shows existing-code signals (${analysis.totalCommits} commits, ${analysis.sourceFileCount} source files) but projectType="${type}" was provided. Proceeding as declared.`,
        ),
      );
    }
  }

  return { type, analysis };
}