/**
 * Bounded context boundary analysis.
 *
 * Scans a project's src tree, resolves each module to its bounded context via
 * the context registry, and reports coverage, cross-context violations and
 * context-level cycles.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { walkSourceFiles } from "./utils.js";
import { contextOfModule } from "../domain/types/context-map.js";
import { isAllowedContextEdge } from "../domain/rules/context-dependencies.js";
import type { SourceContext } from "../domain/types/context-map.js";

export interface ContextBoundaryViolation {
  importer: string;
  target: string;
  from: string;
  to: string;
}

export interface ContextBoundaryReport {
  totalModules: number;
  mappedModules: number;
  coverage: number;
  violations: ContextBoundaryViolation[];
  cycles: string[];
}

function isSkippedModule(relPath: string, fileName: string): boolean {
  if (fileName.endsWith(".d.ts")) return true;
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(relPath)) return true;
  return relPath.split("/").some((part) => ["__tests__", "templates", "__fixtures__"].includes(part));
}

function resolveImportTarget(rootDir: string, importerDir: string, specifier: string): string | null {
  const cleaned = specifier.replace(/\.js$/, "");
  const base = normalize(join(importerDir, cleaned)).replace(/\\/g, "/");
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  for (const candidate of candidates) {
    if (existsSync(join(rootDir, candidate))) return candidate;
  }
  return null;
}

function collectModules(rootDir: string): Array<{ rel: string; fileName: string }> {
  const modules: Array<{ rel: string; fileName: string }> = [];
  walkSourceFiles(join(rootDir, "src"), (fullPath, fileName) => {
    const rel = relative(rootDir, fullPath).replace(/\\/g, "/");
    if (!isSkippedModule(rel, fileName)) modules.push({ rel, fileName });
  });
  return modules;
}

interface ContextEdge {
  from: SourceContext;
  to: SourceContext;
  importer: string;
  target: string;
}

function collectEdges(rootDir: string, modules: Array<{ rel: string; fileName: string }>): ContextEdge[] {
  const edges: ContextEdge[] = [];
  for (const module of modules) {
    const from = contextOfModule(module.rel);
    if (from === null) continue;
    const content = readFileSync(join(rootDir, module.rel), "utf-8");
    const specifiers = [...content.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
    for (const specifier of specifiers) {
      if (!specifier.startsWith(".")) continue;
      const target = resolveImportTarget(rootDir, dirname(module.rel), specifier);
      if (target === null) continue;
      const to = contextOfModule(target);
      if (to === null || from === to) continue;
      edges.push({ from, to, importer: module.rel, target });
    }
  }
  return edges;
}

function findCycles(edges: ContextEdge[]): string[] {
  const graph = new Map<SourceContext, Set<SourceContext>>();
  for (const edge of edges) {
    if (!graph.has(edge.from)) graph.set(edge.from, new Set());
    graph.get(edge.from)!.add(edge.to);
  }
  const cyclic: string[] = [];
  for (const start of graph.keys()) {
    if (cyclic.includes(start)) continue;
    const visited = new Set<SourceContext>();
    const stack: SourceContext[] = [start];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const next of graph.get(current) ?? []) {
        if (next === start) {
          cyclic.push(start);
          break;
        }
        if (!visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      }
    }
  }
  return cyclic;
}

/**
 * Analyses bounded context boundaries in a project's src tree.
 */
export function analyseContextBoundaries(rootDir: string): ContextBoundaryReport {
  const modules = collectModules(rootDir);
  const mapped = modules.filter((m) => contextOfModule(m.rel) !== null);
  const coverage = modules.length === 0 ? 0 : mapped.length / modules.length;
  const edges = collectEdges(rootDir, modules);
  const violations = edges
    .filter((edge) => !isAllowedContextEdge(edge.from, edge.to))
    .map((edge) => ({ importer: edge.importer, target: edge.target, from: edge.from, to: edge.to }));
  return {
    totalModules: modules.length,
    mappedModules: mapped.length,
    coverage,
    violations,
    cycles: findCycles(edges),
  };
}
