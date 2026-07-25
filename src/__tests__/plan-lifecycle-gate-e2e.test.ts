/**
 * plan-lifecycle-gate-e2e.test.ts — Gate verification e2e tests
 *
 * Tests the 3 core scenarios:
 * 1. Positive: all checks pass → plan moves to done/ with verification.json
 * 2. Negative: one check fails → plan blocked, stays in plans/
 * 3. Invalidation: code changes after verification → diffHash mismatch
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Capture the REAL execSync BEFORE mocking the module
const { execSync: realExecSync } = await import("node:child_process");

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  const realFn = actual.execSync;
  return {
    ...actual,
    execSync: vi.fn((cmd: string, opts?: any) => {
      // Intercept commands that require external tools not available in temp dirs
      if (cmd.includes("vitest run src/__tests__/plan-lifecycle-gate-e2e")) {
        return "ok";
      }
      // checkBuild runs `npx tsc --noEmit` — temp dirs have no node_modules
      if (cmd.includes("tsc")) {
        return "ok";
      }
      if (cmd.includes("sync:docs")) {
        syncDocsCallCount++;
        if (syncDocsCallCount <= syncDocsFailCount) {
          throw new Error("Documentation sync failed");
        }
      }
      return realFn(cmd, opts);
    }),
  };
});

import { MarkdownPlanEngine } from "../markdown-plan-engine.js";
import { runAutoVerification, checkDocumentation } from "../plan-lifecycle.js";

// Track sync:docs call behavior for auto-fix tests
let syncDocsFailCount = 0;
let syncDocsCallCount = 0;

describe("Bloco F — gate de done, caso positivo, negativo e invalidação por diffHash", () => {
  let dir: string;
  let shitennoDir: string;

  beforeEach(() => {
    syncDocsFailCount = 0;
    syncDocsCallCount = 0;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    dir = join(tmpdir(), `shugo-gate-e2e-${Date.now()}`);
    shitennoDir = join(dir, ".shitenno");
    mkdirSync(shitennoDir, { recursive: true });

    // Create a package.json with scripts that succeed by default
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify(
        { scripts: { build: "echo ok", test: "echo ok", lint: "echo ok" } },
        null,
        2
      )
    );



    realExecSync("git init -q", { cwd: dir });
    realExecSync("git config user.email 'test@test.com'", { cwd: dir });
    realExecSync("git config user.name 'Test'", { cwd: dir });
    writeFileSync(join(dir, "app.ts"), "export const version = 1;\n");
    realExecSync("git add -A && git commit -q -m init", { cwd: dir });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  it("caso positivo: build+test+lint passam → done/ com sidecar e diffHash consistente", async () => {
    writeFileSync(join(dir, "app.ts"), "export const version = 2;\n");

    const engine = new MarkdownPlanEngine(shitennoDir);
    const plan = engine.create({ title: "Plano de teste — caso positivo" });
    engine.updateStatus(plan.id, "check");

    const record = await runAutoVerification(shitennoDir, dir, plan.id);
    // Must match computeDiffHash() in plan/verification.ts: uses --stat HEAD, truncated to 16 chars
    const expectedDiff = realExecSync(`git diff --stat HEAD`, {
      cwd: dir,
      encoding: "utf-8",
    });
    const expectedHash = createHash("sha256")
      .update(expectedDiff)
      .digest("hex")
      .slice(0, 16);

    const doneMd = join(
      shitennoDir,
      "governance",
      "plans",
      "done",
      `${plan.id}.md`
    );
    const doneJson = join(
      shitennoDir,
      "governance",
      "plans",
      "done",
      `${plan.id}.verification.json`
    );
    expect(existsSync(doneMd)).toBe(true);
    expect(existsSync(doneJson)).toBe(true);
    expect(record.checks.map((c) => c.name)).toEqual(
      expect.arrayContaining(["BUILD", "TESTS", "LINT", "GATE_SELF_TEST"])
    );
    expect(record.passed).toBe(true);
    expect(record.diffHash).toBe(expectedHash);
  });

  it("caso negativo: um check falha → refused, NÃO vai para done/", async () => {
    // Override test script to fail — real execSync will run it and it will exit 1
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify(
        { scripts: { build: "echo ok", test: "exit 1", lint: "echo ok" } },
        null,
        2
      )
    );

    const engine = new MarkdownPlanEngine(shitennoDir);
    const plan = engine.create({ title: "Plano de teste — caso negativo" });
    engine.updateStatus(plan.id, "check");

    const record = await runAutoVerification(shitennoDir, dir, plan.id);

    expect(record.passed).toBe(false);
    expect(engine.getById(plan.id)!.status).toBe("refused");
    expect(
      existsSync(
        join(shitennoDir, "governance", "plans", "done", `${plan.id}.md`)
      )
    ).toBe(false);
    expect(
      existsSync(
        join(
          shitennoDir,
          "governance",
          "plans",
          "done",
          `${plan.id}.verification.json`
        )
      )
    ).toBe(false);
  });

  it("auto-fix: sync:docs fails first time → runs --fix → re-verifies → passes", () => {
    syncDocsFailCount = 1; // 1st sync:docs call fails, 2nd (re-verify) passes
    syncDocsCallCount = 0;

    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify(
        { scripts: { build: "echo ok", test: "echo ok", lint: "echo ok", "sync:docs": "echo ok" } },
        null,
        2
      )
    );

    const result = checkDocumentation(dir);
    expect(result.passed).toBe(true);
    expect(result.message).toBe("Documentation auto-fixed");
    expect(syncDocsCallCount).toBe(3); // validate + fix + re-verify
  });

  it("auto-fix: sync:docs fails always → refuses with auto-fix attempted message", () => {
    syncDocsFailCount = 10; // All sync:docs calls fail
    syncDocsCallCount = 0;

    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify(
        { scripts: { build: "echo ok", test: "echo ok", lint: "echo ok", "sync:docs": "echo ok" } },
        null,
        2
      )
    );

    const result = checkDocumentation(dir);
    expect(result.passed).toBe(false);
    expect(result.message).toContain("auto-fix attempted");
  });

  it("auto-fix: no sync:docs script → skips (no auto-fix needed)", () => {
    // package.json without sync:docs script
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify(
        { scripts: { build: "echo ok", test: "echo ok", lint: "echo ok" } },
        null,
        2
      )
    );

    const result = checkDocumentation(dir);
    expect(result.passed).toBe(true);
    expect(result.message).toContain("No sync:docs script");
  });

  it("caso de invalidação: código muda depois da verificação → diffHash não bate", async () => {
    const engine = new MarkdownPlanEngine(shitennoDir);
    const plan = engine.create({
      title: "Plano de teste — invalidação por diffHash",
    });
    engine.updateStatus(plan.id, "check");
    writeFileSync(join(dir, "app.ts"), "export const version = 2;\n");

    const record = await runAutoVerification(shitennoDir, dir, plan.id);

    writeFileSync(join(dir, "app.ts"), "export const version = 3;\n");
    realExecSync("git add -A", { cwd: dir });
    const stagedDiff = realExecSync(`git diff --stat HEAD`, {
      cwd: dir,
      encoding: "utf-8",
    });
    const stagedHash = createHash("sha256")
      .update(stagedDiff)
      .digest("hex")
      .slice(0, 16);

    expect(stagedHash).not.toBe(record.diffHash);
  });
});
