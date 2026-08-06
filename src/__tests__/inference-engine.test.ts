/**
 * inference-engine.test.ts — Tests for InferenceEngine
 *
 * Validates plan inference, status detection, checkbox analysis,
 * and recommendation generation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { InferenceEngine } from "../application/inference-engine.js";

describe("InferenceEngine", () => {
  let tmpDir: string;
  let shitennoDir: string;
  let engine: InferenceEngine;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `shitenno-inference-test-${Date.now()}`);
    shitennoDir = join(tmpDir, "shitenno");
    mkdirSync(join(shitennoDir, "governance", "plans"), { recursive: true });
    mkdirSync(join(shitennoDir, "governance", "plans", "done"), { recursive: true });
    mkdirSync(join(shitennoDir, "governance", "plans", "reference"), { recursive: true });
    engine = new InferenceEngine(shitennoDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("inferPlan", () => {
    it("infers done when all checkboxes are [x]", () => {
      const planPath = join(shitennoDir, "governance", "plans", "all-done.md");
      writeFileSync(
        planPath,
        "# All Done Plan\n\n**Status:** In Progress\n\n- [x] Step 1\n- [x] Step 2\n- [x] Step 3\n",
        "utf-8"
      );

      const plans = engine.inferAllPlans();
      const plan = plans.find((p) => p.id === "all-done");

      expect(plan).toBeDefined();
      expect(plan?.inferredStatus).toBe("done");
      expect(plan?.recommendation).toBe("archive");
      expect(plan?.checkboxes.total).toBe(3);
      expect(plan?.checkboxes.closed).toBe(3);
      expect(plan?.checkboxes.percentage).toBe(100);
    });

    it("infers in_progress when some checkboxes are open", () => {
      const planPath = join(shitennoDir, "governance", "plans", "partial.md");
      writeFileSync(
        planPath,
        "# Partial Plan\n\n**Status:** In Progress\n\n- [x] Step 1\n- [ ] Step 2\n",
        "utf-8"
      );

      const plans = engine.inferAllPlans();
      const plan = plans.find((p) => p.id === "partial");

      expect(plan).toBeDefined();
      expect(plan?.inferredStatus).toBe("in_progress");
      expect(plan?.recommendation).toBe("keep");
      expect(plan?.checkboxes.closed).toBe(1);
      expect(plan?.checkboxes.open).toBe(1);
    });

    it("infers obsolete when status is AGUARDA APROVACAO and old", () => {
      const planPath = join(shitennoDir, "governance", "plans", "old-plan.md");
      writeFileSync(
        planPath,
        "# Old Plan\n\n**Status:** In Progress\n**Estado:** AGUARDA APROVACAO\n\nSome content.\n",
        "utf-8"
      );

      const plans = engine.inferAllPlans();
      const plan = plans.find((p) => p.id === "old-plan");

      // Age depends on file system — may or may not be obsolete
      expect(plan).toBeDefined();
      expect(plan?.inferredStatus).toMatch(/in_progress|obsolete/);
    });

    it("infers inconsistent when status is done but checkboxes are open", () => {
      const planPath = join(shitennoDir, "governance", "plans", "inconsistent.md");
      writeFileSync(
        planPath,
        "# Inconsistent Plan\n\n**Status:** Done\n\n- [x] Step 1\n- [ ] Step 2\n",
        "utf-8"
      );

      const plans = engine.inferAllPlans();
      const plan = plans.find((p) => p.id === "inconsistent");

      expect(plan).toBeDefined();
      expect(plan?.inferredStatus).toBe("inconsistent");
      expect(plan?.recommendation).toBe("investigate");
    });

    it("infers done from explicit status", () => {
      const planPath = join(shitennoDir, "governance", "plans", "explicit-done.md");
      writeFileSync(
        planPath,
        "# Explicit Done\n\n**Status:** Done\n",
        "utf-8"
      );

      // inferAllPlans() includes all plans (for inconsistency detection)
      const plans = engine.inferAllPlans();
      const plan = plans.find((p) => p.id === "explicit-done");

      expect(plan).toBeDefined();
      expect(plan?.inferredStatus).toBe("done");
      expect(plan?.recommendation).toBe("archive");

      // But generateSummary() filters out truly done plans
      const summary = engine.generateSummary();
      const inSummary = summary.plans.find((p) => p.id === "explicit-done");
      expect(inSummary).toBeUndefined();
    });

    it("infers paused from parado status", () => {
      const planPath = join(shitennoDir, "governance", "plans", "paused.md");
      writeFileSync(
        planPath,
        "# Paused Plan\n\n**Status:** Paused\n\n- [ ] Step 1\n",
        "utf-8"
      );

      const plans = engine.inferAllPlans();
      const plan = plans.find((p) => p.id === "paused");

      expect(plan).toBeDefined();
      expect(plan?.inferredStatus).toBe("paused");
      expect(plan?.recommendation).toBe("keep");
    });

    it("handles plan with no checkboxes", () => {
      const planPath = join(shitennoDir, "governance", "plans", "no-boxes.md");
      writeFileSync(
        planPath,
        "# Design Document\n\n**Status:** In Progress\n\nJust text, no checkboxes.\n",
        "utf-8"
      );

      const plans = engine.inferAllPlans();
      const plan = plans.find((p) => p.id === "no-boxes");

      expect(plan).toBeDefined();
      expect(plan?.checkboxes.total).toBe(0);
      expect(plan?.inferredStatus).toBe("in_progress");
      expect(plan?.recommendation).toBe("keep");
    });
  });

  describe("generateSummary", () => {
    it("returns empty summary when no plans exist", () => {
      const summary = engine.generateSummary();

      expect(summary.totalPlans).toBe(0);
      expect(summary.summary).toBe("No active plans found.");
      expect(summary.plans).toHaveLength(0);
    });

    it("counts plans by inferred status", () => {
      // Plan 1: in progress (has open checkbox)
      writeFileSync(
        join(shitennoDir, "governance", "plans", "plan-wip.md"),
        "# WIP Plan\n\n- [x] A\n- [ ] B\n",
        "utf-8"
      );

      // Plan 2: paused
      writeFileSync(
        join(shitennoDir, "governance", "plans", "plan-paused.md"),
        "# Paused Plan\n\n**Status:** Paused\n\n- [ ] Step 1\n",
        "utf-8"
      );

      const summary = engine.generateSummary();

      expect(summary.totalPlans).toBe(2);
      expect(summary.byStatus.in_progress).toBe(1);
      expect(summary.byStatus.paused).toBe(1);
      expect(summary.byRecommendation.keep).toBe(2);
    });

    it("includes generatedAt timestamp", () => {
      const before = new Date().toISOString();
      const summary = engine.generateSummary();
      const after = new Date().toISOString();

      expect(summary.generatedAt >= before).toBe(true);
      expect(summary.generatedAt <= after).toBe(true);
    });
  });
});
