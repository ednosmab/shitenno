/**
 * commands/init/worktree.ts — Phase 3: isolated git worktree
 *
 * All writes of the existing-project flow happen inside a separate physical
 * worktree directory, checked out on an isolated branch, so the user's
 * working directory and branch are never touched. Reuses the branch across
 * attempts (reentrancy) and cleans up cleanly on failure.
 *
 * NOTE: `git worktree` does NOT isolate `.git/hooks` — hooks are per
 * repository. That caveat is surfaced to the user in the consent report.
 */

import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { execAsync } from "../../exec-async.js";

export const WORKTREE_BRANCH = "shitenno/init";

export interface WorktreeInfo {
  path: string;
  branch: string | null;
}

export interface WorktreeSetup {
  path: string;
  branch: string;
  /** True when an existing worktree/branch was reused. */
  reused: boolean;
}

/**
 * Default worktree path: a sibling directory of the project, outside the
 * project folder itself. Requires write permission on the parent directory.
 */
export function resolveWorktreePath(projectRoot: string): string {
  const resolved = resolve(projectRoot);
  return join(dirname(resolved), `${basename(resolved)}-shitenno-init`);
}

/**
 * List registered worktrees for the repository (git worktree list --porcelain).
 * Never throws: read-only best-effort introspection.
 */
export async function listWorktrees(projectRoot: string): Promise<WorktreeInfo[]> {
  try {
    const { stdout } = await execAsync("git", ["worktree", "list", "--porcelain"], {
      cwd: projectRoot,
      timeout: 15_000,
    });
    const worktrees: WorktreeInfo[] = [];
    let current: Partial<WorktreeInfo> | null = null;

    for (const line of stdout.split("\n")) {
      if (line.startsWith("worktree ")) {
        if (current) worktrees.push({ path: current.path!, branch: current.branch ?? null });
        current = { path: line.slice("worktree ".length) };
      } else if (line.startsWith("branch refs/heads/")) {
        if (current) current.branch = line.slice("branch refs/heads/".length);
      }
    }
    if (current) worktrees.push({ path: current.path!, branch: current.branch ?? null });
    return worktrees;
  } catch {
    return [];
  }
}

/**
 * Find the worktree path that has the given branch checked out, if any.
 */
export function findWorktreeForBranch(projectRoot: string, branch: string): Promise<string | null> {
  return listWorktrees(projectRoot).then((worktrees) => {
    const match = worktrees.find((w) => w.branch === branch);
    return match ? match.path : null;
  });
}

async function branchExists(projectRoot: string, branch: string): Promise<boolean> {
  try {
    await execAsync("git", ["rev-parse", "--verify", `refs/heads/${branch}`], {
      cwd: projectRoot,
      timeout: 15_000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Set up the isolated worktree.
 *
 * - Reuses the worktree/branch when the branch already has a worktree at the
 *   requested path (reentrancy across attempts).
 * - Reuses the existing branch when it exists but has no worktree.
 * - Creates branch + worktree when neither exists.
 * - Fails with a clear error when the branch is checked out elsewhere or
 *   another worktree occupies the target path.
 */
export async function ensureWorktree(
  projectRoot: string,
  explicitPath?: string,
): Promise<WorktreeSetup> {
  const rawPath = explicitPath === undefined ? resolveWorktreePath(projectRoot) : explicitPath;
  if (!rawPath.trim()) throw new Error("Worktree path must not be empty.");
  const workPath = resolve(rawPath);

  const existing = await listWorktrees(projectRoot);

  const occupying = existing.find((w) => w.path === workPath);
  if (occupying) {
    if (occupying.branch === WORKTREE_BRANCH) {
      return { path: workPath, branch: WORKTREE_BRANCH, reused: true };
    }
    throw new Error(
      `A worktree already exists at ${workPath} on branch ${occupying.branch}. Remove it with \`git worktree remove\` or finish that installation first.`,
    );
  }

  const branchWorktree = existing.find((w) => w.branch === WORKTREE_BRANCH);
  if (branchWorktree) {
    throw new Error(
      `Branch "${WORKTREE_BRANCH}" is already checked out at ${branchWorktree.path}. Complete or remove that worktree first.`,
    );
  }

  const parent = dirname(workPath);
  if (!existsSync(resolve(parent))) {
    throw new Error(`Parent directory does not exist: ${parent}. Cannot create the isolated worktree.`);
  }

  const hasBranch = await branchExists(projectRoot, WORKTREE_BRANCH);
  if (hasBranch) {
    await execAsync("git", ["worktree", "add", workPath, WORKTREE_BRANCH], {
      cwd: projectRoot,
      timeout: 30_000,
    });
  } else {
    await execAsync("git", ["worktree", "add", "-b", WORKTREE_BRANCH, workPath], {
      cwd: projectRoot,
      timeout: 30_000,
    });
  }

  return { path: workPath, branch: WORKTREE_BRANCH, reused: false };
}

/**
 * Remove a worktree (git worktree remove --force).
 *
 * `git worktree remove` must run from within the repository, so `projectRoot`
 * (when provided) is used as the working directory. Falls back to discovering
 * the enclosing repository from the worktree path itself. No-op when the
 * worktree is no longer registered.
 */
export async function removeWorktree(worktreePath: string, projectRoot?: string): Promise<void> {
  const resolvedPath = resolve(worktreePath);
  let cwd: string | null = projectRoot ? resolve(projectRoot) : null;
  if (!cwd) {
    try {
      const { stdout } = await execAsync("git", ["rev-parse", "--show-toplevel"], {
        cwd: resolvedPath,
        timeout: 15_000,
      });
      cwd = stdout.trim();
    } catch {
      cwd = null;
    }
  }
  if (!cwd) return;

  try {
    await execAsync("git", ["worktree", "remove", "--force", resolvedPath], { cwd, timeout: 30_000 });
  } catch {
    // Worktree already gone or outside the reach of this repository — nothing to clean up.
  }
}