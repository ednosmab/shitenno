import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { discoverProject } from "../commands/init/discovery.js";

function makeFixtures(): string {
  const dir = mkdtempSync(join(tmpdir(), "shitenno-disc-"));
  execSync("git init -q", { cwd: dir });
  return dir;
}

describe("discoverProject — governance inventory", () => {
  it("detects opencode.json, AGENTS.md, CODEOWNERS and CI at project root", async () => {
    const dir = makeFixtures();
    try {
      writeFileSync(join(dir, "opencode.json"), "{}", "utf-8");
      writeFileSync(join(dir, "AGENTS.md"), "# Rules", "utf-8");
      writeFileSync(join(dir, "CODEOWNERS"), "* @team", "utf-8");
      mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
      writeFileSync(join(dir, ".github", "workflows", "ci.yml"), "name: CI\n", "utf-8");

      const result = await discoverProject(dir);
      expect(result.inventory.opencodeJson.present).toBe(true);
      expect(result.inventory.agentsFile.present).toBe(true);
      expect(result.inventory.agentsFile.file).toBe("AGENTS.md");
      expect(result.inventory.codeowners.present).toBe(true);
      expect(result.inventory.cis.some((c) => c.includes("ci.yml"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detects CLAUDE.md as an agent file alternative", async () => {
    const dir = makeFixtures();
    try {
      writeFileSync(join(dir, "CLAUDE.md"), "rules", "utf-8");
      const result = await discoverProject(dir);
      expect(result.inventory.agentsFile.present).toBe(true);
      expect(result.inventory.agentsFile.file).toBe("CLAUDE.md");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detects docs/adr* and docs/plans* directories", async () => {
    const dir = makeFixtures();
    try {
      mkdirSync(join(dir, "docs", "adr"), { recursive: true });
      mkdirSync(join(dir, "docs", "adrs"), { recursive: true });
      mkdirSync(join(dir, "docs", "plans"), { recursive: true });
      writeFileSync(join(dir, "docs", "adr", "ADR-001.md"), "# ADR", "utf-8");

      const result = await discoverProject(dir);
      expect(result.inventory.adrDirs.length).toBeGreaterThanOrEqual(1);
      expect(result.inventory.adrDirs.some((d) => d.includes("adr"))).toBe(true);
      expect(result.inventory.plansDirs.length).toBeGreaterThanOrEqual(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns empty inventory for a bare project", async () => {
    const dir = makeFixtures();
    try {
      const result = await discoverProject(dir);
      expect(result.inventory.opencodeJson.present).toBe(false);
      expect(result.inventory.agentsFile.present).toBe(false);
      expect(result.inventory.adrDirs).toHaveLength(0);
      expect(result.inventory.plansDirs).toHaveLength(0);
      expect(result.inventory.codeowners.present).toBe(false);
      expect(result.inventory.contributing.present).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("discovery — read-only audit", () => {
  it("computes a health score without writing any .shitenno directory", async () => {
    const dir = makeFixtures();
    try {
      writeFileSync(join(dir, "index.js"), "console.log('x');\n", "utf-8");

      const before = readdirSync(dir).sort();
      const result = await discoverProject(dir);
      const after = readdirSync(dir).sort();

      expect(typeof result.healthScore).toBe("number");
      expect(result.healthScore).toBeGreaterThanOrEqual(0);
      expect(result.healthScore).toBeLessThanOrEqual(100);
      expect(after).toEqual(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("breaks down issues by severity", async () => {
    const dir = makeFixtures();
    try {
      writeFileSync(join(dir, "index.js"), "console.log('x');\n", "utf-8");
      const result = await discoverProject(dir);
      const total = result.issuesBySeverity[1] + result.issuesBySeverity[2] + result.issuesBySeverity[3];
      expect(total).toBe(result.health.issues.length);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});