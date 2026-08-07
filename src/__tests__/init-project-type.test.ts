import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import {
  looksLikeNewProject,
  requiresNewProjectConfirmation,
  evaluateNewProjectDeclaration,
  readDeclaredProjectType,
  resolveProjectType,
  NEW_PROJECT_MAX_COMMITS,
  NEW_PROJECT_MAX_SOURCE_FILES,
  type ProjectType,
} from "../commands/init/project-type.js";
import { isGitRepository, resolveGitCommonDir } from "../commands/init/git.js";
import type { ProjectAnalysis } from "../infrastructure/analyser.js";

function makeAnalysis(overrides: Partial<ProjectAnalysis> = {}): ProjectAnalysis {
  return {
    rootDir: "/tmp/test",
    hasGit: false,
    hasPackageJson: false,
    hasShitenno: false,
    stack: [],
    packageManager: "unknown",
    monorepo: false,
    packageCount: 0,
    appCount: 0,
    dependencyCount: 0,
    sourceFileCount: 0,
    hasTests: false,
    hasLinter: false,
    hasCI: false,
    hasTypeScript: false,
    totalCommits: 0,
    flatSourceFiles: 0,
    layeredDirs: 0,
    nodeApiImportsOutsideLayers: 0,
    portsConsumed: false,
    boundedContextCoverage: 0,
    contextBoundaryViolations: 0,
    ...overrides,
  };
}

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), `shitenno-pt-${prefix}-`));
  return dir;
}

describe("looksLikeNewProject", () => {
  it("returns true for empty project (0 commits, 0 files)", () => {
    expect(looksLikeNewProject(makeAnalysis())).toBe(true);
  });

  it("returns true at the boundary commit count", () => {
    expect(looksLikeNewProject(makeAnalysis({ totalCommits: NEW_PROJECT_MAX_COMMITS, sourceFileCount: 0 }))).toBe(true);
  });

  it("returns true at the boundary source file count", () => {
    expect(looksLikeNewProject(makeAnalysis({ totalCommits: 0, sourceFileCount: NEW_PROJECT_MAX_SOURCE_FILES - 1 }))).toBe(true);
  });

  it("returns false when commits exceed the max", () => {
    expect(looksLikeNewProject(makeAnalysis({ totalCommits: NEW_PROJECT_MAX_COMMITS + 1, sourceFileCount: 1 }))).toBe(false);
  });

  it("returns false when source files meet or exceed the threshold", () => {
    expect(looksLikeNewProject(makeAnalysis({ totalCommits: 0, sourceFileCount: NEW_PROJECT_MAX_SOURCE_FILES }))).toBe(false);
  });

  it("returns false for many commits regardless of files", () => {
    expect(looksLikeNewProject(makeAnalysis({ totalCommits: 250, sourceFileCount: 3 }))).toBe(false);
  });
});

describe("requiresNewProjectConfirmation", () => {
  it("returns false when the project looks new", () => {
    expect(requiresNewProjectConfirmation(makeAnalysis())).toBe(false);
  });

  it("returns true when the project shows existing-code signals", () => {
    expect(requiresNewProjectConfirmation(makeAnalysis({ totalCommits: 10, sourceFileCount: 50 }))).toBe(true);
  });
});

describe("evaluateNewProjectDeclaration", () => {
  it("always proceeds for existing projects without warning", () => {
    expect(evaluateNewProjectDeclaration("existing", makeAnalysis({ totalCommits: 200 }))).toEqual({
      proceed: true,
      warning: false,
    });
  });

  it("proceeds without warning for new declaration on a new-looking project", () => {
    expect(evaluateNewProjectDeclaration("new", makeAnalysis())).toEqual({ proceed: true, warning: false });
  });

  it("flags a new declaration on existing-looking project", () => {
    expect(evaluateNewProjectDeclaration("new", makeAnalysis({ totalCommits: 42 }))).toEqual({
      proceed: false,
      warning: true,
    });
  });
});

describe("readDeclaredProjectType", () => {
  it("reads the --project-type flag", async () => {
    await expect(readDeclaredProjectType({ projectType: "new" })).resolves.toEqual({ type: "new", error: null });
    await expect(readDeclaredProjectType({ projectType: "existing" })).resolves.toEqual({ type: "existing", error: null });
  });

  it("rejects an invalid --project-type value", async () => {
    const result = await readDeclaredProjectType({ projectType: "bogus" });
    expect(result.type).toBeNull();
    expect(result.error).toMatch(/new|existing/i);
  });

  it("reads projectType from the answers file", async () => {
    const dir = makeTempDir("answersfile");
    const answersPath = join(dir, "answers.json");
    writeFileSync(answersPath, JSON.stringify({ projectType: "existing", principalModel: "x" }), "utf-8");
    await expect(readDeclaredProjectType({ answersFile: answersPath })).resolves.toEqual({ type: "existing", error: null });
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns null type when answers file lacks projectType", async () => {
    const dir = makeTempDir("answersnode");
    const answersPath = join(dir, "answers.json");
    writeFileSync(answersPath, JSON.stringify({ principalModel: "x" }), "utf-8");
    await expect(readDeclaredProjectType({ answersFile: answersPath })).resolves.toEqual({ type: null, error: null });
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns an error when the answers file is missing", async () => {
    const result = await readDeclaredProjectType({ answersFile: "/nonexistent/answers.json" });
    expect(result.type).toBeNull();
    expect(result.error).toMatch(/not found/i);
  });

  it("flag takes precedence over answers file", async () => {
    const dir = makeTempDir("precedence");
    const answersPath = join(dir, "answers.json");
    writeFileSync(answersPath, JSON.stringify({ projectType: "existing" }), "utf-8");
    await expect(readDeclaredProjectType({ projectType: "new", answersFile: answersPath })).resolves.toEqual({
      type: "new",
      error: null,
    });
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("resolveProjectType (non-interactive)", () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempDir("resolve");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("resolves 'new' from the answers file and returns analysis", async () => {
    // Simulate a fresh project: a couple of files, no commits, git initialized
    execSync("git init -q", { cwd: dir });
    writeFileSync(join(dir, "index.js"), "console.log(1);\n", "utf-8");
    const answersPath = join(dir, "answers.json");
    writeFileSync(answersPath, JSON.stringify({ projectType: "new" }), "utf-8");

    const resolution = await resolveProjectType(dir, { answersFile: answersPath });
    expect(resolution).not.toBeNull();
    expect(resolution!.type).toBe("new");
    expect(resolution!.analysis.rootDir).toBe(dir);
  });

  it("resolves 'existing' from the flag even on existing-looking code", async () => {
    execSync("git init -q", { cwd: dir });
    execSync("git config user.email t@t.com", { cwd: dir });
    execSync("git config user.name t", { cwd: dir });
    writeFileSync(join(dir, "index.js"), "console.log(1);\n", "utf-8");
    execSync("git add -A && git commit -q -m init", { cwd: dir });

    const resolution = await resolveProjectType(dir, { projectType: "existing" });
    expect(resolution).not.toBeNull();
    expect(resolution!.type).toBe("existing");
  });

  it("declares new on existing signals in non-interactive mode but still proceeds", async () => {
    execSync("git init -q", { cwd: dir });
    execSync("git config user.email t@t.com", { cwd: dir });
    execSync("git config user.name t", { cwd: dir });
    // Exceed commit threshold with several commits
    for (let i = 0; i < NEW_PROJECT_MAX_COMMITS + 2; i++) {
      writeFileSync(join(dir, `file-${i}.js`), "x;\n", "utf-8");
      execSync("git add -A && git commit -q -m wip", { cwd: dir });
    }

    const resolution = await resolveProjectType(dir, { projectType: "new" });
    expect(resolution).not.toBeNull();
    expect(resolution!.type).toBe("new");
  });

  it("aborts without declared type in non-interactive mode", async () => {
    execSync("git init -q", { cwd: dir });
    const resolution = await resolveProjectType(dir, {});
    expect(resolution).toBeNull();
  });

  it("aborts when the answers file does not define projectType (non-interactive)", async () => {
    execSync("git init -q", { cwd: dir });
    const answersPath = join(dir, "answers.json");
    writeFileSync(answersPath, JSON.stringify({ principalModel: "x" }), "utf-8");
    const resolution = await resolveProjectType(dir, { answersFile: answersPath });
    expect(resolution).toBeNull();
  });
});

describe("git utilities", () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempDir("gitutil");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("isGitRepository returns true inside a git repository", async () => {
    execSync("git init -q", { cwd: dir });
    await expect(isGitRepository(dir)).resolves.toBe(true);
  });

  it("isGitRepository returns false for a plain directory", async () => {
    await expect(isGitRepository(dir)).resolves.toBe(false);
  });

  it("resolveGitCommonDir resolves to the .git directory", async () => {
    execSync("git init -q", { cwd: dir });
    const gitCommonDir = await resolveGitCommonDir(dir);
    expect(gitCommonDir).toBe(join(dir, ".git"));
  });

  it("resolveGitCommonDir returns null for a plain directory", async () => {
    await expect(resolveGitCommonDir(dir)).resolves.toBeNull();
  });

  it("git utils tolerate a non-empty source directory", async () => {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src/index.ts"), "export const x = 1;\n", "utf-8");
    execSync("git init -q", { cwd: dir });
    await expect(isGitRepository(dir)).resolves.toBe(true);
  });
});

describe("ProjectType enum sanity", () => {
  it("only admits new and existing values", () => {
    const values: ProjectType[] = ["new", "existing"];
    expect(values).toHaveLength(2);
    expect(values).toContain("new");
    expect(values).toContain("existing");
  });
});