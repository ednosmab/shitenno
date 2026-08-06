/**
 * analyzer.ts — Taint Analyzer using TypeScript Compiler API
 *
 * Analyzes source code for taint flow from sources to sinks.
 * Uses the TypeScript Compiler API for accurate type-aware analysis.
 */

import * as ts from "typescript";
import { statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { TaintIssue } from "./types.js";
import { DataFlowGraph } from "./graph.js";
import { logger } from "../../shared/logger.js";
import {
  visit,
  visitSinksOnly,
  type VariableInfo,
} from "./ast-visitor.js";
import { collectIssues } from "./issue-builder.js";

export interface TaintAnalyzerOptions {
  /** Project root directory */
  projectRoot: string;
  /** Maximum taint propagation depth */
  maxDepth?: number;
  /** Enable cross-file analysis */
  crossFile?: boolean;
  /** Only report issues above this severity */
  minSeverity?: 1 | 2 | 3;
  /** Override for source directory detection */
  srcDirOverride?: string;
}

function findLikelySourceDir(projectRoot: string): string | null {
  const candidates = ["src", "app", "lib", "source"];
  for (const c of candidates) {
    if (existsSync(join(projectRoot, c))) return join(projectRoot, c);
  }
  return null;
}

export class TaintAnalyzer {
  private program: ts.Program;
  private checker: ts.TypeChecker;
  private graph: DataFlowGraph;
  private options: Required<TaintAnalyzerOptions>;

  private variableTaint: Map<string, VariableInfo> = new Map();
  private static programCache = new Map<string, ts.Program>();
  private nodeCounter = 0;

  /** Clear the static program cache (useful between test runs to avoid OOM) */
  static clearCache(): void {
    TaintAnalyzer.programCache.clear();
  }

  constructor(options: TaintAnalyzerOptions) {
    this.options = {
      maxDepth: options.maxDepth ?? 20,
      /** Enable cross-file analysis (default: true).
       *  May increase analysis time on large projects. Disable via { crossFile: false } if needed. */
      // Enable cross-file analysis (default: true). May increase analysis time on large projects.
      crossFile: options.crossFile ?? true,
      minSeverity: options.minSeverity ?? 1,
      projectRoot: options.projectRoot,
      srcDirOverride: options.srcDirOverride ?? "",
    };

    // Create TypeScript program
    const configPath = ts.findConfigFile(
      this.options.projectRoot,
      ts.sys.fileExists,
      "tsconfig.json",
    );

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
          this.options.projectRoot,
        );
        compilerOptions = { ...parsed.options, noEmit: true };
      }
    }

    // Detect source directory: explicit override > auto-detect > fallback to "/src"
    const srcDir = this.options.srcDirOverride
      || findLikelySourceDir(this.options.projectRoot)
      || this.options.projectRoot + "/src";
    const fileNames = this.collectSourceFiles(srcDir);

    // Build cache key from tsconfig hash + file mtimes so cache invalidates on changes
    const cacheKey = this.buildCacheKey(configPath, fileNames);
    this.program = TaintAnalyzer.programCache.get(cacheKey) ?? ts.createProgram(fileNames, compilerOptions);
    TaintAnalyzer.programCache.set(cacheKey, this.program);
    this.checker = this.program.getTypeChecker();
    this.graph = new DataFlowGraph();
  }

  /** Collect all .ts source files in src/ */
  private collectSourceFiles(dir: string): string[] {
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

  /** Build a cache key from tsconfig content + source file mtimes */
  private buildCacheKey(configPath: string | undefined, fileNames: string[]): string {
    const hash = createHash("md5");
    if (configPath) {
      try {
        const stat = statSync(configPath);
        hash.update(String(stat.mtimeMs));
      } catch (error) {
        logger.debug("analyzer", "Suppressed error", { error });
      }
    }
    for (const f of fileNames) {
      try {
        const stat = statSync(f);
        hash.update(f + ":" + stat.mtimeMs);
      } catch (error) {
        logger.debug("analyzer", "Suppressed error", { error });
      }
    }
    return hash.digest("hex");
  }

  /** Generate a unique node ID */
  private nextNodeId(): string {
    return `n${this.nodeCounter++}`;
  }

  private analyzeSourceFiles(sourceFiles: readonly ts.SourceFile[]): void {
    // Pass 1: collect sources, propagate through assignments and call parameters
    for (const sourceFile of sourceFiles) {
      if (sourceFile.isDeclarationFile) continue;
      if (sourceFile.fileName.includes("node_modules")) continue;
      visit(sourceFile, {
        graph: this.graph,
        variableTaint: this.variableTaint,
        checker: this.checker,
        sourceFile,
        nextNodeId: () => this.nextNodeId(),
      });
    }
    // Pass 2: re-visit sinks now that parameters may be tainted from call sites
    for (const sourceFile of sourceFiles) {
      if (sourceFile.isDeclarationFile) continue;
      if (sourceFile.fileName.includes("node_modules")) continue;
      visitSinksOnly(sourceFile, {
        graph: this.graph,
        variableTaint: this.variableTaint,
        checker: this.checker,
        nextNodeId: () => this.nextNodeId(),
      });
    }
  }

  /** Run taint analysis on all source files */
  analyze(): TaintIssue[] {
    this.analyzeSourceFiles(this.program.getSourceFiles());
    return collectIssues(this.graph, {
      maxDepth: this.options.maxDepth,
      minSeverity: this.options.minSeverity,
      projectRoot: this.options.projectRoot,
    });
  }

  /** Get the data flow graph (for debugging/visualization) */
  getGraph(): DataFlowGraph {
    return this.graph;
  }

  /** Get variable taint information */
  getVariableTaint(): Map<string, VariableInfo> {
    return this.variableTaint;
  }
}
