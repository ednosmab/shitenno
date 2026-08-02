import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  normalizeState,
  isValidTransition,
  getAllowedTransitions,
  findShortestPath,
  parseBacklogItems,
  findItem,
  addItem,
  deleteItem,
  transitionItem,
  moveItemToDone,
  getBacklogSummary,
  formatSummaryLine,
  type BacklogItem,
} from "../backlog-core.js";

// ── Helpers ────────────────────────────────────────────────────────────────

const LEGACY_HEADER = `| ID | Title | Priority | Status |\n|---|---|---|---|\n`;

function legacyRow(id: string, title: string, priority: string, status: string): string {
  return `| ${id} | ${title} | ${priority} | ${status} |`;
}

const MODULAR_HEADER = `# BACKLOG — Active Items\n\n## P0 Critical\n\n`;

function modularItem(id: string, title: string, status: string, priority = "P0"): string {
  return [
    `### ${id} ${title}`,
    "",
    "| Campo | Valor |",
    "|---|---|",
    `| **Status** | ${status} |`,
    `| **Severidade** | Alto |`,
    `| **Prioridade** | ${priority} |`,
    `| **Owner** | unassigned |`,
    `| **Data** | 2026-01-01 |`,
    `| **Fonte** | manual |`,
    `| **Descricao** | Test item |`,
    "",
  ].join("\n");
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("backlog-core", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `backlog-core-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  // ── normalizeState ─────────────────────────────────────────────────────

  describe("normalizeState", () => {
    it("returns canonical state for exact Portuguese names", () => {
      expect(normalizeState("planeado")).toBe("planeado");
      expect(normalizeState("em investigação")).toBe("em investigação");
      expect(normalizeState("em implementação")).toBe("em implementação");
      expect(normalizeState("em validação")).toBe("em validação");
      expect(normalizeState("pausado")).toBe("pausado");
      expect(normalizeState("adiado")).toBe("adiado");
      expect(normalizeState("concluído")).toBe("concluído");
      expect(normalizeState("encerrado")).toBe("encerrado");
    });

    it("normalizes English aliases", () => {
      expect(normalizeState("done")).toBe("concluído");
      expect(normalizeState("completed")).toBe("concluído");
      expect(normalizeState("in progress")).toBe("em implementação");
      expect(normalizeState("doing")).toBe("em implementação");
      expect(normalizeState("backlog")).toBe("planeado");
      expect(normalizeState("planned")).toBe("planeado");
      expect(normalizeState("paused")).toBe("pausado");
      expect(normalizeState("blocked")).toBe("pausado");
      expect(normalizeState("deferred")).toBe("adiado");
      expect(normalizeState("closed")).toBe("encerrado");
      expect(normalizeState("cancelled")).toBe("encerrado");
    });

    it("is case-insensitive", () => {
      expect(normalizeState("DONE")).toBe("concluído");
      expect(normalizeState("In Progress")).toBe("em implementação");
      expect(normalizeState("BACKLOG")).toBe("planeado");
    });

    it("returns null for unknown states", () => {
      expect(normalizeState("unknown")).toBeNull();
      expect(normalizeState("")).toBeNull();
      expect(normalizeState("random text")).toBeNull();
    });
  });

  // ── isValidTransition ──────────────────────────────────────────────────

  describe("isValidTransition", () => {
    it("allows valid transitions", () => {
      expect(isValidTransition("planeado", "em investigação")).toBe(true);
      expect(isValidTransition("planeado", "em implementação")).toBe(true);
      expect(isValidTransition("em implementação", "em validação")).toBe(true);
      expect(isValidTransition("em validação", "concluído")).toBe(true);
      expect(isValidTransition("em validação", "em implementação")).toBe(true);
      expect(isValidTransition("adiado", "planeado")).toBe(true);
    });

    it("rejects invalid transitions", () => {
      expect(isValidTransition("planeado", "concluído")).toBe(false);
      expect(isValidTransition("planeado", "em validação")).toBe(false);
      expect(isValidTransition("em implementação", "concluído")).toBe(false);
    });

    it("rejects transitions from terminal states", () => {
      expect(isValidTransition("concluído", "planeado")).toBe(false);
      expect(isValidTransition("concluído", "em implementação")).toBe(false);
      expect(isValidTransition("encerrado", "planeado")).toBe(false);
      expect(isValidTransition("encerrado", "concluído")).toBe(false);
    });
  });

  // ── getAllowedTransitions ──────────────────────────────────────────────

  describe("getAllowedTransitions", () => {
    it("returns correct transitions for planeado", () => {
      const transitions = getAllowedTransitions("planeado");
      expect(transitions).toContain("em investigação");
      expect(transitions).toContain("em implementação");
      expect(transitions).toContain("encerrado");
      expect(transitions).not.toContain("concluído");
    });

    it("returns empty array for terminal states", () => {
      expect(getAllowedTransitions("concluído")).toHaveLength(0);
      expect(getAllowedTransitions("encerrado")).toHaveLength(0);
    });
  });

  // ── findShortestPath ──────────────────────────────────────────────────

  describe("findShortestPath", () => {
    it("returns empty array when from equals to", () => {
      expect(findShortestPath("planeado", "planeado")).toEqual([]);
    });

    it("finds direct path: planeado → em implementação", () => {
      const path = findShortestPath("planeado", "em implementação");
      expect(path).toEqual(["em implementação"]);
    });

    it("finds multi-step path: planeado → concluído", () => {
      const path = findShortestPath("planeado", "concluído");
      expect(path).not.toBeNull();
      expect(path![0]).toBe("em implementação");
      expect(path![path!.length - 1]).toBe("concluído");
    });

    it("finds path through adiado: adiado → planeado → concluído", () => {
      const path = findShortestPath("adiado", "concluído");
      expect(path).not.toBeNull();
      expect(path![0]).toBe("planeado");
      expect(path!.length).toBeGreaterThanOrEqual(3);
    });

    it("returns null for unreachable state (concluído → planeado)", () => {
      expect(findShortestPath("concluído", "planeado")).toBeNull();
    });

    it("returns null for unreachable state (encerrado → concluído)", () => {
      expect(findShortestPath("encerrado", "concluído")).toBeNull();
    });

    it("finds path: pausado → em implementação → em validação → concluído", () => {
      const path = findShortestPath("pausado", "concluído");
      expect(path).not.toBeNull();
      expect(path![0]).toBe("em implementação");
      expect(path!.length).toBe(3);
    });
  });

  // ── parseBacklogItems (legacy format) ─────────────────────────────────

  describe("parseBacklogItems — legacy format", () => {
    it("parses items from legacy markdown table", () => {
      const backlogPath = join(testDir, "BACKLOG.md");
      writeFileSync(
        backlogPath,
        LEGACY_HEADER +
          legacyRow("TASK-001", "First task", "P0", "planeado") + "\n" +
          legacyRow("TASK-002", "Second task", "P1", "em implementação") + "\n" +
          legacyRow("TASK-003", "Third task", "P2", "concluído") + "\n",
        "utf-8",
      );

      const items = parseBacklogItems(backlogPath);
      expect(items).toHaveLength(3);
      expect(items[0]!.id).toBe("TASK-001");
      expect(items[0]!.state).toBe("planeado");
      expect(items[0]!.format).toBe("legacy");
      expect(items[1]!.state).toBe("em implementação");
      expect(items[2]!.state).toBe("concluído");
    });

    it("normalizes state aliases in legacy format", () => {
      const backlogPath = join(testDir, "BACKLOG.md");
      writeFileSync(
        backlogPath,
        LEGACY_HEADER +
          legacyRow("TASK-001", "Done task", "P0", "Done") + "\n" +
          legacyRow("TASK-002", "In progress", "P1", "In Progress") + "\n",
        "utf-8",
      );

      const items = parseBacklogItems(backlogPath);
      expect(items[0]!.state).toBe("concluído");
      expect(items[1]!.state).toBe("em implementação");
    });

    it("returns empty array for non-existent file", () => {
      expect(parseBacklogItems("/nonexistent/BACKLOG.md")).toEqual([]);
    });

    it("skips header row", () => {
      const backlogPath = join(testDir, "BACKLOG.md");
      writeFileSync(
        backlogPath,
        LEGACY_HEADER + legacyRow("TASK-001", "Task", "P0", "planeado") + "\n",
        "utf-8",
      );

      const items = parseBacklogItems(backlogPath);
      expect(items).toHaveLength(1);
      expect(items[0]!.id).toBe("TASK-001");
    });
  });

  // ── parseBacklogItems (modular format) ────────────────────────────────

  describe("parseBacklogItems — modular format", () => {
    it("parses items from modular markdown with ### headers", () => {
      const backlogPath = join(testDir, "ACTIVE.md");
      writeFileSync(
        backlogPath,
        MODULAR_HEADER +
          modularItem("BACKLOG-001", "Critical bug", "em implementação") + "\n" +
          modularItem("BACKLOG-002", "Feature request", "planeado", "P1") + "\n",
        "utf-8",
      );

      const items = parseBacklogItems(backlogPath);
      expect(items).toHaveLength(2);
      expect(items[0]!.id).toBe("BACKLOG-001");
      expect(items[0]!.state).toBe("em implementação");
      expect(items[0]!.format).toBe("modular");
      expect(items[0]!.severity).toBe("Alto");
      expect(items[1]!.priority).toBe("P1");
    });

    it("parses priority from section headers (## P0)", () => {
      const backlogPath = join(testDir, "ACTIVE.md");
      writeFileSync(
        backlogPath,
        "# BACKLOG\n\n## P0 Critical\n\n" +
          modularItem("BACKLOG-001", "P0 item", "planeado") + "\n",
        "utf-8",
      );

      const items = parseBacklogItems(backlogPath);
      expect(items[0]!.priority).toBe("P0");
    });
  });

  // ── findItem ──────────────────────────────────────────────────────────

  describe("findItem", () => {
    const items: BacklogItem[] = [
      { id: "BACKLOG-001", title: "First", state: "planeado", priority: "P0", severity: "", owner: "", description: "", source: "", date: "", line: 0, filePath: "", format: "modular" },
      { id: "BACKLOG-002", title: "Second", state: "em implementação", priority: "P1", severity: "", owner: "", description: "", source: "", date: "", line: 5, filePath: "", format: "modular" },
      { id: "TASK-100", title: "Third", state: "concluído", priority: "P2", severity: "", owner: "", description: "", source: "", date: "", line: 10, filePath: "", format: "legacy" },
    ];

    it("finds item by exact ID", () => {
      const item = findItem(items, "BACKLOG-001");
      expect(item).not.toBeNull();
      expect(item!.id).toBe("BACKLOG-001");
    });

    it("finds item by exact ID (case-insensitive)", () => {
      const item = findItem(items, "backlog-001");
      expect(item).not.toBeNull();
      expect(item!.id).toBe("BACKLOG-001");
    });

    it("finds item by prefix", () => {
      const item = findItem(items, "BACKLOG");
      expect(item).not.toBeNull();
      expect(item!.id).toBe("BACKLOG-001");
    });

    it("prefers exact match over prefix", () => {
      const item = findItem(items, "BACKLOG-002");
      expect(item).not.toBeNull();
      expect(item!.id).toBe("BACKLOG-002");
    });

    it("returns null for non-existent item", () => {
      expect(findItem(items, "NONEXISTENT")).toBeNull();
    });
  });

  // ── addItem ───────────────────────────────────────────────────────────

  describe("addItem", () => {
    it("creates a new backlog file and adds item", () => {
      const backlogPath = join(testDir, "ACTIVE.md");
      const result = addItem(backlogPath, {
        id: "BACKLOG-001",
        title: "New feature",
        state: "planeado",
        priority: "P0",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("BACKLOG-001");

      const content = readFileSync(backlogPath, "utf-8");
      expect(content).toContain("### BACKLOG-001 New feature");
      expect(content).toContain("planeado");
    });

    it("adds item to existing backlog file", () => {
      const backlogPath = join(testDir, "ACTIVE.md");
      writeFileSync(backlogPath, "# BACKLOG\n\n", "utf-8");

      const result = addItem(backlogPath, {
        id: "BACKLOG-001",
        title: "First item",
      });

      expect(result.success).toBe(true);
      const content = readFileSync(backlogPath, "utf-8");
      expect(content).toContain("### BACKLOG-001 First item");
    });

    it("rejects duplicate items", () => {
      const backlogPath = join(testDir, "ACTIVE.md");
      writeFileSync(backlogPath, MODULAR_HEADER + modularItem("BACKLOG-001", "Existing", "planeado"), "utf-8");

      const result = addItem(backlogPath, {
        id: "BACKLOG-001",
        title: "Duplicate",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("already exists");
    });

    it("creates parent directories if needed", () => {
      const backlogPath = join(testDir, "subdir", "ACTIVE.md");
      const result = addItem(backlogPath, {
        id: "BACKLOG-001",
        title: "Deep item",
      });

      expect(result.success).toBe(true);
      const content = readFileSync(backlogPath, "utf-8");
      expect(content).toContain("BACKLOG-001");
    });
  });

  // ── deleteItem ────────────────────────────────────────────────────────

  describe("deleteItem", () => {
    it("removes an item from the backlog", () => {
      const backlogPath = join(testDir, "ACTIVE.md");
      writeFileSync(
        backlogPath,
        MODULAR_HEADER +
          modularItem("BACKLOG-001", "To delete", "planeado") + "\n" +
          modularItem("BACKLOG-002", "To keep", "planeado") + "\n",
        "utf-8",
      );

      const result = deleteItem(backlogPath, "BACKLOG-001");
      expect(result.success).toBe(true);

      const content = readFileSync(backlogPath, "utf-8");
      expect(content).not.toContain("BACKLOG-001");
      expect(content).toContain("BACKLOG-002");
    });

    it("fails for non-existent file", () => {
      const result = deleteItem("/nonexistent/ACTIVE.md", "BACKLOG-001");
      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });

    it("fails for non-existent item", () => {
      const backlogPath = join(testDir, "ACTIVE.md");
      writeFileSync(backlogPath, MODULAR_HEADER + modularItem("BACKLOG-001", "Exists", "planeado"), "utf-8");

      const result = deleteItem(backlogPath, "NONEXISTENT");
      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });
  });

  // ── transitionItem ────────────────────────────────────────────────────

  describe("transitionItem", () => {
    it("transitions item in legacy format", () => {
      const backlogPath = join(testDir, "BACKLOG.md");
      writeFileSync(
        backlogPath,
        LEGACY_HEADER + legacyRow("TASK-001", "Test", "P0", "planeado") + "\n",
        "utf-8",
      );

      const result = transitionItem(backlogPath, "TASK-001", "em implementação");
      expect(result.success).toBe(true);
      expect(result.previousState).toBe("planeado");
      expect(result.newState).toBe("em implementação");

      const content = readFileSync(backlogPath, "utf-8");
      expect(content).toContain("em implementação");
    });

    it("transitions item in modular format", () => {
      const backlogPath = join(testDir, "ACTIVE.md");
      writeFileSync(
        backlogPath,
        MODULAR_HEADER + modularItem("BACKLOG-001", "Test", "planeado") + "\n",
        "utf-8",
      );

      const result = transitionItem(backlogPath, "BACKLOG-001", "em implementação");
      expect(result.success).toBe(true);
      expect(result.newState).toBe("em implementação");

      const content = readFileSync(backlogPath, "utf-8");
      expect(content).toContain("| **Status** | em implementação |");
    });

    it("rejects invalid transition", () => {
      const backlogPath = join(testDir, "BACKLOG.md");
      writeFileSync(
        backlogPath,
        LEGACY_HEADER + legacyRow("TASK-001", "Test", "P0", "planeado") + "\n",
        "utf-8",
      );

      const result = transitionItem(backlogPath, "TASK-001", "concluído");
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid transition");
    });

    it("fails for non-existent file", () => {
      const result = transitionItem("/nonexistent/BACKLOG.md", "TASK-001", "concluído");
      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });

    it("fails for non-existent item", () => {
      const backlogPath = join(testDir, "BACKLOG.md");
      writeFileSync(
        backlogPath,
        LEGACY_HEADER + legacyRow("TASK-001", "Test", "P0", "planeado") + "\n",
        "utf-8",
      );

      const result = transitionItem(backlogPath, "NONEXISTENT", "em implementação");
      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });

    it("marks as Done with date when transitioning to concluído", () => {
      const backlogPath = join(testDir, "ACTIVE.md");
      writeFileSync(
        backlogPath,
        MODULAR_HEADER + modularItem("BACKLOG-001", "Test", "em validação") + "\n",
        "utf-8",
      );

      const result = transitionItem(backlogPath, "BACKLOG-001", "concluído", { date: "2026-07-23" });
      expect(result.success).toBe(true);

      const content = readFileSync(backlogPath, "utf-8");
      expect(content).toContain("Done — 2026-07-23");
    });

    it("rejects adiado → planeado without [REVISIT:] tag", () => {
      const backlogPath = join(testDir, "ACTIVE.md");
      writeFileSync(
        backlogPath,
        MODULAR_HEADER + modularItem("BACKLOG-001", "Deferred task", "adiado") + "\n",
        "utf-8",
      );

      const result = transitionItem(backlogPath, "BACKLOG-001", "planeado");
      expect(result.success).toBe(false);
      expect(result.message).toContain("REVISIT");
    });
  });

  // ── moveItemToDone ────────────────────────────────────────────────────

  describe("moveItemToDone", () => {
    it("moves item from active to done file", () => {
      const activePath = join(testDir, "ACTIVE.md");
      const donePath = join(testDir, "DONE.md");
      writeFileSync(
        activePath,
        MODULAR_HEADER +
          modularItem("BACKLOG-001", "Completed task", "concluído") + "\n" +
          modularItem("BACKLOG-002", "Active task", "planeado") + "\n",
        "utf-8",
      );

      const result = moveItemToDone(activePath, donePath, "BACKLOG-001");
      expect(result.success).toBe(true);

      const activeContent = readFileSync(activePath, "utf-8");
      expect(activeContent).not.toContain("BACKLOG-001");
      expect(activeContent).toContain("BACKLOG-002");

      const doneContent = readFileSync(donePath, "utf-8");
      expect(doneContent).toContain("BACKLOG-001");
    });

    it("fails for non-existent active file", () => {
      const result = moveItemToDone("/nonexistent/ACTIVE.md", "/tmp/DONE.md", "BACKLOG-001");
      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });

    it("fails for non-existent item", () => {
      const activePath = join(testDir, "ACTIVE.md");
      const donePath = join(testDir, "DONE.md");
      writeFileSync(
        activePath,
        MODULAR_HEADER + modularItem("BACKLOG-001", "Exists", "planeado") + "\n",
        "utf-8",
      );

      const result = moveItemToDone(activePath, donePath, "NONEXISTENT");
      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });
  });

  // ── getBacklogSummary ─────────────────────────────────────────────────

  describe("getBacklogSummary", () => {
    it("computes correct summary statistics", () => {
      const items: BacklogItem[] = [
        { id: "1", title: "A", state: "planeado", priority: "P0", severity: "", owner: "", description: "", source: "", date: "", line: 0, filePath: "", format: "modular" },
        { id: "2", title: "B", state: "em implementação", priority: "P1", severity: "", owner: "", description: "", source: "", date: "", line: 0, filePath: "", format: "modular" },
        { id: "3", title: "C", state: "pausado", priority: "P0", severity: "", owner: "", description: "", source: "", date: "", line: 0, filePath: "", format: "modular" },
        { id: "4", title: "D", state: "concluído", priority: "P2", severity: "", owner: "", description: "", source: "", date: "", line: 0, filePath: "", format: "modular" },
      ];

      const summary = getBacklogSummary(items);
      expect(summary.total).toBe(4);
      expect(summary.p0Count).toBe(2);
      expect(summary.p1Count).toBe(1);
      expect(summary.blockers).toHaveLength(1);
      expect(summary.inProgress).toHaveLength(1);
      expect(summary.recentlyCompleted).toHaveLength(1);
    });

    it("handles empty items array", () => {
      const summary = getBacklogSummary([]);
      expect(summary.total).toBe(0);
      expect(summary.blockers).toHaveLength(0);
      expect(summary.inProgress).toHaveLength(0);
    });
  });

  // ── formatSummaryLine ─────────────────────────────────────────────────

  describe("formatSummaryLine", () => {
    it("formats summary with P0 and P1 counts", () => {
      const summary = getBacklogSummary([
        { id: "1", title: "A", state: "planeado", priority: "P0", severity: "", owner: "", description: "", source: "", date: "", line: 0, filePath: "", format: "modular" },
        { id: "2", title: "B", state: "em implementação", priority: "P1", severity: "", owner: "", description: "", source: "", date: "", line: 0, filePath: "", format: "modular" },
      ]);

      const line = formatSummaryLine(summary);
      expect(line).toContain("P0: 1");
      expect(line).toContain("P1: 1");
      expect(line).toContain("Total: 2");
      expect(line).toContain("Em progresso: 1");
    });
  });
});
