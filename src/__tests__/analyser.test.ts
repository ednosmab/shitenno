import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analyseProject } from "../infrastructure/analyser.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-analyser-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("analyseProject", () => {
  it("detects basic project properties", () => {
    const result = analyseProject(tempDir);
    expect(result.rootDir).toBe(tempDir);
    expect(result.hasGit).toBe(false);
    expect(result.hasPackageJson).toBe(false);
    expect(result.hasShitenno).toBe(false);
  });

  it("detects git repository", () => {
    mkdirSync(join(tempDir, ".git"), { recursive: true });
    const result = analyseProject(tempDir);
    expect(result.hasGit).toBe(true);
  });

  it("detects package.json and counts dependencies", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({
        dependencies: { react: "^18.0.0", next: "^14.0.0" },
        devDependencies: { typescript: "^5.0.0" },
      })
    );
    const result = analyseProject(tempDir);
    expect(result.hasPackageJson).toBe(true);
    expect(result.dependencyCount).toBe(3);
    expect(result.stack).toContain("react");
    expect(result.stack).toContain("nextjs");
  });

  it("detects monorepo with packages/", () => {
    mkdirSync(join(tempDir, "packages", "core"), { recursive: true });
    writeFileSync(
      join(tempDir, "packages", "core", "package.json"),
      "{}"
    );
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ workspaces: ["packages/*"] })
    );
    const result = analyseProject(tempDir);
    expect(result.monorepo).toBe(true);
    expect(result.packageCount).toBe(1);
  });

  it("detects monorepo with apps/", () => {
    mkdirSync(join(tempDir, "apps", "web"), { recursive: true });
    writeFileSync(
      join(tempDir, "apps", "web", "package.json"),
      "{}"
    );
    const result = analyseProject(tempDir);
    expect(result.appCount).toBe(1);
  });

  it("detects TypeScript", () => {
    writeFileSync(join(tempDir, "tsconfig.json"), "{}");
    const result = analyseProject(tempDir);
    expect(result.hasTypeScript).toBe(true);
  });

  it("detects pnpm package manager", () => {
    writeFileSync(join(tempDir, "pnpm-lock.yaml"), "");
    const result = analyseProject(tempDir);
    expect(result.packageManager).toBe("pnpm");
  });

  it("detects yarn package manager", () => {
    writeFileSync(join(tempDir, "yarn.lock"), "");
    const result = analyseProject(tempDir);
    expect(result.packageManager).toBe("yarn");
  });

  it("detects npm package manager", () => {
    writeFileSync(join(tempDir, "package-lock.json"), "");
    const result = analyseProject(tempDir);
    expect(result.packageManager).toBe("npm");
  });

  it("detects tests", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ devDependencies: { vitest: "^1.0.0" } })
    );
    const result = analyseProject(tempDir);
    expect(result.hasTests).toBe(true);
  });

  it("detects linter", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ devDependencies: { eslint: "^9.0.0" } })
    );
    const result = analyseProject(tempDir);
    expect(result.hasLinter).toBe(true);
  });

  it("detects CI", () => {
    mkdirSync(join(tempDir, ".github", "workflows"), { recursive: true });
    const result = analyseProject(tempDir);
    expect(result.hasCI).toBe(true);
  });

  it("counts source files", () => {
    writeFileSync(join(tempDir, "a.ts"), "");
    writeFileSync(join(tempDir, "b.tsx"), "");
    mkdirSync(join(tempDir, "sub"), { recursive: true });
    writeFileSync(join(tempDir, "sub", "c.js"), "");
    const result = analyseProject(tempDir);
    expect(result.sourceFileCount).toBe(3);
  });

  it("detects full stack (react + tailwind + zod)", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({
        dependencies: { react: "^18", "react-dom": "^18" },
        devDependencies: { tailwindcss: "^3", zod: "^3" },
      })
    );
    const result = analyseProject(tempDir);
    expect(result.stack).toContain("react");
    expect(result.stack).toContain("tailwindcss");
    expect(result.stack).toContain("zod");
  });

  it("counts flat source files in src root only", () => {
    mkdirSync(join(tempDir, "src", "domain"), { recursive: true });
    writeFileSync(join(tempDir, "src", "a.ts"), "");
    writeFileSync(join(tempDir, "src", "b.tsx"), "");
    writeFileSync(join(tempDir, "src", "nested.ts"), "");
    writeFileSync(join(tempDir, "src", "index.d.ts"), "");
    writeFileSync(join(tempDir, "src", "domain", "c.ts"), "");
    const result = analyseProject(tempDir);
    expect(result.flatSourceFiles).toBe(3);
  });

  it("counts recognized layer directories", () => {
    for (const layer of ["shared", "domain", "application", "infrastructure", "interface"]) {
      mkdirSync(join(tempDir, "src", layer), { recursive: true });
    }
    mkdirSync(join(tempDir, "src", "features"), { recursive: true });
    const result = analyseProject(tempDir);
    expect(result.layeredDirs).toBe(5);
  });

  it("counts node imports outside the adapter layers", () => {
    mkdirSync(join(tempDir, "src", "application"), { recursive: true });
    mkdirSync(join(tempDir, "src", "infrastructure"), { recursive: true });
    mkdirSync(join(tempDir, "src", "__tests__"), { recursive: true });
    writeFileSync(join(tempDir, "src", "application", "usecase.ts"), 'import { readFileSync } from "node:fs";\n');
    writeFileSync(join(tempDir, "src", "application", "pure.ts"), 'export const x = 1;\n');
    writeFileSync(join(tempDir, "src", "infrastructure", "adapter.ts"), 'import { join } from "node:path";\n');
    writeFileSync(join(tempDir, "src", "__tests__", "spec.test.ts"), 'import { readFileSync } from "node:fs";\n');
    const result = analyseProject(tempDir);
    expect(result.nodeApiImportsOutsideLayers).toBe(1);
  });

  it("detects port consumption outside the domain layer", () => {
    mkdirSync(join(tempDir, "src", "domain", "ports"), { recursive: true });
    mkdirSync(join(tempDir, "src", "application"), { recursive: true });
    writeFileSync(join(tempDir, "src", "domain", "ports", "logger.ts"), "export interface Logger {}\n");
    writeFileSync(join(tempDir, "src", "application", "usecase.ts"), 'import type { Logger } from "../domain/ports/logger.js";\n');
    const result = analyseProject(tempDir);
    expect(result.portsConsumed).toBe(true);
  });

  it("does not report port consumption when only domain references ports", () => {
    mkdirSync(join(tempDir, "src", "domain", "ports"), { recursive: true });
    writeFileSync(join(tempDir, "src", "domain", "ports", "logger.ts"), "export interface Logger {}\n");
    writeFileSync(join(tempDir, "src", "domain", "index.ts"), 'export type { Logger } from "./ports/logger.js";\n');
    const result = analyseProject(tempDir);
    expect(result.portsConsumed).toBe(false);
  });
});
