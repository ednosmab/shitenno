import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { applyByLevel, backupExistingConfigs, REPLACEABLE_ROOT_FILES } from "../commands/init/apply.js";
import { resolveMcpCommand } from "../commands/init/mcp.js";
import { discoverProject } from "../commands/init/discovery.js";
import { SHITENNO_DIR_NAME } from "../domain/types/constants.js";

function makeDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), `shitenno-apply-${prefix}-`));
  execSync("git init -q", { cwd: dir });
  execSync("git config user.email t@t.com", { cwd: dir });
  execSync("git config user.name t", { cwd: dir });
  return dir;
}

async function discoveryFor(dir: string) {
  return discoverProject(dir);
}

describe("resolveMcpCommand (Phase 8 — MCP path)", () => {
  it("defaults to the PATH-resolved 'shugo' binary", () => {
    expect(resolveMcpCommand("/nonexistent/project")).toEqual({ command: "shugo", args: ["mcp"] });
  });

  it("uses the relative local binary when shitenno is a local dependency", () => {
    const dir = makeDir("mcplocal");
    try {
      const binary = join(dir, "node_modules", "shitenno", "dist", "bin");
      mkdirSync(binary, { recursive: true });
      writeFileSync(join(binary, "shugo.js"), "#!/usr/bin/env node\n", "utf-8");
      const resolved = resolveMcpCommand(dir);
      expect(resolved.command).toMatch(/node_modules\/shitenno\/dist\/bin\/shugo\.js$/);
      expect(resolved.command).not.toBe("shugo");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("opencode.json template (Phase 8)", () => {
  it("does not reference the relative ./dist path — uses PATH-resolved shugo", () => {
    const templatePath = new URL("../../src/templates/base/opencode.json", import.meta.url);
    const content = readFileSync(templatePath, "utf-8");
    expect(content).not.toContain("./dist/bin/shugo.js");
    expect(content).toContain('"shugo"');
  });
});

describe("backupExistingConfigs (Level 2)", () => {
  it("backs up only the replaceable files that actually exist", () => {
    const dir = makeDir("backup");
    try {
      writeFileSync(join(dir, "opencode.json"), JSON.stringify({ model: "original" }), "utf-8");
      // .gitignore and .mcp.json intentionally absent

      const backups = backupExistingConfigs(dir, join(dir, SHITENNO_DIR_NAME));

      expect(backups).toEqual(["opencode.json"]);
      const backupDir = join(dir, SHITENNO_DIR_NAME, "backup", "pre-init");
      expect(existsSync(join(backupDir, "opencode.json"))).toBe(true);
      expect(JSON.parse(readFileSync(join(backupDir, "opencode.json"), "utf-8"))).toEqual({ model: "original" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("backs up all replaceable files when present", () => {
    const dir = makeDir("backupall");
    try {
      writeFileSync(join(dir, "opencode.json"), "{}", "utf-8");
      writeFileSync(join(dir, ".mcp.json"), "{}", "utf-8");
      writeFileSync(join(dir, ".gitignore"), "node_modules\n", "utf-8");

      const backups = backupExistingConfigs(dir, join(dir, SHITENNO_DIR_NAME));
      expect(backups.sort()).toEqual([".gitignore", ".mcp.json", "opencode.json"].sort());
      expect(REPLACEABLE_ROOT_FILES.length).toBeGreaterThanOrEqual(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("applyByLevel — Level 1 (observation)", () => {
  it("creates only .shitenno/ — no root opencode.json, no .gitignore change, no .mcp.json", async () => {
    const dir = makeDir("lvl1");
    try {
      writeFileSync(join(dir, "opencode.json"), JSON.stringify({ model: "user-config" }), "utf-8");
      writeFileSync(join(dir, ".gitignore"), "node_modules\n", "utf-8");
      const gitignoreBefore = readFileSync(join(dir, ".gitignore"), "utf-8");
      const discovery = await discoveryFor(dir);

      const result = await applyByLevel(dir, discovery, 1);

      expect(existsSync(join(dir, SHITENNO_DIR_NAME))).toBe(true);
      // Root opencode.json untouched (byte-identical)
      expect(readFileSync(join(dir, "opencode.json"), "utf-8")).toBe(JSON.stringify({ model: "user-config" }));
      // .gitignore untouched
      expect(readFileSync(join(dir, ".gitignore"), "utf-8")).toBe(gitignoreBefore);
      // No .mcp.json, no backup dir
      expect(existsSync(join(dir, ".mcp.json"))).toBe(false);
      expect(existsSync(join(dir, SHITENNO_DIR_NAME, "backup"))).toBe(false);
      expect(result.backups).toEqual([]);
      expect(result.filesCreated.some((f) => f === "opencode.json")).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("applyByLevel — Level 2 (full integration)", () => {
  it("creates root config, backs up originals, and produces a manifest", async () => {
    const dir = makeDir("lvl2");
    try {
      writeFileSync(join(dir, "opencode.json"), JSON.stringify({ model: "original" }), "utf-8");
      const discovery = await discoveryFor(dir);

      const result = await applyByLevel(dir, discovery, 2);

      // Root config replaced
      expect(existsSync(join(dir, "opencode.json"))).toBe(true);
      expect(result.filesCreated).toContain("opencode.json");
      // Backup preserved the original
      const backupPath = join(dir, SHITENNO_DIR_NAME, "backup", "pre-init", "opencode.json");
      expect(existsSync(backupPath)).toBe(true);
      expect(JSON.parse(readFileSync(backupPath, "utf-8"))).toEqual({ model: "original" });
      // Manifest exists
      expect(existsSync(join(dir, SHITENNO_DIR_NAME, "manifest.json"))).toBe(true);
      // .mcp.json registered by default
      expect(existsSync(join(dir, ".mcp.json"))).toBe(true);
      // .gitignore gained shugo entries
      const gitignore = readFileSync(join(dir, ".gitignore"), "utf-8");
      expect(gitignore).toContain(SHITENNO_DIR_NAME);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not write .mcp.json when explicitly disabled", async () => {
    const dir = makeDir("lvl2nomcp");
    try {
      const discovery = await discoveryFor(dir);
      await applyByLevel(dir, discovery, 2, { enableMcpRegistration: false });
      expect(existsSync(join(dir, ".mcp.json"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("applyByLevel — write scope", () => {
  it("Level 1 writes nothing outside the target directory", async () => {
    const dir = makeDir("scope");
    try {
      const discovery = await discoveryFor(dir);
      const before = readdirSync(dir).sort();
      await applyByLevel(dir, discovery, 1);
      const after = readdirSync(dir).sort();
      // Only new entries: .shitenno (a single new top-level entry)
      const newEntries = after.filter((e) => !before.includes(e));
      expect(newEntries).toEqual([SHITENNO_DIR_NAME]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("applyByLevel — external-index manifest (Fase 5)", () => {
  it("writes .shitenno/docs/external-index.json referencing existing ADRs without copying them", async () => {
    const dir = makeDir("manifest");
    try {
      mkdirSync(join(dir, "docs", "adr"), { recursive: true });
      writeFileSync(join(dir, "docs", "adr", "ADR-001.md"), "# ADR", "utf-8");
      const discovery = await discoveryFor(dir);

      await applyByLevel(dir, discovery, 1);

      const manifestPath = join(dir, SHITENNO_DIR_NAME, "docs", "external-index.json");
      expect(existsSync(manifestPath)).toBe(true);
      const raw = JSON.parse(readFileSync(manifestPath, "utf-8"));
      const paths = raw.refs.map((r: { path: string }) => r.path);
      expect(paths).toContain(join("docs", "adr", "ADR-001.md"));
      // The ADR was NOT copied into .shitenno
      expect(existsSync(join(dir, SHITENNO_DIR_NAME, "docs", "adr"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not create the manifest when the project has no knowledge artifacts", async () => {
    const dir = makeDir("nomanifest");
    try {
      const discovery = await discoveryFor(dir);
      await applyByLevel(dir, discovery, 1);
      expect(
        existsSync(join(dir, SHITENNO_DIR_NAME, "docs", "external-index.json")),
      ).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("re-anchors manifest refs to repo-relative paths when applying in a sibling worktree", async () => {
    const project = makeDir("wtproj");
    const worktree = join(project, "..", `${project.split("/").pop()}-wt`);
    try {
      mkdirSync(join(project, "docs", "adr"), { recursive: true });
      writeFileSync(join(project, "docs", "adr", "ADR-001.md"), "# ADR", "utf-8");
      mkdirSync(worktree, { recursive: true });
      mkdirSync(join(worktree, "docs", "adr"), { recursive: true });
      writeFileSync(join(worktree, "docs", "adr", "ADR-001.md"), "# ADR", "utf-8");

      const discovery = await discoveryFor(project);
      await applyByLevel(worktree, discovery, 1, { projectRoot: project });

      const manifestPath = join(worktree, SHITENNO_DIR_NAME, "docs", "external-index.json");
      const raw = JSON.parse(readFileSync(manifestPath, "utf-8"));
      const paths = raw.refs.map((r: { path: string }) => r.path);
      expect(paths).toContain(join("docs", "adr", "ADR-001.md"));
      expect(paths.some((p: string) => p.startsWith(".."))).toBe(false);
    } finally {
      rmSync(project, { recursive: true, force: true });
      rmSync(worktree, { recursive: true, force: true });
    }
  });
});