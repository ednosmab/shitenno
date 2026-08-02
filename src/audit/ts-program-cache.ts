/**
 * ts-program-cache.ts — Shared ts.Program cache for audit detectors
 *
 * Avoids creating multiple ts.Program instances (expensive) across
 * detectors that need AST access (taint analysis, complexity, etc.).
 */

import * as ts from "typescript";
import { statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import { createHash } from "node:crypto";

const programCache = new Map<string, ts.Program>();

/** Clear the program cache (useful between test runs to avoid OOM). */
export function clearProgramCache(): void {
  programCache.clear();
}

/** Detect likely source directory by checking common conventions. */
function findLikelySourceDir(projectRoot: string): string | null {
  const candidates = ["src", "app", "lib", "source"];
  for (const c of candidates) {
    if (existsSync(join(projectRoot, c))) return join(projectRoot, c);
  }
  return null;
}

/** Collect all .ts source files in a directory, excluding tests and node_modules. */
function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = ts.sys.readDirectory(dir, [".ts"], ["node_modules", "__tests__", "dist"]);
  if (entries) {
    for (const entry of entries) {
      if (!/\.test\.(ts|tsx|js|jsx)$/.test(entry) && !/\.bench\.(ts|tsx|js|jsx)$/.test(entry)) {
        files.push(entry);
      }
    }
  }
  return files;
}

/** Build a cache key from tsconfig content + source file mtimes. */
function buildCacheKey(configPath: string | undefined, fileNames: string[]): string {
  const hash = createHash("md5");
  if (configPath) {
    try {
      const stat = statSync(configPath);
      hash.update(String(stat.mtimeMs));
    } catch {
      logger.debug("ts-program-cache", "Config file stat failed — cache key incomplete");
    }
  }
  for (const f of fileNames) {
    try {
      const stat = statSync(f);
      hash.update(f + ":" + stat.mtimeMs);
    } catch {
      logger.debug("ts-program-cache", `Source file stat failed: ${f}`);
    }
  }
  return hash.digest("hex");
}

/**
 * Get or create a ts.Program for the given project root.
 * Reuses cached programs when tsconfig and source files haven't changed.
 * Auto-detects source directory (src/app/lib/source) instead of hardcoding "/src".
 */
export function getOrCreateProgram(projectRoot: string): ts.Program {
  const configPath = ts.findConfigFile(projectRoot, ts.sys.fileExists, "tsconfig.json");

  let compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    esModuleInterop: true,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
  };

  if (configPath) {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (!configFile.error) {
      const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        projectRoot,
      );
      compilerOptions = { ...parsed.options, noEmit: true };
    }
  }

  const srcDir = findLikelySourceDir(projectRoot) ?? projectRoot + "/src";
  const fileNames = collectSourceFiles(srcDir);
  const cacheKey = buildCacheKey(configPath, fileNames);

  const cached = programCache.get(cacheKey);
  if (cached) return cached;

  const program = ts.createProgram(fileNames, compilerOptions);
  programCache.set(cacheKey, program);
  return program;
}
