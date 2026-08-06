/**
 * periodic-audit-score-isolation.test.ts — runPeriodicAudit metric isolation
 *
 * An incremental (delta) audit measures issues introduced by the recent
 * changeset and must NOT overwrite the overall health score — otherwise a small
 * delta with clustered severe findings would mathematically zero the score.
 * Full sweeps (forceFull) update health normally.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { createDaemonState } from "../daemon/state.js";

let gitDir: string;

function setupGitRepoWithDelta(): string {
  const dir = mkdtempSync(join(tmpdir(), "periodic-audit-"));
  execSync("git init -q", { cwd: dir });
  execSync("git config user.email test@example.com", { cwd: dir });
  execSync("git config user.name Test", { cwd: dir });
  writeFileSync(join(dir, "base.txt"), "v1");
  execSync("git add -A && git commit -qm 'base'", { cwd: dir });
  writeFileSync(join(dir, "changed.txt"), "v2");
  execSync("git add -A && git commit -qm 'delta'", { cwd: dir });
  return dir;
}

function makeCtx(projectRoot: string) {
  return {
    shitennoDir: "/tmp/shitenno",
    projectRoot,
    daemonDir: "/tmp/daemon",
    pidPath: "/tmp/daemon/pid",
    sockPath: "/tmp/daemon/sock",
    logPath: "/tmp/daemon/log",
    approvedPath: "/tmp/daemon/approved",
    statePath: "/tmp/daemon/state.json",
    socket: {} as never,
    stopProactive: () => {},
    stopWatcher: () => {},
    state: createDaemonState(),
  };
}

vi.mock("../application/health-auditor.js", () => ({
  auditHealth: vi.fn(),
}));

import { runPeriodicAudit } from "../daemon/timers.js";
import { auditHealth } from "../application/health-auditor.js";

describe("runPeriodicAudit — metric isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gitDir = setupGitRepoWithDelta();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(gitDir, { recursive: true, force: true });
  });

  it("incremental audit (changedFiles present) does NOT overwrite ctx.state.health.score", async () => {
    const ctx = makeCtx(gitDir);
    ctx.state.health = { score: 83, previousScore: 80, checkedAt: "2026-08-02T00:00:00.000Z" };

    // Small delta with clustered severe findings — the scenario that used to zero the score.
    vi.mocked(auditHealth).mockResolvedValue({
      healthScore: 0,
      issues: Array.from({ length: 30 }, (_, i) => ({ id: `i${i}`, severity: 3, confidence: 1 })),
      auditedAt: "2026-08-02T01:00:00.000Z",
    } as never);

    await runPeriodicAudit(ctx);

    expect(ctx.state.health.score).toBe(83);
    expect(ctx.state.lastDeltaAudit).not.toBeNull();
    expect(ctx.state.lastDeltaAudit!.newIssueCount).toBeGreaterThan(0);
  });

  it("full sweep (forceFull) updates health normally even with a degraded report", async () => {
    const ctx = makeCtx(gitDir);

    vi.mocked(auditHealth).mockResolvedValue({
      healthScore: 42,
      issues: [{ id: "x1", severity: 3, confidence: 1 }],
      auditedAt: "2026-08-02T02:00:00.000Z",
    } as never);

    await runPeriodicAudit(ctx, true);

    expect(ctx.state.health?.score).toBe(42);
    expect(ctx.state.lastDeltaAudit).toBeNull();
  });

  it("full sweep preserves previousScore for trend computation", async () => {
    const ctx = makeCtx(gitDir);
    ctx.state.health = { score: 83, previousScore: 80, checkedAt: "2026-08-02T00:00:00.000Z" };

    vi.mocked(auditHealth).mockResolvedValue({
      healthScore: 85,
      issues: [],
      auditedAt: "2026-08-02T03:00:00.000Z",
    } as never);

    await runPeriodicAudit(ctx, true);

    expect(ctx.state.health?.score).toBe(85);
    expect(ctx.state.health?.previousScore).toBe(83);
  });
});
