/**
 * Audit module — Changed Files Detection
 *
 * Detects files changed since a base branch via git.
 * Used for incremental scanning (--changed mode).
 */

import { execFileSync } from "node:child_process";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ChangedFilesResult {
  files: string[];
  baseBranch: string;
  isGitRepo: boolean;
  fallbackToFull: boolean;
}

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_BASE_BRANCH = "main";
const GIT_DIFF_TIMEOUT_MS = 10_000;

// ── Core Function ───────────────────────────────────────────────────────────

/**
 * Returns paths (relative to projectRoot) changed since the base branch.
 * Falls back gracefully if not a git repo or base branch doesn't exist.
 */
export function getChangedFiles(
  projectRoot: string,
  baseBranch: string = DEFAULT_BASE_BRANCH
): ChangedFilesResult {
  const emptyResult: ChangedFilesResult = {
    files: [],
    baseBranch,
    isGitRepo: false,
    fallbackToFull: true,
  };

  try {
    // Check if we're in a git repo
    execFileSync("git", ["rev-parse", "--git-dir"], {
      cwd: projectRoot,
      stdio: "pipe",
      timeout: GIT_DIFF_TIMEOUT_MS,
    });

    // Get changed files
    const output = execFileSync(
      "git",
      ["diff", "--name-only", `${baseBranch}...HEAD`],
      {
        cwd: projectRoot,
        encoding: "utf-8",
        stdio: "pipe",
        timeout: GIT_DIFF_TIMEOUT_MS,
      }
    );

    const files = output
      .split("\n")
      .filter(Boolean)
      .filter((f) => /\.(ts|tsx|js|jsx|vue|svelte)$/.test(f));

    return {
      files,
      baseBranch,
      isGitRepo: true,
      fallbackToFull: false,
    };
  } catch {
    // Not a git repo, or base branch doesn't exist
    return emptyResult;
  }
}

// ── Utility Functions ───────────────────────────────────────────────────────

/**
 * Validates if the base branch exists.
 */
export function validateBaseBranch(
  projectRoot: string,
  baseBranch: string
): boolean {
  try {
    execFileSync("git", ["rev-parse", "--verify", baseBranch], {
      cwd: projectRoot,
      stdio: "pipe",
      timeout: GIT_DIFF_TIMEOUT_MS,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the current branch name.
 */
export function getCurrentBranch(projectRoot: string): string | null {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: "pipe",
      timeout: GIT_DIFF_TIMEOUT_MS,
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Checks if we're on the base branch (no changes to scan).
 */
export function isOnBaseBranch(
  projectRoot: string,
  baseBranch: string
): boolean {
  const current = getCurrentBranch(projectRoot);
  return current === baseBranch;
}
