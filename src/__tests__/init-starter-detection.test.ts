import { describe, it, expect } from "vitest";
import { isStarterProject } from "../commands/init.js";
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

describe("isStarterProject", () => {
  it("returns true for empty project (no files, no commits)", () => {
    expect(isStarterProject(makeAnalysis())).toBe(true);
  });

  it("returns true when sourceFileCount < 10 and totalCommits = 0", () => {
    expect(isStarterProject(makeAnalysis({ sourceFileCount: 5, totalCommits: 0 }))).toBe(true);
  });

  it("returns true when sourceFileCount = 9 and totalCommits = 0", () => {
    expect(isStarterProject(makeAnalysis({ sourceFileCount: 9, totalCommits: 0 }))).toBe(true);
  });

  it("returns false when sourceFileCount >= 10 (active project)", () => {
    expect(isStarterProject(makeAnalysis({ sourceFileCount: 10, totalCommits: 0 }))).toBe(false);
  });

  it("returns false when sourceFileCount = 50 (active project)", () => {
    expect(isStarterProject(makeAnalysis({ sourceFileCount: 50, totalCommits: 0 }))).toBe(false);
  });

  it("returns false when totalCommits >= 1 (has history)", () => {
    expect(isStarterProject(makeAnalysis({ sourceFileCount: 5, totalCommits: 1 }))).toBe(false);
  });

  it("returns false when has many commits", () => {
    expect(isStarterProject(makeAnalysis({ sourceFileCount: 3, totalCommits: 25 }))).toBe(false);
  });

  it("returns false when both sourceFileCount >= 10 and totalCommits >= 1", () => {
    expect(isStarterProject(makeAnalysis({ sourceFileCount: 15, totalCommits: 5 }))).toBe(false);
  });

  it("handles git initialized but no commits (sourceFileCount < 10)", () => {
    expect(isStarterProject(makeAnalysis({ hasGit: true, sourceFileCount: 8, totalCommits: 0 }))).toBe(true);
  });

  it("handles no git but has code (sourceFileCount >= 10)", () => {
    expect(isStarterProject(makeAnalysis({ hasGit: false, sourceFileCount: 15, totalCommits: 0 }))).toBe(false);
  });

  it("handles git initialized, no commits, but has code", () => {
    expect(isStarterProject(makeAnalysis({ hasGit: true, sourceFileCount: 20, totalCommits: 0 }))).toBe(false);
  });
});
