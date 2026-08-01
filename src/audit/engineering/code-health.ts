import { ORPHAN_SEVERITY_THRESHOLD, OVERSIZED_WARNING_THRESHOLD, OVERSIZED_INFO_THRESHOLD } from "../constants.js";
import type { HealthIssue, SourceFileInfo } from "../types.js";
import { logger } from "../../logger.js";

function extractFileExports(files: SourceFileInfo[]): Map<string, Set<string>> {
  const exportRegex = /^export\s+(?:function|const|class|interface|type|enum)\s+(\w+)/gm;
  const fileExports = new Map<string, Set<string>>();
  for (const file of files) {
    const exports = new Set<string>();
    let match;
    while ((match = exportRegex.exec(file.content)) !== null) { if (match[1]) exports.add(match[1]); }
    fileExports.set(file.fullPath, exports);
  }
  return fileExports;
}

const isTestFile = (f: SourceFileInfo) => f.relPath.includes("__tests__/") || f.relPath.endsWith(".test.ts");

function hasImportPathMatch(content: string, basename: string, baseNoExt: string): boolean {
  const names = [basename, baseNoExt];
  const exts = ["", ".js", ".ts", ".tsx"];
  for (const name of names) {
    for (const ext of exts) {
      if (content.includes(`/${name}${ext}"`) || content.includes(`/${name}${ext}'`)) return true;
    }
  }
  return false;
}

function isFileReferenced(file: SourceFileInfo, files: SourceFileInfo[], exports: Set<string>): boolean {
  const baseNoExt = file.basename.replace(/\.(ts|tsx|js|jsx)$/, "");

  const isImportedByPath = files.some((other) => {
    if (other.fullPath === file.fullPath) return false;
    if (isTestFile(other) && !isTestFile(file)) return false;
    return hasImportPathMatch(other.content, file.basename, baseNoExt);
  });
  if (isImportedByPath) return true;
  if (exports.size === 0) return false;
  return [...exports].some((symbol) => files.some((other) => {
    if (other.fullPath === file.fullPath) return false;
    if (isTestFile(other) && !isTestFile(file)) return false;
    return new RegExp(`\\b${symbol}\\b`).test(other.content);
  }));
}

export function detectOrphanModules(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  if (files.length === 0) return issues;
  try {
    const fileExports = extractFileExports(files);
    const nonOrphanFiles = files.filter((f) => !f.fullPath.includes("/commands/") && !f.fullPath.includes("/console/"));
    for (const file of nonOrphanFiles) {
      const exports = fileExports.get(file.fullPath) ?? new Set();
      if (isFileReferenced(file, files, exports)) continue;
      const exportCount = exports.size;
      const exportList = exportCount > 0 ? ` (${exportCount} exports: ${[...exports].slice(0, 3).join(", ")}${exportCount > 3 ? "..." : ""})` : "";
      issues.push({ type: "orphan_module", severity: file.lineCount > ORPHAN_SEVERITY_THRESHOLD ? 2 : 1,
        description: `Modulo orfao: "${file.relPath}" (${file.lineCount} linhas${exportList}) — nenhum import nem export usado por outro modulo`,
        location: file.relPath, recommendation: `Verificar se "${file.basename}" e necessario — remover se morto, ou adicionar imports para os exports usados`, confidence: 0.6 });
    }
  } catch (err) { logger.debug("engineering-detectors", "Error in detectOrphanModules:", err); }
  return issues;
}

export function detectComplexityHotspots(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const largeFiles = files.filter((f) => f.lineCount > OVERSIZED_INFO_THRESHOLD);
  largeFiles.sort((a, b) => b.lineCount - a.lineCount);

  for (const file of largeFiles) {
    issues.push({
      type: "oversized_file",
      severity: file.lineCount > OVERSIZED_WARNING_THRESHOLD ? 2 : 1,
      description: `Arquivo oversized: "${file.relPath}" tem ${file.lineCount} linhas${file.lineCount > OVERSIZED_WARNING_THRESHOLD ? " — considere dividir" : ""}`,
      location: file.relPath,
      recommendation: file.lineCount > OVERSIZED_WARNING_THRESHOLD
        ? `Dividir "${file.relPath}" em modulos menores (<${OVERSIZED_INFO_THRESHOLD} linhas cada)`
        : `Monitorar tamanho de "${file.relPath}" — considerar refatorar se crescer`,
      confidence: 0.9,
    });
  }
  return issues;
}

function normalizePath(raw: string): string {
  const segments = raw.split("/");
  const normalized: string[] = [];
  for (const seg of segments) {
    if (seg === "..") { normalized.pop(); }
    else if (seg !== "." && seg !== "") { normalized.push(seg); }
  }
  return normalized.join("/");
}

function buildImportGraph(files: SourceFileInfo[]): Map<string, Set<string>> {
  const importRegex = /(?:from|import)\s+["']([^"']+)["']/g;
  const pathToKey = (p: string) => p.replace(/\.ts$/, "").replace(/\.js$/, "");
  const importGraph = new Map<string, Set<string>>();
  for (const file of files) {
    const deps = new Set<string>();
    const contentWithoutTypeImports = file.content.split("\n").filter((line) => !/^\s*import\s+type\s+/.test(line)).join("\n");
    let match;
    while ((match = importRegex.exec(contentWithoutTypeImports)) !== null) {
      const spec = match[1];
      if (!spec) continue;
      if (spec.startsWith(".") || spec.startsWith("/")) {
        const dirOfCurrentFile = file.relPath.split("/").slice(0, -1).join("/");
        const raw = `${dirOfCurrentFile}/${spec.replace(/\.js$/, "")}`;
        const resolved = pathToKey(normalizePath(raw));
        if (resolved && resolved !== pathToKey(file.relPath)) deps.add(resolved);
      }
    }
    importGraph.set(pathToKey(file.relPath), deps);
  }
  return importGraph;
}

function findCycles(importGraph: Map<string, Set<string>>): string[][] {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycles: string[][] = [];
  function dfs(node: string, path: string[]): void {
    if (inStack.has(node)) { const cycleStart = path.indexOf(node); if (cycleStart !== -1) cycles.push([...path.slice(cycleStart), node]); return; }
    if (visited.has(node)) return;
    visited.add(node); inStack.add(node); path.push(node);
    const deps = importGraph.get(node);
    if (deps) { for (const dep of deps) { if (importGraph.has(dep)) dfs(dep, path); } }
    path.pop(); inStack.delete(node);
  }
  for (const node of importGraph.keys()) dfs(node, []);
  return cycles;
}

export function detectCircularDeps(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  if (files.length === 0) return issues;
  const importGraph = buildImportGraph(files);
  const cycles = findCycles(importGraph);
  const seenCycles = new Set<string>();
  for (const cycle of cycles) {
    const key = [...cycle].sort().join("->");
    if (seenCycles.has(key)) continue;
    seenCycles.add(key);
    const cyclePath = cycle.join(" → ");
    issues.push({ type: "circular_dep", severity: 3,
      description: `Dependência circular detectada: ${cyclePath}`,
      location: cycle.join(", "), recommendation: `Extrair interface comum ou usar injeção de dependência para quebrar o ciclo entre ${cycle.join(", ")}`, confidence: 0.8 });
  }
  return issues;
}

export function detectUnusedExports(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  if (files.length === 0) return issues;

  const isTestFile = (f: SourceFileInfo) => f.relPath.includes("__tests__/") || f.relPath.endsWith(".test.ts");
  const exportRegex = /^export\s+(?:function|const|class|interface|type|enum)\s+(\w+)/gm;

  for (const file of files) {
    if (file.basename === "index" || file.fullPath.includes("/bin/")) continue;

    const exports: string[] = [];
    let match;
    while ((match = exportRegex.exec(file.content)) !== null) {
      if (match[1]) exports.push(match[1]);
    }

    for (const symbol of exports) {
      const isImported = files.some((other) => {
        if (other.fullPath === file.fullPath) return false;
        if (isTestFile(other) && !isTestFile(file)) return false;
        const wordBoundary = new RegExp(`\\b${symbol}\\b`);
        return wordBoundary.test(other.content);
      });

      if (!isImported) {
        issues.push({
          type: "unused_export",
          severity: 1,
          description: `Export não usado: "${symbol}" em "${file.relPath}" — nunca é importado por outro módulo`,
          location: file.relPath,
          recommendation: `Remover export "${symbol}" de "${file.relPath}" ou adicionar import no módulo que o utiliza`,
          confidence: 0.65,
        });
      }
    }
  }
  return issues;
}
