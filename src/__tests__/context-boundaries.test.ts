import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { walkSourceFiles } from "../infrastructure/utils.js";
import { contextOfModule } from "../domain/types/context-map.js";
import { isAllowedContextEdge } from "../domain/rules/context-dependencies.js";
import { analyseContextBoundaries } from "../infrastructure/context-boundary.js";

const REPO_ROOT = process.cwd();

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-contexts-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function writeModule(relPath: string, content: string): void {
  const full = join(tempDir, relPath);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
}

describe("contextOfModule (registry)", () => {
  it("resolves every source module in the repository", () => {
    if (!existsSync(join(REPO_ROOT, "src"))) return;
    const unmapped: string[] = [];
    walkSourceFiles(join(REPO_ROOT, "src"), (fullPath, fileName) => {
      const rel = relative(REPO_ROOT, fullPath).replace(/\\/g, "/");
      if (rel.includes("/__tests__/") || rel.includes("/templates/") || rel.includes("/__fixtures__/")) return;
      if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(rel)) return;
      if (fileName.endsWith(".d.ts")) return;
      if (contextOfModule(rel) === null) unmapped.push(rel);
    });
    expect(unmapped).toEqual([]);
  });

  it("maps layer directories to their context", () => {
    expect(contextOfModule("src/rule-engine/engine.ts")).toBe("governance");
    expect(contextOfModule("src/audit/security/scan.ts")).toBe("intelligence");
    expect(contextOfModule("src/plan/lifecycle.ts")).toBe("planning");
    expect(contextOfModule("src/feedback/core.ts")).toBe("feedback");
    expect(contextOfModule("src/knowledge-graph/graph.ts")).toBe("knowledge");
    expect(contextOfModule("src/commands/status.ts")).toBe("interface");
    expect(contextOfModule("src/domain/types/constants.ts")).toBe("domain");
    expect(contextOfModule("src/shared/logger.ts")).toBe("shared");
  });

  it("maps application facades to the context they expose", () => {
    expect(contextOfModule("src/application/rule-engine.ts")).toBe("governance");
    expect(contextOfModule("src/application/scorer.ts")).toBe("intelligence");
    expect(contextOfModule("src/application/briefing.ts")).toBe("briefing");
  });

  it("maps infrastructure flat files to their context", () => {
    expect(contextOfModule("src/infrastructure/event-bus.ts")).toBe("ops");
    expect(contextOfModule("src/infrastructure/analyser.ts")).toBe("intelligence");
    expect(contextOfModule("src/infrastructure/knowledge-graph.ts")).toBe("knowledge");
  });

  it("returns null for unmapped directories", () => {
    expect(contextOfModule("src/unknown-dir/thing.ts")).toBeNull();
  });
});

describe("isAllowedContextEdge", () => {
  it("allows imports into core, platform and entry contexts", () => {
    for (const from of ["governance", "intelligence", "planning", "briefing", "feedback", "knowledge"] as const) {
      for (const to of ["domain", "shared", "ops", "interface"] as const) {
        expect(isAllowedContextEdge(from, to), `${from}->${to}`).toBe(true);
      }
    }
  });

  it("allows the interface and ops contexts to consume any context", () => {
    for (const to of ["governance", "intelligence", "planning", "briefing", "feedback", "knowledge"] as const) {
      expect(isAllowedContextEdge("interface", to), `interface->${to}`).toBe(true);
      expect(isAllowedContextEdge("ops", to), `ops->${to}`).toBe(true);
    }
  });

  it("allows same-context imports", () => {
    expect(isAllowedContextEdge("planning", "planning")).toBe(true);
  });

  it("allows declared edges between business contexts", () => {
    expect(isAllowedContextEdge("governance", "intelligence")).toBe(true);
    expect(isAllowedContextEdge("intelligence", "governance")).toBe(true);
    expect(isAllowedContextEdge("planning", "intelligence")).toBe(true);
    expect(isAllowedContextEdge("knowledge", "governance")).toBe(true);
  });

  it("rejects undeclared edges between business contexts", () => {
    expect(isAllowedContextEdge("feedback", "planning")).toBe(false);
    expect(isAllowedContextEdge("planning", "feedback")).toBe(false);
    expect(isAllowedContextEdge("knowledge", "planning")).toBe(false);
  });
});

describe("analyseContextBoundaries", () => {
  it("reports full coverage and zero violations for the repository itself", () => {
    if (!existsSync(join(REPO_ROOT, "src"))) return;
    const report = analyseContextBoundaries(REPO_ROOT);
    expect(report.totalModules).toBeGreaterThan(0);
    expect(report.mappedModules).toBe(report.totalModules);
    expect(report.coverage).toBe(1);
    expect(report.violations).toEqual([]);
  });

  it("reports zero modules for a project without src", () => {
    const report = analyseContextBoundaries(tempDir);
    expect(report.totalModules).toBe(0);
    expect(report.coverage).toBe(0);
    expect(report.violations).toEqual([]);
  });

  it("detects a cross-context import that is not declared", () => {
    writeModule("src/feedback/a.ts", 'import { x } from "../planning/b.js";\nexport const a = x;\n');
    writeModule("src/planning/b.ts", "export const b = 1;\n");
    const report = analyseContextBoundaries(tempDir);
    expect(report.totalModules).toBe(2);
    expect(report.coverage).toBe(1);
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]?.from).toBe("feedback");
    expect(report.violations[0]?.to).toBe("planning");
  });

  it("accepts a declared cross-context edge", () => {
    writeModule("src/governance/a.ts", 'import { x } from "../intelligence/b.js";\nexport const a = x;\n');
    writeModule("src/intelligence/b.ts", "export const b = 1;\n");
    const report = analyseContextBoundaries(tempDir);
    expect(report.violations).toEqual([]);
  });

  it("ignores imports of free contexts and same-context modules", () => {
    writeModule("src/feedback/a.ts", 'import { l } from "../shared/logger.js";\nimport { s } from "./b.js";\nexport const a = l + s;\n');
    writeModule("src/feedback/b.ts", "export const b = 1;\n");
    const report = analyseContextBoundaries(tempDir);
    expect(report.violations).toEqual([]);
  });

  it("reports lower coverage when modules are not mapped", () => {
    writeModule("src/feedback/a.ts", "export const a = 1;\n");
    writeModule("src/weird/x.ts", "export const x = 1;\n");
    const report = analyseContextBoundaries(tempDir);
    expect(report.totalModules).toBe(2);
    expect(report.mappedModules).toBe(1);
    expect(report.coverage).toBeLessThan(1);
  });
});
