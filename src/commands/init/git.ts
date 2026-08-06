/**
 * commands/init/git.ts — Git utilities for the init flow
 *
 * Uses execFile (never shell interpolation) for all git operations.
 * git worktree requires a git repository — the init gate guarantees it.
 */

import { isAbsolute, resolve } from "node:path";
import { execAsync } from "../../infrastructure/exec-async.js";

const GIT_TIMEOUT = 30_000;

/**
 * Determine whether a directory is inside a git repository.
 * Handles nested directories and worktrees (--is-inside-work-tree).
 */
export async function isGitRepository(targetDir: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: targetDir,
      timeout: GIT_TIMEOUT,
    });
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

/**
 * Resolve the real git common dir.
 *
 * Uses `git rev-parse --git-common-dir` (not `--git-dir`) so the repository's
 * primary `.git` is resolved even when called from inside a worktree (Phase 3).
 * The output may be relative to the project root.
 */
export async function resolveGitCommonDir(projectRoot: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync("git", ["rev-parse", "--git-common-dir"], {
      cwd: projectRoot,
      timeout: GIT_TIMEOUT,
    });
    const dir = stdout.trim();
    if (!dir) return null;
    return isAbsolute(dir) ? dir : resolve(projectRoot, dir);
  } catch {
    return null;
  }
}

/**
 * Initialize a git repository in the target directory (git init).
 */
export async function initGitRepository(targetDir: string): Promise<boolean> {
  try {
    await execAsync("git", ["init"], { cwd: targetDir, timeout: GIT_TIMEOUT });
    return true;
  } catch {
    return false;
  }
}