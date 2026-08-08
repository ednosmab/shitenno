/**
 * analyser.ts — Project Analyser (barrel)
 *
 * Analyses the structure of a project and detects its tech stack.
 *
 * Split layout:
 *   - package:  ./analyser-package.js   — package.json reader with cache
 *   - stack:    ./analyser-stack.js     — tech stack detection
 *   - tooling:  ./analyser-tooling.js   — package manager, monorepo, tests, CI
 *   - structure:./analyser-structure.js — src/ layout and coupling signals
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { SHITENNO_DIR_NAME } from "../domain/types/constants.js";
import { analyseContextBoundaries } from "./context-boundary.js";
import { detectStack } from "./analyser-stack.js";
import {
  detectPackageManager,
  detectMonorepo,
  countPackages,
  countApps,
  countDependencies,
  countSourceFiles,
  detectTests,
  detectLinter,
  detectCI,
  detectTypeScript,
  countTotalCommits,
} from "./analyser-tooling.js";
import {
  countFlatSourceFiles,
  countLayeredDirs,
  countNodeImportsOutsideLayers,
  detectPortConsumption,
} from "./analyser-structure.js";

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
  boundedContextCoverage: number;
  contextBoundaryViolations: number;
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
  const boundaries = analyseContextBoundaries(rootDir);
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
    boundedContextCoverage: boundaries.coverage,
    contextBoundaryViolations: boundaries.violations.length,
  };
}
