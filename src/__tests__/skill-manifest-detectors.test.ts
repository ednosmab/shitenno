/**
 * skill-manifest-detectors.test.ts — Tests for skill manifest audit detectors
 *
 * Validates that:
 * 1. detectOrphanSkillFiles flags skill files without manifest entries
 * 2. detectBrokenSkillManifestEntries flags manifest entries with missing files
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  detectOrphanSkillFiles,
  detectBrokenSkillManifestEntries,
} from "../audit/skill-manifest-detectors.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function createTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "skill-manifest-detector-test-"));
}

function writeSkillFile(dir: string, id: string, content?: string): void {
  const skillsDir = join(dir, "docs", "skills");
  mkdirSync(skillsDir, { recursive: true });
  writeFileSync(
    join(skillsDir, `${id}.md`),
    content ?? `---\nname: ${id}\ndescription: Test skill\n---\n\n# ${id}\nBody.`
  );
}

function writeManifest(dir: string, entries: string): void {
  const govDir = join(dir, "governance");
  mkdirSync(govDir, { recursive: true });
  writeFileSync(join(govDir, "skill-manifest.yaml"), entries, "utf-8");
}

// ── detectOrphanSkillFiles ──────────────────────────────────────────────────

describe("detectOrphanSkillFiles", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty when no docs/skills directory exists", () => {
    const issues = detectOrphanSkillFiles(tmpDir);
    expect(issues).toEqual([]);
  });

  it("returns empty when all skills have manifest entries", () => {
    writeSkillFile(tmpDir, "tdd_workflow");
    writeSkillFile(tmpDir, "clean_code");
    writeManifest(
      tmpDir,
      `skills:\n  - id: tdd_workflow\n    path: docs/skills/tdd_workflow.md\n    mandatory: true\n    priority: 0\n    when:\n      task: implementation\n  - id: clean_code\n    path: docs/skills/clean_code.md\n    priority: 1\n    when:\n      task: implementation\n`
    );

    const issues = detectOrphanSkillFiles(tmpDir);
    expect(issues).toEqual([]);
  });

  it("flags a skill file with no manifest entry", () => {
    writeSkillFile(tmpDir, "orphan_skill");
    writeManifest(
      tmpDir,
      `skills:\n  - id: other_skill\n    path: docs/skills/other_skill.md\n    priority: 0\n    when:\n      task: implementation\n`
    );

    const issues = detectOrphanSkillFiles(tmpDir);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.type).toBe("orphan_skill");
    expect(issues[0]!.severity).toBe(2);
    expect(issues[0]!.description).toContain("orphan_skill");
    expect(issues[0]!.description).toContain("no entry in skill-manifest.yaml");
    expect(issues[0]!.location).toContain("orphan_skill.md");
    expect(issues[0]!.confidence).toBe(0.95);
  });

  it("flags multiple orphan skills", () => {
    writeSkillFile(tmpDir, "skill_a");
    writeSkillFile(tmpDir, "skill_b");
    writeManifest(
      tmpDir,
      `skills:\n  - id: skill_c\n    path: docs/skills/skill_c.md\n    priority: 0\n    when:\n      task: implementation\n`
    );

    const issues = detectOrphanSkillFiles(tmpDir);
    expect(issues).toHaveLength(2);
    const ids = issues.map((i) => i.description);
    expect(ids.some((d) => d.includes("skill_a"))).toBe(true);
    expect(ids.some((d) => d.includes("skill_b"))).toBe(true);
  });

  it("returns empty when manifest does not exist (no IDs to match)", () => {
    // Skill files exist but no manifest — all are orphan by definition,
    // but since manifestIds is empty set, every file is flagged.
    writeSkillFile(tmpDir, "unmanifested");

    const issues = detectOrphanSkillFiles(tmpDir);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.type).toBe("orphan_skill");
  });

  it("ignores non-.md files in skills directory", () => {
    const skillsDir = join(tmpDir, "docs", "skills");
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(join(skillsDir, "readme.txt"), "not a skill");
    writeFileSync(join(skillsDir, "notes.json"), "{}");

    const issues = detectOrphanSkillFiles(tmpDir);
    expect(issues).toEqual([]);
  });

  it("returns valid recommendation text", () => {
    writeSkillFile(tmpDir, "my_skill");
    const issues = detectOrphanSkillFiles(tmpDir);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.recommendation).toContain("my_skill");
    expect(issues[0]!.recommendation).toContain("skill-manifest.yaml");
  });
});

// ── detectBrokenSkillManifestEntries ────────────────────────────────────────

describe("detectBrokenSkillManifestEntries", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty when no manifest exists", () => {
    const issues = detectBrokenSkillManifestEntries(tmpDir);
    expect(issues).toEqual([]);
  });

  it("returns empty when all manifest entries point to existing files", () => {
    writeSkillFile(tmpDir, "tdd_workflow");
    writeManifest(
      tmpDir,
      `skills:\n  - id: tdd_workflow\n    path: docs/skills/tdd_workflow.md\n    mandatory: true\n    priority: 0\n    when:\n      task: implementation\n`
    );

    const issues = detectBrokenSkillManifestEntries(tmpDir);
    expect(issues).toEqual([]);
  });

  it("flags a manifest entry pointing to a non-existent file", () => {
    writeManifest(
      tmpDir,
      `skills:\n  - id: missing_skill\n    path: docs/skills/missing_skill.md\n    priority: 0\n    when:\n      task: implementation\n`
    );

    const issues = detectBrokenSkillManifestEntries(tmpDir);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.type).toBe("broken_skill_manifest_entry");
    expect(issues[0]!.severity).toBe(3);
    expect(issues[0]!.description).toContain("missing_skill");
    expect(issues[0]!.description).toContain("does not exist");
    expect(issues[0]!.confidence).toBe(1.0);
  });

  it("flags only broken entries, not valid ones", () => {
    writeSkillFile(tmpDir, "existing_skill");
    writeManifest(
      tmpDir,
      `skills:\n  - id: existing_skill\n    path: docs/skills/existing_skill.md\n    priority: 0\n    when:\n      task: implementation\n  - id: broken_skill\n    path: docs/skills/broken_skill.md\n    priority: 1\n    when:\n      task: implementation\n`
    );

    const issues = detectBrokenSkillManifestEntries(tmpDir);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.description).toContain("broken_skill");
    expect(issues[0]!.description).not.toContain("existing_skill");
  });

  it("returns empty when manifest has no entries", () => {
    writeManifest(tmpDir, `skills: []\n`);

    const issues = detectBrokenSkillManifestEntries(tmpDir);
    expect(issues).toEqual([]);
  });

  it("returns valid recommendation for broken entry", () => {
    writeManifest(
      tmpDir,
      `skills:\n  - id: typo_skill\n    path: docs/skills/typo_skill.md\n    priority: 0\n    when:\n      task: implementation\n`
    );

    const issues = detectBrokenSkillManifestEntries(tmpDir);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.recommendation).toContain("typo_skill");
    expect(issues[0]!.location).toContain("skill-manifest.yaml");
  });
});
