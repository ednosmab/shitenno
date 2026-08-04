import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import {
  restoreFromBackup,
  runUndo,
  type RestoreResult,
} from "../commands/init/restore.js";
import { SHITENNO_DIR_NAME } from "../constants.js";

function makeDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), `shitenno-restore-${prefix}-`));
  execSync("git init -q", { cwd: dir });
  return dir;
}

function backupDir(projectRoot: string): string {
  return join(projectRoot, SHITENNO_DIR_NAME, "backup", "pre-init");
}

describe("restoreFromBackup (Phase 6 — undo)", () => {
  it("restores an original file that init had replaced", () => {
    const dir = makeDir("restore");
    try {
      writeFileSync(join(dir, "opencode.json"), JSON.stringify({ model: "replaced" }), "utf-8");
      mkdirSync(backupDir(dir), { recursive: true });
      writeFileSync(join(backupDir(dir), "opencode.json"), JSON.stringify({ model: "original" }), "utf-8");

      const result: RestoreResult = restoreFromBackup(dir, join(dir, SHITENNO_DIR_NAME));

      expect(result.restored).toContain("opencode.json");
      expect(JSON.parse(readFileSync(join(dir, "opencode.json"), "utf-8"))).toEqual({
        model: "original",
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("removes a file that init created and that had no original", () => {
    const dir = makeDir("created");
    try {
      // init created .mcp.json — no backup exists for it
      writeFileSync(join(dir, ".mcp.json"), "{}", "utf-8");
      mkdirSync(backupDir(dir), { recursive: true });
      // backup dir exists (opencode.json was backed up), but .mcp.json is new

      const result = restoreFromBackup(dir, join(dir, SHITENNO_DIR_NAME));

      expect(result.removed).toContain(".mcp.json");
      expect(existsSync(join(dir, ".mcp.json"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("is a no-op when there is nothing in the backup dir nor files to remove", () => {
    const dir = makeDir("noop");
    try {
      mkdirSync(backupDir(dir), { recursive: true });
      const result = restoreFromBackup(dir, join(dir, SHITENNO_DIR_NAME));
      expect(result).toEqual({ restored: [], removed: [] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns an empty result when no backup was ever made", () => {
    const dir = makeDir("nobackup");
    try {
      const result = restoreFromBackup(dir, join(dir, SHITENNO_DIR_NAME));
      expect(result).toEqual({ restored: [], removed: [] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runUndo reports false when no backup exists and true when it acts", () => {
    const dir = makeDir("undofalse");
    try {
      expect(runUndo(dir)).toBe(false);
      mkdirSync(backupDir(dir), { recursive: true });
      expect(runUndo(dir)).toBe(false); // no files yet
      writeFileSync(join(dir, "opencode.json"), "{}", "utf-8");
      mkdirSync(backupDir(dir), { recursive: true });
      writeFileSync(join(backupDir(dir), "opencode.json"), "{}", "utf-8");
      expect(runUndo(dir)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});