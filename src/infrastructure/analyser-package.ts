/**
 * analyser-package.ts — package.json reader with cache
 *
 * Shared helper for the project analyser. Caches the last read
 * package.json per root directory to avoid repeated disk reads.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  workspaces?: unknown;
}

let cachedPkgRoot: string | null = null;
let cachedPkg: PackageJson | null = null;

export function readPackageJson(rootDir: string): PackageJson | null {
  if (cachedPkgRoot === rootDir) return cachedPkg;
  cachedPkgRoot = rootDir;
  const path = join(rootDir, "package.json");
  if (!existsSync(path)) {
    cachedPkg = null;
    return null;
  }
  try {
    cachedPkg = JSON.parse(readFileSync(path, "utf-8"));
    return cachedPkg;
  } catch {
    cachedPkg = null;
    return null;
  }
}
