/**
 * commands/init/restore.ts — Phase 6: explicit reversal (undo)
 *
 * `shugo init --undo` restores the files that Phase 4 (Level 2) replaced and
 * removes the files that init created when no original existed. The backup in
 * `.shitenno/backup/pre-init/` is the source of truth for "what was there
 * before" — no reliance on the user knowing how to navigate the backup dir.
 */

import { copyFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { REPLACEABLE_ROOT_FILES } from "./apply.js";
import { SHITENNO_DIR_NAME } from "../../constants.js";

export interface RestoreResult {
  /** Files restored from `.shitenno/backup/pre-init/`. */
  restored: string[];
  /** Files created by init (no backup existed) that were removed. */
  removed: string[];
}

/**
 * Restore the pre-init state for every replaceable root file.
 *
 * Rule per replaceable file:
 *  - a backup exists        → restore the original over the current file;
 *  - no backup but file exists → the file was created by init → remove it;
 *  - nowhere                → nothing to do.
 */
export function restoreFromBackup(projectDir: string, shitennoDir: string): RestoreResult {
  const backupDir = join(shitennoDir, "backup", "pre-init");
  const result: RestoreResult = { restored: [], removed: [] };

  if (!existsSync(backupDir)) return result;

  for (const file of REPLACEABLE_ROOT_FILES) {
    const backupPath = join(backupDir, file);
    const currentPath = join(projectDir, file);
    if (existsSync(backupPath)) {
      copyFileSync(backupPath, currentPath);
      result.restored.push(file);
    } else if (existsSync(currentPath)) {
      rmSync(currentPath, { force: true });
      result.removed.push(file);
    }
  }

  return result;
}

/**
 * Run the undo command for a project root. Returns true when a backup was
 * found and acted on.
 */
export function runUndo(targetDir: string): boolean {
  const shitennoDir = join(targetDir, SHITENNO_DIR_NAME);
  if (!existsSync(join(shitennoDir, "backup", "pre-init"))) return false;
  const result = restoreFromBackup(targetDir, shitennoDir);
  return result.restored.length > 0 || result.removed.length > 0;
}