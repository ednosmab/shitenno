/**
 * markdown-plan-engine.test.ts — Tests for MarkdownPlanEngine
 *
 * Validates plan parsing, status detection (including checkbox fallback),
 * and archival operations.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { MarkdownPlanEngine } from "../infrastructure/markdown-plan-engine.js";

describe("MarkdownPlanEngine", () => {
  let tmpDir: string;
  let shitennoDir: string;
  let engine: MarkdownPlanEngine;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `shitenno-md-plan-test-${Date.now()}`);
    shitennoDir = join(tmpDir, "shitenno");
    mkdirSync(join(shitennoDir, "governance", "plans"), { recursive: true });
    mkdirSync(join(shitennoDir, "governance", "plans", "done"), { recursive: true });
    mkdirSync(join(shitennoDir, "governance", "plans", "reference"), { recursive: true });
    engine = new MarkdownPlanEngine(shitennoDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("status detection", () => {
    it("detects 'done' from frontmatter", () => {
      const planPath = join(shitennoDir, "governance", "plans", "test-frontmatter.md");
      writeFileSync(planPath, "# Test Plan\n\n**Status:** Done\n", "utf-8");

      const plans = engine.list();
      const plan = plans.find((p) => p.id === "test-frontmatter");
      expect(plan).toBeUndefined(); // filtered out because status is "done"
    });

    it("detects 'andamento' from frontmatter", () => {
      const planPath = join(shitennoDir, "governance", "plans", "test-andamento.md");
      writeFileSync(planPath, "# Test Plan\n\n**Status:** In Progress\n", "utf-8");

      const plans = engine.list();
      const plan = plans.find((p) => p.id === "test-andamento");
      expect(plan).toBeDefined();
      expect(plan?.status).toBe("andamento");
    });

    it("detects 'done' when all checkboxes are [x]", () => {
      const planPath = join(shitennoDir, "governance", "plans", "test-checkboxes.md");
      writeFileSync(
        planPath,
        "# Checkbox Plan\n\n- [x] Step 1 done\n- [x] Step 2 done\n- [x] Step 3 done\n",
        "utf-8"
      );

      const plans = engine.list();
      const plan = plans.find((p) => p.id === "test-checkboxes");
      expect(plan).toBeUndefined(); // filtered out because all checkboxes are [x]
    });

    it("detects 'andamento' when some checkboxes are [ ]", () => {
      const planPath = join(shitennoDir, "governance", "plans", "test-partial.md");
      writeFileSync(
        planPath,
        "# Partial Plan\n\n- [x] Step 1 done\n- [ ] Step 2 pending\n",
        "utf-8"
      );

      const plans = engine.list();
      const plan = plans.find((p) => p.id === "test-partial");
      expect(plan).toBeDefined();
      expect(plan?.status).toBe("andamento");
    });

    it("detects 'andamento' when no checkboxes and no status field", () => {
      const planPath = join(shitennoDir, "governance", "plans", "test-nostatus.md");
      writeFileSync(planPath, "# Plain Plan\n\nJust some text.\n", "utf-8");

      const plans = engine.list();
      const plan = plans.find((p) => p.id === "test-nostatus");
      expect(plan).toBeDefined();
      expect(plan?.status).toBe("andamento");
    });

    it("detects 'done' from 'concluído' in frontmatter", () => {
      const planPath = join(shitennoDir, "governance", "plans", "test-concluido.md");
      writeFileSync(planPath, "# Test Plan\n\n**Status:** Concluído\n", "utf-8");

      const plans = engine.list();
      const plan = plans.find((p) => p.id === "test-concluido");
      expect(plan).toBeUndefined();
    });
  });

  describe("header normalization", () => {
    it("adds **Status:** Done when all checkboxes are [x] and no status field", () => {
      const planPath = join(shitennoDir, "governance", "plans", "test-normalize-done.md");
      writeFileSync(
        planPath,
        "# Normalize Done\n\n- [x] Step 1\n- [x] Step 2\n",
        "utf-8"
      );

      engine.list(); // triggers parsePlan → normalizePlanHeader

      const content = readFileSync(planPath, "utf-8");
      expect(content).toContain("**Status:** Done");
    });

    it("adds **Status:** In Progress when some checkboxes are [ ] and no status field", () => {
      const planPath = join(shitennoDir, "governance", "plans", "test-normalize-wip.md");
      writeFileSync(
        planPath,
        "# Normalize WIP\n\n- [x] Step 1\n- [ ] Step 2\n",
        "utf-8"
      );

      engine.list();

      const content = readFileSync(planPath, "utf-8");
      expect(content).toContain("**Status:** In Progress");
    });

    it("adds **Status:** In Progress when no checkboxes and no status field", () => {
      const planPath = join(shitennoDir, "governance", "plans", "test-normalize-empty.md");
      writeFileSync(planPath, "# Empty Plan\n\nSome content.\n", "utf-8");

      engine.list();

      const content = readFileSync(planPath, "utf-8");
      expect(content).toContain("**Status:** In Progress");
    });

    it("does not modify plan that already has **Status:**", () => {
      const planPath = join(shitennoDir, "governance", "plans", "test-normalize-existing.md");
      writeFileSync(
        planPath,
        "# Existing Status\n\n**Status:** Paused\n\n- [ ] Step 1\n",
        "utf-8"
      );

      engine.list();

      const content = readFileSync(planPath, "utf-8");
      const statusMatches = content.match(/\*\*Status:\*\*/g);
      expect(statusMatches?.length).toBe(1); // only the original, no duplicate
      expect(content).toContain("**Status:** Paused");
    });

    it("normalized done plan is excluded from active list", () => {
      const planPath = join(shitennoDir, "governance", "plans", "test-normalize-exclude.md");
      writeFileSync(
        planPath,
        "# Exclude Test\n\n- [x] A\n- [x] B\n",
        "utf-8"
      );

      const plans = engine.list();
      const found = plans.find((p) => p.id === "test-normalize-exclude");
      expect(found).toBeUndefined();
    });
  });

  describe("updateStatus", () => {
    it("adds status field when none exists", () => {
      const planPath = join(shitennoDir, "governance", "plans", "test-add-status.md");
      writeFileSync(planPath, "# Test Plan\n\nSome content.\n", "utf-8");

      engine.updateStatus("test-add-status", "done");

      const donePlans = engine.listDone();
      const plan = donePlans.find((p) => p.id === "test-add-status");
      expect(plan).toBeDefined();
      expect(plan?.status).toBe("done");
    });

    it("moves plan to done/ when status is set to done", () => {
      const planPath = join(shitennoDir, "governance", "plans", "test-move.md");
      writeFileSync(planPath, "# Test Plan\n\n**Status:** In Progress\n", "utf-8");

      engine.updateStatus("test-move", "done");

      const donePath = join(shitennoDir, "governance", "plans", "done", "test-move.md");
      const { existsSync } = require("node:fs");
      expect(existsSync(donePath)).toBe(true);
    });
  });
});
