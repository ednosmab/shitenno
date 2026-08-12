/**
 * skill-command.test.ts — Tests for shugo skill create / list / validate
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSkillFile, listSkillFiles, validateSkillFile } from "../infrastructure/skill-io.js";

describe("skill command utilities", () => {
  let tempDir: string;
  let skillsDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "shitenno-skill-test-"));
    skillsDir = join(tempDir, ".shitenno", "docs", "skills");
    mkdirSync(skillsDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("createSkillFile", () => {
    it("should create a skill file with valid frontmatter", () => {
      const result = createSkillFile(skillsDir, "my-new-skill", "This is a test skill");

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
      expect(existsSync(result.filePath!)).toBe(true);

      const content = readFileSync(result.filePath!, "utf-8");
      expect(content).toContain("---");
      expect(content).toContain("name: my-new-skill");
      expect(content).toContain("description: This is a test skill");
    });

    it("should not overwrite existing skill file", () => {
      const result = createSkillFile(skillsDir, "my-new-skill", "Duplicate");

      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
    });

    it("should sanitize skill name to valid filename", () => {
      const result = createSkillFile(skillsDir, "My Skill Name!", "Description");

      expect(result.success).toBe(true);
      expect(result.filePath).toContain("my-skill-name.md");
    });

    it("should include template sections in skill body", () => {
      const result = createSkillFile(skillsDir, "template-test", "Test skill");

      expect(result.success).toBe(true);
      const content = readFileSync(result.filePath!, "utf-8");
      expect(content).toContain("# Template Test");
      expect(content).toContain("## When to Use");
      expect(content).toContain("## Instructions");
    });

    it("should include governance frontmatter (category, lifecycle) in template", () => {
      const result = createSkillFile(skillsDir, "gov-template-test", "Test skill");

      expect(result.success).toBe(true);
      const content = readFileSync(result.filePath!, "utf-8");
      expect(content).toContain("category: engineering");
      expect(content).toContain("lifecycle: Active");
    });
  });

  describe("listSkillFiles", () => {
    it("should list all skill files in directory", () => {
      createSkillFile(skillsDir, "list-test-1", "First skill");
      createSkillFile(skillsDir, "list-test-2", "Second skill");

      const skills = listSkillFiles(skillsDir);
      const names = skills.map((s: { name: string }) => s.name);

      expect(names).toContain("list-test-1");
      expect(names).toContain("list-test-2");
    });

    it("should return empty array for non-existent directory", () => {
      const skills = listSkillFiles(join(tempDir, "nonexistent"));
      expect(skills).toEqual([]);
    });

    it("should return name and filename for each skill", () => {
      const skills = listSkillFiles(skillsDir);
      for (const skill of skills) {
        expect(skill).toHaveProperty("name");
        expect(skill).toHaveProperty("filename");
        expect(skill.filename).toMatch(/\.md$/);
      }
    });
  });

  describe("validateSkillFile", () => {
    it("should validate a well-formed skill file", () => {
      createSkillFile(skillsDir, "valid-skill", "A valid skill description");

      const result = validateSkillFile(join(skillsDir, "valid-skill.md"));
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing frontmatter", () => {
      const filePath = join(skillsDir, "no-frontmatter.md");
      writeFileSync(filePath, "# No Frontmatter\n\nJust a heading.", "utf-8");

      const result = validateSkillFile(filePath);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e: string) => e.includes("frontmatter"))).toBe(true);
    });

    it("should detect missing name field", () => {
      const filePath = join(skillsDir, "missing-name.md");
      writeFileSync(filePath, "---\ndescription: >\n  Has description but no name\n---\n\n# Content", "utf-8");

      const result = validateSkillFile(filePath);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes("name"))).toBe(true);
    });

    it("should detect missing description field", () => {
      const filePath = join(skillsDir, "missing-desc.md");
      writeFileSync(filePath, "---\nname: missing-desc\n---\n\n# Content", "utf-8");

      const result = validateSkillFile(filePath);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes("description"))).toBe(true);
    });

    it("should detect empty skill body", () => {
      const filePath = join(skillsDir, "empty-body.md");
      writeFileSync(filePath, "---\nname: empty-body\ndescription: >\n  Has desc\n---\n", "utf-8");

      const result = validateSkillFile(filePath);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes("body"))).toBe(true);
    });

    it("should detect missing category field", () => {
      const filePath = join(skillsDir, "missing-category.md");
      writeFileSync(filePath, "---\nname: missing-category\ndescription: >\n  Has desc\nlifecycle: Active\n---\n\n# Content", "utf-8");

      const result = validateSkillFile(filePath);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes("category"))).toBe(true);
    });

    it("should detect missing lifecycle field", () => {
      const filePath = join(skillsDir, "missing-lifecycle.md");
      writeFileSync(filePath, "---\nname: missing-lifecycle\ndescription: >\n  Has desc\ncategory: engineering\n---\n\n# Content", "utf-8");

      const result = validateSkillFile(filePath);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes("lifecycle"))).toBe(true);
    });

    it("should reject invalid lifecycle value", () => {
      const filePath = join(skillsDir, "invalid-lifecycle.md");
      writeFileSync(filePath, "---\nname: invalid-lifecycle\ndescription: >\n  Has desc\ncategory: engineering\nlifecycle: Forever\n---\n\n# Content", "utf-8");

      const result = validateSkillFile(filePath);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes("lifecycle"))).toBe(true);
    });

    it("should validate a skill with governance frontmatter", () => {
      const filePath = join(skillsDir, "governed-skill.md");
      writeFileSync(filePath, "---\nname: governed-skill\ndescription: Has full frontmatter\ncategory: engineering\nlifecycle: Active\n---\n\n# Content\n\n## Purpose\n\nInstructions here.", "utf-8");

      const result = validateSkillFile(filePath);
      expect(result.valid).toBe(true);
    });

    it("should validate a skill with folded (YAML >) description", () => {
      const filePath = join(skillsDir, "folded-desc-skill.md");
      writeFileSync(filePath, "---\nname: folded-desc-skill\ndescription: >\n  First folded line\n  Second folded line\ncategory: engineering\nlifecycle: Active\n---\n\n# Content\n\n## Purpose\n\nInstructions here.", "utf-8");

      const result = validateSkillFile(filePath);
      expect(result.valid).toBe(true);
    });
  });
});
