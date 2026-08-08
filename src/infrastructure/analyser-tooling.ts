/**
 * analyser-tooling.ts — Package/tooling detection
 *
 * Detects package manager, monorepo layout, dependency counts,
 * test/linter/CI/TypeScript presence and commit history.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { walkSourceFiles } from "./utils.js";
import { readPackageJson } from "./analyser-package.js";

export function detectPackageManager(rootDir: string): "pnpm" | "npm" | "yarn" | "unknown" {
  if (existsSync(join(rootDir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(rootDir, "yarn.lock"))) return "yarn";
  if (existsSync(join(rootDir, "package-lock.json"))) return "npm";
  return "unknown";
}

export function detectMonorepo(rootDir: string): boolean {
  if (existsSync(join(rootDir, "pnpm-workspace.yaml"))) return true;
  if (existsSync(join(rootDir, "lerna.json"))) return true;
  const pkg = readPackageJson(rootDir);
  if (pkg?.workspaces) return true;
  return false;
}

export function countPackages(rootDir: string): number {
  let count = 0;
  const packagesDir = join(rootDir, "packages");
  if (existsSync(packagesDir)) {
    count += readdirSync(packagesDir).filter((d) =>
      existsSync(join(packagesDir, d, "package.json"))
    ).length;
  }
  return count;
}

export function countApps(rootDir: string): number {
  let count = 0;
  const appsDir = join(rootDir, "apps");
  if (existsSync(appsDir)) {
    count += readdirSync(appsDir).filter((d) =>
      existsSync(join(appsDir, d, "package.json"))
    ).length;
  }
  return count;
}

export function countDependencies(rootDir: string): number {
  const pkg = readPackageJson(rootDir);
  if (!pkg) return 0;
  const deps = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ]);
  return deps.size;
}

export function countSourceFiles(rootDir: string): number {
  let count = 0;
  walkSourceFiles(rootDir, () => count++);
  return count;
}

export function detectTests(rootDir: string): boolean {
  const pkg = readPackageJson(rootDir);
  if (!pkg) return false;
  const testDeps = ["jest", "vitest", "playwright", "mocha", "ava", "cypress"];
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };
  return testDeps.some((d) => d in allDeps) || !!pkg.scripts?.test;
}

export function detectLinter(rootDir: string): boolean {
  const configs = [
    ".eslintrc",
    ".eslintrc.js",
    ".eslintrc.json",
    ".eslintrc.yml",
    "eslint.config.js",
    "eslint.config.mjs",
    "biome.json",
  ];
  if (configs.some((c) => existsSync(join(rootDir, c)))) return true;
  const pkg = readPackageJson(rootDir);
  if (!pkg) return false;
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };
  return "eslint" in allDeps || "@biomejs/biome" in allDeps;
}

export function detectCI(rootDir: string): boolean {
  const ciPaths = [
    ".github/workflows",
    ".gitlab-ci.yml",
    "Jenkinsfile",
    ".circleci",
    ".travis.yml",
  ];
  return ciPaths.some((p) => existsSync(join(rootDir, p)));
}

export function detectTypeScript(rootDir: string): boolean {
  return existsSync(join(rootDir, "tsconfig.json"));
}

export function countTotalCommits(rootDir: string): number {
  try {
    const output = execSync("git rev-list --count HEAD", {
      encoding: "utf-8",
      cwd: rootDir,
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return parseInt(output.trim(), 10) || 0;
  } catch {
    return 0;
  }
}
