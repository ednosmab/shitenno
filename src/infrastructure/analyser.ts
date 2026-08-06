import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { SHITENNO_DIR_NAME } from "../domain/types/constants.js";
import { walkSourceFiles } from "./utils.js";

export interface ProjectAnalysis {
  rootDir: string;
  hasGit: boolean;
  hasPackageJson: boolean;
  hasShitenno: boolean;
  stack: string[];
  packageManager: "pnpm" | "npm" | "yarn" | "unknown";
  monorepo: boolean;
  packageCount: number;
  appCount: number;
  dependencyCount: number;
  sourceFileCount: number;
  hasTests: boolean;
  hasLinter: boolean;
  hasCI: boolean;
  hasTypeScript: boolean;
  totalCommits: number;
  flatSourceFiles: number;
  layeredDirs: number;
  nodeApiImportsOutsideLayers: number;
  portsConsumed: boolean;
}

/**
 * Analisa a estrutura de um projeto e detecta stack tecnológico.
 *
 * @param rootDir - Diretório raiz do projeto a analisar
 * @returns Análise completa com contagem de packages, apps, files, dependencies e stack detectada
 *
 * @example
 * ```ts
 * const analysis = analyseProject("/path/to/project");
 * console.log(analysis.packageCount); // 3
 * console.log(analysis.stack);        // ["react", "nextjs", "tailwindcss"]
 * ```
 */
export function analyseProject(rootDir: string): ProjectAnalysis {
  return {
    rootDir,
    hasGit: existsSync(join(rootDir, ".git")),
    hasPackageJson: existsSync(join(rootDir, "package.json")),
    hasShitenno: existsSync(join(rootDir, SHITENNO_DIR_NAME)),
    stack: detectStack(rootDir),
    packageManager: detectPackageManager(rootDir),
    monorepo: detectMonorepo(rootDir),
    packageCount: countPackages(rootDir),
    appCount: countApps(rootDir),
    dependencyCount: countDependencies(rootDir),
    sourceFileCount: countSourceFiles(rootDir),
    hasTests: detectTests(rootDir),
    hasLinter: detectLinter(rootDir),
    hasCI: detectCI(rootDir),
    hasTypeScript: detectTypeScript(rootDir),
    totalCommits: countTotalCommits(rootDir),
    flatSourceFiles: countFlatSourceFiles(rootDir),
    layeredDirs: countLayeredDirs(rootDir),
    nodeApiImportsOutsideLayers: countNodeImportsOutsideLayers(rootDir),
    portsConsumed: detectPortConsumption(rootDir),
  };
}

const LAYER_DIRS = ["shared", "domain", "application", "infrastructure", "interface"];

function countFlatSourceFiles(rootDir: string): number {
  const srcDir = join(rootDir, "src");
  if (!existsSync(srcDir)) return 0;
  try {
    return readdirSync(srcDir).filter(
      (name) => /\.(ts|tsx|js|jsx)$/.test(name) && !name.endsWith(".d.ts")
    ).length;
  } catch {
    return 0;
  }
}

function countLayeredDirs(rootDir: string): number {
  const srcDir = join(rootDir, "src");
  if (!existsSync(srcDir)) return 0;
  try {
    const entries = readdirSync(srcDir);
    return LAYER_DIRS.filter((layer) => entries.includes(layer)).length;
  } catch {
    return 0;
  }
}

function isOutsideAdapterLayers(relPath: string): boolean {
  const parts = relPath.split("/");
  const srcIndex = parts.indexOf("src");
  if (srcIndex === -1) return false;
  const layer = parts[srcIndex + 1];
  return layer !== undefined && !["infrastructure", "interface"].includes(layer);
}

function countNodeImportsOutsideLayers(rootDir: string): number {
  let count = 0;
  walkSourceFiles(rootDir, (fullPath, _fileName) => {
    const rel = fullPath.replace(rootDir, "").replace(/^[/\\]/, "");
    if (!rel.startsWith("src/")) return;
    if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(rel)) return;
    if (rel.includes("/__tests__/") || rel.includes("/__fixtures__/") || rel.includes("/templates/")) return;
    if (!isOutsideAdapterLayers(rel)) return;
    try {
      const content = readFileSync(fullPath, "utf-8");
      if (/["']node:[a-z][a-z0-9]*["']/.test(content)) count++;
    } catch { /* unreadable file is not evidence of coupling */ }
  });
  return count;
}

function detectPortConsumption(rootDir: string): boolean {
  let found = false;
  walkSourceFiles(rootDir, (fullPath, _fileName) => {
    if (found) return;
    const rel = fullPath.replace(rootDir, "").replace(/^[/\\]/, "");
    if (!rel.startsWith("src/")) return;
    if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(rel)) return;
    if (rel.includes("/__tests__/") || rel.includes("/__fixtures__/")) return;
    if (rel.startsWith("src/domain/")) return;
    try {
      const content = readFileSync(fullPath, "utf-8");
      if (/["'][^"']*\/ports\//.test(content)) found = true;
    } catch { /* unreadable file is not evidence of port usage */ }
  });
  return found;
}

function detectStack(rootDir: string): string[] {
  const stack: string[] = [];
  const pkg = readPackageJson(rootDir);

  // Detect base language/runtime from filesystem signals
  if (existsSync(join(rootDir, "tsconfig.json"))) stack.push("typescript");
  if (pkg) stack.push("node");

  if (!pkg) return [...new Set(stack)];

  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  const stackMap: Record<string, string[]> = {
    react: ["react", "react-dom"],
    nextjs: ["next"],
    vue: ["vue"],
    nuxt: ["nuxt"],
    svelte: ["svelte"],
    sveltekit: ["@sveltejs/kit"],
    expo: ["expo"],
    "react-native": ["react-native"],
    angular: ["@angular/core"],
    express: ["express"],
    fastify: ["fastify"],
    nestjs: ["@nestjs/core"],
    tailwindcss: ["tailwindcss"],
    styledcomponents: ["styled-components"],
    emotion: ["@emotion/react"],
    zod: ["zod"],
    jotai: ["jotai"],
    zustand: ["zustand"],
    redux: ["@reduxjs/toolkit"],
    prisma: ["@prisma/client"],
    drizzle: ["drizzle-orm"],
    typeorm: ["typeorm"],
    mongoose: ["mongoose"],
    trpc: ["@trpc/server"],
    graphql: ["graphql"],
    axios: ["axios"],
    vite: ["vite"],
    webpack: ["webpack"],
    esbuild: ["esbuild"],
    turborepo: ["turbo"],
    nx: ["nx"],
  };

  for (const [name, deps] of Object.entries(stackMap)) {
    if (deps.some((d) => d in allDeps)) {
      stack.push(name);
    }
  }

  return [...new Set(stack)];
}

function detectPackageManager(rootDir: string): "pnpm" | "npm" | "yarn" | "unknown" {
  if (existsSync(join(rootDir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(rootDir, "yarn.lock"))) return "yarn";
  if (existsSync(join(rootDir, "package-lock.json"))) return "npm";
  return "unknown";
}

function detectMonorepo(rootDir: string): boolean {
  if (existsSync(join(rootDir, "pnpm-workspace.yaml"))) return true;
  if (existsSync(join(rootDir, "lerna.json"))) return true;
  const pkg = readPackageJson(rootDir);
  if (pkg?.workspaces) return true;
  return false;
}

function countPackages(rootDir: string): number {
  let count = 0;
  const packagesDir = join(rootDir, "packages");
  if (existsSync(packagesDir)) {
    count += readdirSync(packagesDir).filter((d) =>
      existsSync(join(packagesDir, d, "package.json"))
    ).length;
  }
  return count;
}

function countApps(rootDir: string): number {
  let count = 0;
  const appsDir = join(rootDir, "apps");
  if (existsSync(appsDir)) {
    count += readdirSync(appsDir).filter((d) =>
      existsSync(join(appsDir, d, "package.json"))
    ).length;
  }
  return count;
}

function countDependencies(rootDir: string): number {
  const pkg = readPackageJson(rootDir);
  if (!pkg) return 0;
  const deps = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ]);
  return deps.size;
}

function countSourceFiles(rootDir: string): number {
  let count = 0;
  walkSourceFiles(rootDir, () => count++);
  return count;
}

function detectTests(rootDir: string): boolean {
  const pkg = readPackageJson(rootDir);
  if (!pkg) return false;
  const testDeps = ["jest", "vitest", "playwright", "mocha", "ava", "cypress"];
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };
  return testDeps.some((d) => d in allDeps) || !!pkg.scripts?.test;
}

function detectLinter(rootDir: string): boolean {
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

function detectCI(rootDir: string): boolean {
  const ciPaths = [
    ".github/workflows",
    ".gitlab-ci.yml",
    "Jenkinsfile",
    ".circleci",
    ".travis.yml",
  ];
  return ciPaths.some((p) => existsSync(join(rootDir, p)));
}

function detectTypeScript(rootDir: string): boolean {
  return existsSync(join(rootDir, "tsconfig.json"));
}

function countTotalCommits(rootDir: string): number {
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

let cachedPkgRoot: string | null = null;
let cachedPkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; scripts?: Record<string, string>; workspaces?: unknown } | null = null;

function readPackageJson(rootDir: string): { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; scripts?: Record<string, string>; workspaces?: unknown } | null {
  if (cachedPkgRoot === rootDir) return cachedPkg;
  cachedPkgRoot = rootDir;
  const path = join(rootDir, "package.json");
  if (!existsSync(path)) { cachedPkg = null; return null; }
  try {
    cachedPkg = JSON.parse(readFileSync(path, "utf-8"));
    return cachedPkg;
  } catch {
    cachedPkg = null;
    return null;
  }
}
