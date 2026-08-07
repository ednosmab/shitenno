import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import {
  generateProjectFingerprint,
  saveFingerprint,
  loadFingerprint,
  isFingerprintStale,
  type ProjectFingerprint,
} from "../infrastructure/project-fingerprint.js";
import type { ProjectAnalysis } from "../infrastructure/analyser.js";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockMkdirSync = vi.mocked(mkdirSync);

function makeAnalysis(overrides: Partial<ProjectAnalysis> = {}): ProjectAnalysis {
  return {
    rootDir: "/project",
    hasGit: true,
    hasPackageJson: true,
    hasShitenno: true,
    stack: ["typescript"],
    packageManager: "pnpm",
    monorepo: false,
    packageCount: 1,
    appCount: 0,
    dependencyCount: 10,
    sourceFileCount: 50,
    hasTests: true,
    hasLinter: true,
    hasCI: false,
    hasTypeScript: true,
    totalCommits: 100,
    flatSourceFiles: 0,
    layeredDirs: 0,
    nodeApiImportsOutsideLayers: 0,
    portsConsumed: false,
    boundedContextCoverage: 0,
    contextBoundaryViolations: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── generateProjectFingerprint ─────────────────────────────────────────────

describe("generateProjectFingerprint", () => {
  it("returns a valid fingerprint structure", () => {
    const fp = generateProjectFingerprint("/project", makeAnalysis());
    expect(fp.hash).toBeDefined();
    expect(fp.detectedAt).toBeDefined();
    expect(fp.domain).toBeDefined();
    expect(fp.stack).toBeDefined();
    expect(fp.scale).toBeDefined();
    expect(fp.tooling).toBeDefined();
    expect(fp.version).toBe(1);
  });

  it("generates consistent hash for same input", () => {
    const analysis = makeAnalysis({ stack: ["typescript", "react"] });
    const fp1 = generateProjectFingerprint("/project", analysis);
    const fp2 = generateProjectFingerprint("/project", analysis);
    expect(fp1.hash).toBe(fp2.hash);
  });

  it("generates different hash for different stack", () => {
    const fp1 = generateProjectFingerprint("/project", makeAnalysis({ stack: ["typescript"] }));
    const fp2 = generateProjectFingerprint("/project", makeAnalysis({ stack: ["python"] }));
    expect(fp1.hash).not.toBe(fp2.hash);
  });

  it("hash is 12 hex characters", () => {
    const fp = generateProjectFingerprint("/project", makeAnalysis());
    expect(fp.hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it("includes maturityScore when provided", () => {
    const fp = generateProjectFingerprint("/project", makeAnalysis(), 85);
    expect(fp.maturityScore).toBe(85);
  });

  it("omits maturityScore when not provided", () => {
    const fp = generateProjectFingerprint("/project", makeAnalysis());
    expect(fp.maturityScore).toBeUndefined();
  });

  it("sets detectedAt to current ISO timestamp", () => {
    const before = new Date().toISOString();
    const fp = generateProjectFingerprint("/project", makeAnalysis());
    const after = new Date().toISOString();
    expect(fp.detectedAt >= before).toBe(true);
    expect(fp.detectedAt <= after).toBe(true);
  });
});

// ── Domain detection ───────────────────────────────────────────────────────

describe("domain detection", () => {
  it("detects monorepo", () => {
    const fp = generateProjectFingerprint("/project", makeAnalysis({ monorepo: true }));
    expect(fp.domain).toBe("monorepo");
  });

  it("detects web-app from react", () => {
    const fp = generateProjectFingerprint("/project", makeAnalysis({ stack: ["react", "vite"] }));
    expect(fp.domain).toBe("web-app");
  });

  it("detects api from express", () => {
    const fp = generateProjectFingerprint("/project", makeAnalysis({ stack: ["express"] }));
    expect(fp.domain).toBe("api");
  });

  it("detects cli-tool from commander", () => {
    const fp = generateProjectFingerprint("/project", makeAnalysis({ stack: ["commander"] }));
    expect(fp.domain).toBe("cli-tool");
  });

  it("detects library when no apps and few packages", () => {
    const fp = generateProjectFingerprint("/project", makeAnalysis({ appCount: 0, packageCount: 1 }));
    expect(fp.domain).toBe("library");
  });

  it("returns unknown for unmatched stack", () => {
    const fp = generateProjectFingerprint("/project", makeAnalysis({
      stack: ["random-lib"],
      appCount: 2,
      packageCount: 5,
    }));
    expect(fp.domain).toBe("unknown");
  });

  it("monorepo takes precedence over other domain signals", () => {
    const fp = generateProjectFingerprint("/project", makeAnalysis({
      monorepo: true,
      stack: ["react"],
    }));
    expect(fp.domain).toBe("monorepo");
  });
});

// ── Scale detection ────────────────────────────────────────────────────────

describe("scale detection", () => {
  it("detects tiny scale", () => {
    const fp = generateProjectFingerprint("/project", makeAnalysis({
      sourceFileCount: 5,
      dependencyCount: 3,
    }));
    expect(fp.scale).toBe("tiny");
  });

  it("detects small scale", () => {
    const fp = generateProjectFingerprint("/project", makeAnalysis({
      sourceFileCount: 30,
      dependencyCount: 15,
    }));
    expect(fp.scale).toBe("small");
  });

  it("detects medium scale", () => {
    const fp = generateProjectFingerprint("/project", makeAnalysis({
      sourceFileCount: 150,
      dependencyCount: 60,
    }));
    expect(fp.scale).toBe("medium");
  });

  it("detects large scale", () => {
    const fp = generateProjectFingerprint("/project", makeAnalysis({
      sourceFileCount: 600,
      dependencyCount: 110,
    }));
    expect(fp.scale).toBe("large");
  });

  it("detects enterprise scale", () => {
    const fp = generateProjectFingerprint("/project", makeAnalysis({
      sourceFileCount: 1500,
      dependencyCount: 250,
    }));
    expect(fp.scale).toBe("enterprise");
  });

  it("uses fileCount OR depCount (either triggers scale)", () => {
    const fp = generateProjectFingerprint("/project", makeAnalysis({
      sourceFileCount: 10,
      dependencyCount: 250,
    }));
    expect(fp.scale).toBe("enterprise");
  });
});

// ── Tooling detection ──────────────────────────────────────────────────────

describe("tooling detection", () => {
  it("reflects analysis tooling flags", () => {
    const fp = generateProjectFingerprint("/project", makeAnalysis({
      hasTypeScript: true,
      hasTests: true,
      hasCI: true,
      hasLinter: true,
      monorepo: true,
    }));
    expect(fp.tooling).toEqual({
      typescript: true,
      tests: true,
      ci: true,
      linter: true,
      monorepo: true,
    });
  });

  it("reflects missing tooling", () => {
    const fp = generateProjectFingerprint("/project", makeAnalysis({
      hasTypeScript: false,
      hasTests: false,
      hasCI: false,
      hasLinter: false,
      monorepo: false,
    }));
    expect(fp.tooling).toEqual({
      typescript: false,
      tests: false,
      ci: false,
      linter: false,
      monorepo: false,
    });
  });
});

// ── saveFingerprint ────────────────────────────────────────────────────────

describe("saveFingerprint", () => {
  it("writes fingerprint to fingerprint.json", () => {
    mockExistsSync.mockReturnValue(true);
    const fp = generateProjectFingerprint("/project", makeAnalysis());
    saveFingerprint("/shugo", fp);
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      "/shugo/fingerprint.json",
      JSON.stringify(fp, null, 2),
      "utf-8"
    );
  });

  it("creates directory if it does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    const fp = generateProjectFingerprint("/project", makeAnalysis());
    saveFingerprint("/shugo", fp);
    expect(mockMkdirSync).toHaveBeenCalledWith("/shugo", { recursive: true });
  });

  it("does not create directory if it exists", () => {
    mockExistsSync.mockReturnValue(true);
    const fp = generateProjectFingerprint("/project", makeAnalysis());
    saveFingerprint("/shugo", fp);
    expect(mockMkdirSync).not.toHaveBeenCalled();
  });
});

// ── loadFingerprint ────────────────────────────────────────────────────────

describe("loadFingerprint", () => {
  it("returns parsed fingerprint when file exists", () => {
    const fp = generateProjectFingerprint("/project", makeAnalysis());
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(fp));

    const loaded = loadFingerprint("/shugo");
    expect(loaded).toEqual(fp);
  });

  it("returns null when file does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    expect(loadFingerprint("/shugo")).toBeNull();
  });

  it("returns null when file contains invalid JSON", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("not json");
    expect(loadFingerprint("/shugo")).toBeNull();
  });
});

// ── isFingerprintStale ────────────────────────────────────────────────────

describe("isFingerprintStale", () => {
  it("returns true when no fingerprint exists", () => {
    mockExistsSync.mockReturnValue(false);
    expect(isFingerprintStale("/shugo")).toBe(true);
  });

  it("returns true when fingerprint is older than maxAgeDays", () => {
    const oldFp: ProjectFingerprint = {
      hash: "abc123",
      detectedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      domain: "monorepo",
      stack: ["typescript"],
      scale: "medium",
      tooling: { typescript: true, tests: true, ci: false, linter: false, monorepo: false },
      version: 1,
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(oldFp));

    expect(isFingerprintStale("/shugo", 7)).toBe(true);
  });

  it("returns false when fingerprint is fresh", () => {
    const freshFp: ProjectFingerprint = {
      hash: "abc123",
      detectedAt: new Date().toISOString(),
      domain: "monorepo",
      stack: ["typescript"],
      scale: "medium",
      tooling: { typescript: true, tests: true, ci: false, linter: false, monorepo: false },
      version: 1,
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(freshFp));

    expect(isFingerprintStale("/shugo", 7)).toBe(false);
  });

  it("uses default maxAgeDays of 7", () => {
    const sixDaysAgo: ProjectFingerprint = {
      hash: "abc123",
      detectedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      domain: "monorepo",
      stack: ["typescript"],
      scale: "medium",
      tooling: { typescript: true, tests: true, ci: false, linter: false, monorepo: false },
      version: 1,
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(sixDaysAgo));

    expect(isFingerprintStale("/shugo")).toBe(false);
  });

  it("returns true when fingerprint load fails", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("invalid");
    expect(isFingerprintStale("/shugo")).toBe(true);
  });
});
