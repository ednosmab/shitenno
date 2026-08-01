/**
 * coupling.ts — Coupling and Consistency Architecture Detectors
 *
 * Detects module coupling, import order violations, and test structure issues.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../logger.js";
import type { HealthIssue, SourceFileInfo } from "../types.js";

// ── 4.5 Module Coupling Score ───────────────────────────────────────────────

export function detectModuleCoupling(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  const importRegex = /import\s+.*?\s+from\s+["'](\.[^"']+)["']/g;

  const coupling = new Map<string, { afferent: Set<string>; efferent: Set<string> }>();
  const MAX_FILES = 200;

  for (const file of files) {
    if (coupling.size > MAX_FILES) break;
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const fileKey = file.basename;
    if (!coupling.has(fileKey)) {
      coupling.set(fileKey, { afferent: new Set(), efferent: new Set() });
    }

    let match;
    importRegex.lastIndex = 0;
    while ((match = importRegex.exec(file.content)) !== null) {
      const dep = match[1]?.split("/").pop()?.replace(/\.js$/, "") ?? "";
      if (dep && dep !== fileKey) {
        coupling.get(fileKey)!.efferent.add(dep);
        if (!coupling.has(dep)) {
          coupling.set(dep, { afferent: new Set(), efferent: new Set() });
        }
        coupling.get(dep)!.afferent.add(fileKey);
      }
    }
  }

  const hubs: { name: string; connections: number }[] = [];
  for (const [name, { afferent, efferent }] of coupling) {
    const total = afferent.size + efferent.size;
    if (total > 15) {
      hubs.push({ name, connections: total });
    }
  }

  hubs.sort((a, b) => b.connections - a.connections);

  if (hubs.length > 0) {
    const hubList = hubs.slice(0, 5).map((h) => `${h.name} (${h.connections} conexões)`).join(", ");
    issues.push({
      type: "high_coupling",
      severity: 2,
      description: `${hubs.length} módulo(s) com acoplamento elevado: ${hubList}`,
      location: "src/",
      recommendation: "Reduzir acoplamento: extrair interfaces, usar DI, limitar imports a ≤5 por módulo.",
      confidence: 0.65,
    });
  }

  return issues;
}

// ── 4.6 Import Consistency ──────────────────────────────────────────────────

export function detectImportConsistency(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const lines = file.content.split("\n");
    let lastBuiltIn = -1;
    let lastExternal = -1;
    let lastInternal = -1;
    let violations = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (!line.includes("import") || !line.includes("from")) continue;

      const isBuiltIn = line.includes("node:");
      const isExternal = !isBuiltIn && !line.includes("./") && !line.includes("../");

      if (isBuiltIn) {
        lastBuiltIn = i;
      } else if (isExternal) {
        lastExternal = i;
      } else {
        lastInternal = i;
      }

      if (lastInternal > 0 && (lastBuiltIn > lastInternal || lastExternal > lastInternal)) {
        violations++;
      }
    }

    if (violations > 2) {
      issues.push({
        type: "import_order_violation",
        severity: 1,
        description: `"${file.basename}" tem ${violations} imports fora da ordem conveniente (builtins → external → internal)`,
        location: file.relPath,
        recommendation: "Ordem: 1) node:* 2) packages externos 3) módulos internos (./).",
        confidence: 0.65,
      });
    }
  }

  return issues;
}

// ── 4.7 Test Structure Validation ───────────────────────────────────────────

function findSourceDir(projectRoot: string): string {
  for (const candidate of ["src", "app", "lib", "source"]) {
    const dir = join(projectRoot, candidate);
    if (existsSync(dir)) return dir;
  }
  return join(projectRoot, "src");
}

export function detectTestStructure(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const srcDir = findSourceDir(projectRoot);
  const testsDir = join(srcDir, "__tests__");
  if (!existsSync(testsDir)) return issues;

  try {
    const testFiles = readdirSync(testsDir).filter((f) => f.endsWith(".test.ts"));
    const srcDirs = readdirSync(srcDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((d) => d !== "__tests__" && d !== "templates");

    const flatTestCount = testFiles.filter((f) => {
      const baseName = f.replace(/\.test\.ts$/, "");
      return srcDirs.some((d) => existsSync(join(srcDir, d, `${baseName}.ts`)));
    }).length;

    if (flatTestCount > 10) {
      issues.push({
        type: "flat_test_structure",
        severity: 1,
        description: `${flatTestCount} test(es) em __tests__/ flat que testam módulos em subdirectorios — considerar espelhar estrutura`,
        location: "src/__tests__/",
        recommendation: "Reorganizar: src/__tests__/commands/, src/__tests__/audit/, etc.",
        confidence: 0.95,
      });
    }
  } catch {
    logger.debug("architecture", "Failed to scan test structure");
  }

  return issues;
}
