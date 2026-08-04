import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import {
  ensureWorktree,
  removeWorktree,
  listWorktrees,
  WORKTREE_BRANCH,
  findWorktreeForBranch,
} from "../commands/init/worktree.js";

function makeRepo(name = "worktree"): string {
  const dir = mkdtempSync(join(tmpdir(), `shitenno-${name}-`));
  execSync("git init -q", { cwd: dir });
  execSync("git config user.email t@t.com", { cwd: dir });
  execSync("git config user.name t", { cwd: dir });
  writeFileSync(join(dir, "readme.md"), "# repo\n", "utf-8");
  execSync("git add -A && git commit -q -m init", { cwd: dir });
  return dir;
}

function worktreePathFor(dir: string): string {
  return `${dir}-isolated`;
}

describe("ensureWorktree", () => {
  it("creates a separate physical directory on an isolated branch and leaves the original untouched", async () => {
    const dir = makeRepo();
    const path = worktreePathFor(dir);
    try {
      const setup = await ensureWorktree(dir, path);

      expect(setup.path).toBe(path);
      expect(setup.branch).toBe(WORKTREE_BRANCH);
      expect(setup.reused).toBe(false);
      expect(existsSync(path)).toBe(true);

      // Original repo untouched: still on its initial branch, no .shitenno
      const branch = execSync("git branch --show-current", { cwd: dir }).toString().trim();
      expect(branch).not.toBe(WORKTREE_BRANCH);
      expect(existsSync(join(dir, ".shitenno"))).toBe(false);
      expect(execSync("git status --porcelain", { cwd: dir }).toString().trim()).toBe("");

      // The worktree is on the isolated branch
      const wb = execSync("git branch --show-current", { cwd: path }).toString().trim();
      expect(wb).toBe(WORKTREE_BRANCH);
    } finally {
      await removeWorktree(path, dir).catch(() => {});
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reuses the existing isolated branch on reentry instead of failing", async () => {
    const dir = makeRepo();
    const path = worktreePathFor(dir);
    try {
      const first = await ensureWorktree(dir, path);
      expect(first.reused).toBe(false);

      const second = await ensureWorktree(dir, path);
      expect(second.reused).toBe(true);
      expect(second.path).toBe(path);
    } finally {
      await removeWorktree(path, dir).catch(() => {});
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors clearly when the isolated branch is already checked out on the main worktree", async () => {
    const dir = makeRepo();
    execSync(`git checkout -q -b ${WORKTREE_BRANCH}`, { cwd: dir });
    try {
      await expect(ensureWorktree(dir, worktreePathFor(dir))).rejects.toThrow(/already.*checked out|worktree/i);
    } finally {
      execSync(`git checkout -q -`, { cwd: dir });
      execSync(`git branch -D ${WORKTREE_BRANCH}`, { cwd: dir });
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects an empty target directory path name (validation guard)", async () => {
    const dir = makeRepo();
    await expect(ensureWorktree(dir, "")).rejects.toThrow();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("removeWorktree", () => {
  it("removes a created worktree and its physical directory", async () => {
    const dir = makeRepo();
    const path = worktreePathFor(dir);
    try {
      await ensureWorktree(dir, path);
      expect(existsSync(path)).toBe(true);
      await removeWorktree(path);
      expect(existsSync(path)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("is a no-op when the worktree does not exist", async () => {
    const dir = makeRepo();
    await expect(removeWorktree(worktreePathFor(dir))).resolves.toBeUndefined();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("listWorktrees + findWorktreeForBranch", () => {
  it("lists registered worktrees including the isolated one", async () => {
    const dir = makeRepo();
    const path = worktreePathFor(dir);
    try {
      await ensureWorktree(dir, path);
      const list = await listWorktrees(dir);
      expect(list.some((w) => w.path === path && w.branch === WORKTREE_BRANCH)).toBe(true);
      expect(await findWorktreeForBranch(dir, WORKTREE_BRANCH)).toBe(path);
    } finally {
      await removeWorktree(path, dir).catch(() => {});
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns null when the branch has no worktree", async () => {
    const dir = makeRepo();
    const list = await listWorktrees(dir);
    expect(list.some((w) => w.path === worktreePathFor(dir))).toBe(false);
    expect(await findWorktreeForBranch(dir, WORKTREE_BRANCH)).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });
});