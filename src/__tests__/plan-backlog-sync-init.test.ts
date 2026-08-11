import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getEventBus } from "../infrastructure/event-bus.js";
import { initPlanBacklogSync } from "../application/plan-backlog-sync.js";
import { parseBacklogItems } from "../infrastructure/backlog-parser.js";

describe("plan-backlog-sync initialization", () => {
  let dir: string;
  let shitennoDir: string;
  let subscribeSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "plan-sync-init-"));
    shitennoDir = join(dir, ".shitenno");
    mkdirSync(join(shitennoDir, "docs", "backlog"), { recursive: true });
    subscribeSpy = vi.spyOn(getEventBus(), "subscribe");
  });

  beforeEach(() => {
    writeFileSync(
      join(shitennoDir, "docs", "backlog", "ACTIVE.md"),
      [
        "# Backlog",
        "",
        "### BACKLOG-PLAN_A Plano A",
        "",
        "| Campo | Valor |",
        "|---|---|",
        "| **Status** | planeado |",
        "",
      ].join("\n")
    );
    subscribeSpy.mockClear();
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("registers one subscriber per sync event", () => {
    initPlanBacklogSync(dir, shitennoDir);

    const subscribed = subscribeSpy.mock.calls.map((call: unknown[]) => String(call[0]));
    expect(subscribed).toContain("plan.created");
    expect(subscribed).toContain("plan.file_changed");
    expect(subscribed).toContain("plan.archived");
  });

  it("syncs plan checklist progress into backlog status on plan.file_changed", () => {
    initPlanBacklogSync(dir, shitennoDir);

    getEventBus().publish("plan.file_changed", {
      planId: "PLAN-A",
      path: "governance/plans/PLAN-A.md",
      content: [
        "# Plano A",
        "",
        "## Checklist",
        "",
        "- [x] Task 1",
        "- [ ] Task 2",
      ].join("\n"),
    });

    const items = parseBacklogItems(join(shitennoDir, "docs", "backlog", "ACTIVE.md"));
    const item = items.find((i) => i.id === "BACKLOG-PLAN_A");
    expect(item?.state).toBe("em implementação");
  });

  it("marks backlog item concluído when all checklist items are checked", () => {
    initPlanBacklogSync(dir, shitennoDir);

    getEventBus().publish("plan.file_changed", {
      planId: "PLAN-A",
      path: "governance/plans/PLAN-A.md",
      content: [
        "# Plano A",
        "",
        "## Checklist",
        "",
        "- [x] Task 1",
        "- [x] Task 2",
      ].join("\n"),
    });

    const items = parseBacklogItems(join(shitennoDir, "docs", "backlog", "ACTIVE.md"));
    const item = items.find((i) => i.id === "BACKLOG-PLAN_A");
    expect(item?.state).toBe("concluído");
  });

  it("keeps state planeado when checklist has no checked items", () => {
    initPlanBacklogSync(dir, shitennoDir);

    getEventBus().publish("plan.file_changed", {
      planId: "PLAN-A",
      path: "governance/plans/PLAN-A.md",
      content: [
        "# Plano A",
        "",
        "## Checklist",
        "",
        "- [ ] Task 1",
        "- [ ] Task 2",
      ].join("\n"),
    });

    const items = parseBacklogItems(join(shitennoDir, "docs", "backlog", "ACTIVE.md"));
    const item = items.find((i) => i.id === "BACKLOG-PLAN_A");
    expect(item?.state).toBe("planeado");
  });
});
