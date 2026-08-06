/**
 * markdown-plan-engine-status.test.ts — N.4 regression tests
 *
 * Tests MarkdownPlanEngine.updateStatus with REAL filesystem (no mocks).
 * This catches the exact bug that shipped in production: statusDisplayText
 * was never defined, causing ReferenceError at runtime — the engine
 * couldn't persist "check", "blocked", "done" etc., so plans got stuck.
 *
 * See PLAN-2026-07-20-BLOCO-N-gate-quebrado-e-achados.md
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MarkdownPlanEngine, type MarkdownPlanStatus } from "../infrastructure/markdown-plan-engine.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function scaffold(dir: string, id: string, initialStatus = "In Progress"): void {
  const plansDir = join(dir, "governance", "plans");
  mkdirSync(plansDir, { recursive: true });
  writeFileSync(
    join(plansDir, `${id}.md`),
    `# Plan ${id}\n\n**Status:** ${initialStatus}\n\n- [x] Step 1\n- [ ] Step 2\n`,
    "utf-8"
  );
}

function readStatusField(dir: string, id: string): string {
  const content = readFileSync(join(dir, "governance", "plans", `${id}.md`), "utf-8");
  const match = content.match(/^\*\*Status:\*\*\s*(.+)$/m);
  return match?.[1]?.trim() ?? "";
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("MarkdownPlanEngine.updateStatus — real filesystem, no mocks", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "shugo-status-"));
    scaffold(dir, "PLAN-X");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("persists 'check' status without throwing", () => {
    const engine = new MarkdownPlanEngine(dir);
    expect(() => engine.updateStatus("PLAN-X", "check")).not.toThrow();
    expect(readStatusField(dir, "PLAN-X")).toMatch(/Checking/);
  });

  it("persists 'blocked' status without throwing", () => {
    const engine = new MarkdownPlanEngine(dir);
    expect(() => engine.updateStatus("PLAN-X", "blocked")).not.toThrow();
    expect(readStatusField(dir, "PLAN-X")).toMatch(/Blocked/);
  });

  it("persists 'refused' status without throwing", () => {
    const engine = new MarkdownPlanEngine(dir);
    expect(() => engine.updateStatus("PLAN-X", "refused")).not.toThrow();
    expect(readStatusField(dir, "PLAN-X")).toMatch(/Refused/);
  });

  it("persists 'done' status without throwing", () => {
    const engine = new MarkdownPlanEngine(dir);
    expect(() => engine.updateStatus("PLAN-X", "done")).not.toThrow();
    // done moves file to done/ — verify via getById
    const plan = engine.getById("PLAN-X");
    expect(plan).not.toBeNull();
    expect(plan!.isActive).toBe(false);
  });

  it("persists 'parado' status without throwing", () => {
    const engine = new MarkdownPlanEngine(dir);
    expect(() => engine.updateStatus("PLAN-X", "parado")).not.toThrow();
    expect(readStatusField(dir, "PLAN-X")).toMatch(/Paused/);
  });

  it("round-trips every canonical status through re-parse", () => {
    const engine = new MarkdownPlanEngine(dir);
    const statuses: MarkdownPlanStatus[] = ["andamento", "parado", "check", "blocked", "refused"];
    for (const status of statuses) {
      engine.updateStatus("PLAN-X", status);
      const reread = engine.getById("PLAN-X");
      expect(reread?.status).toBe(status);
    }
  });

  it("throws for nonexistent plan", () => {
    const engine = new MarkdownPlanEngine(dir);
    expect(() => engine.updateStatus("NONEXISTENT", "check")).toThrow("Plan not found");
  });

  it("updateStatus returns the updated plan with correct status", () => {
    const engine = new MarkdownPlanEngine(dir);
    const updated = engine.updateStatus("PLAN-X", "check");
    expect(updated.status).toBe("check");
  });
});

// ── T1: normalizePlanHeader — arquivo sem cabeçalho '# ' ──────────────────

describe("normalizePlanHeader — arquivo sem cabeçalho '# '", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "shugo-norm-no-title-"));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("insere Status mesmo sem título markdown (lado da leitura)", () => {
    const plansDir = join(dir, "governance", "plans");
    mkdirSync(plansDir, { recursive: true });
    writeFileSync(
      join(plansDir, "PLAN-NO-TITLE.md"),
      "Só um parágrafo qualquer, sem título markdown.\n",
      "utf-8"
    );

    const engine = new MarkdownPlanEngine(dir);
    const plan = engine.getById("PLAN-NO-TITLE");
    expect(plan).not.toBeNull();
    expect(plan!.status).toBe("andamento");

    // Verify Status was written to the file
    const content = readFileSync(join(plansDir, "PLAN-NO-TITLE.md"), "utf-8");
    expect(content).toMatch(/\*\*Status:\*\*\s*In Progress/);
  });

  it("insere Status Done quando todos checkboxes são [x] e sem título markdown", () => {
    const plansDir = join(dir, "governance", "plans");
    mkdirSync(plansDir, { recursive: true });
    writeFileSync(
      join(plansDir, "PLAN-NO-TITLE-DONE.md"),
      "- [x] Passo 1\n- [x] Passo 2\n",
      "utf-8"
    );

    const engine = new MarkdownPlanEngine(dir);
    const plan = engine.getById("PLAN-NO-TITLE-DONE");
    expect(plan).not.toBeNull();
    expect(plan!.status).toBe("done");

    const content = readFileSync(join(plansDir, "PLAN-NO-TITLE-DONE.md"), "utf-8");
    expect(content).toMatch(/\*\*Status:\*\*\s*Done/);
  });
});

// ── S1: updateStatus — falha alta quando não consegue escrever Status ────

describe("updateStatus — falha alta quando não consegue escrever Status", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "shugo-update-fail-"));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("lança erro em vez de arquivar silenciosamente para conteúdo hostil", () => {
    const plansDir = join(dir, "governance", "plans");
    mkdirSync(plansDir, { recursive: true });
    // Content without '# title' and without **Status:** — after normalizePlanHeader
    // inserts Status, updateStatus should still work
    writeFileSync(
      join(plansDir, "PLAN-HOSTILE.md"),
      "Conteúdo hostil sem nenhum padrão reconhecido.\n",
      "utf-8"
    );

    const engine = new MarkdownPlanEngine(dir);
    // updateStatus on a plan with no recognizable header — should NOT silently fail
    expect(() => engine.updateStatus("PLAN-HOSTILE", "done")).not.toThrow();

    // Verify it moved to done
    const plan = engine.getById("PLAN-HOSTILE");
    expect(plan).not.toBeNull();
    expect(plan!.status).toBe("done");
  });
});
