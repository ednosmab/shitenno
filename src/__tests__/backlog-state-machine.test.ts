import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  isValidTransition,
  getAllowedTransitions,
  transitionTask,
} from "../application/backlog-state-machine.js";
import { parseBacklogItems, findItem, transitionItem } from "../application/backlog-core.js";

describe("backlog-state-machine", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `backlog-sm-test-${randomUUID()}`);
    mkdirSync(join(testDir, "docs"), { recursive: true });
    mkdirSync(join(testDir, "governance", "context"), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("isValidTransition", () => {
    it("allows planeado → em investigação", () => {
      expect(isValidTransition("planeado", "em investigação")).toBe(true);
    });

    it("allows planeado → em implementação", () => {
      expect(isValidTransition("planeado", "em implementação")).toBe(true);
    });

    it("allows em implementação → em validação", () => {
      expect(isValidTransition("em implementação", "em validação")).toBe(true);
    });

    it("allows em validação → concluído", () => {
      expect(isValidTransition("em validação", "concluído")).toBe(true);
    });

    it("allows em validação → em implementação (rework)", () => {
      expect(isValidTransition("em validação", "em implementação")).toBe(true);
    });

    it("allows adiado → planeado", () => {
      expect(isValidTransition("adiado", "planeado")).toBe(true);
    });

    it("rejects concluído → any state (terminal)", () => {
      expect(isValidTransition("concluído", "planeado")).toBe(false);
      expect(isValidTransition("concluído", "em implementação")).toBe(false);
      expect(isValidTransition("concluído", "encerrado")).toBe(false);
    });

    it("rejects encerrado → any state (terminal)", () => {
      expect(isValidTransition("encerrado", "planeado")).toBe(false);
      expect(isValidTransition("encerrado", "em implementação")).toBe(false);
      expect(isValidTransition("encerrado", "concluído")).toBe(false);
    });

    it("rejects invalid transitions", () => {
      expect(isValidTransition("planeado", "concluído")).toBe(false);
      expect(isValidTransition("planeado", "em validação")).toBe(false);
      expect(isValidTransition("em implementação", "concluído")).toBe(false);
      expect(isValidTransition("pausado", "concluído")).toBe(false);
    });
  });

  describe("getAllowedTransitions", () => {
    it("returns correct transitions for planeado", () => {
      const transitions = getAllowedTransitions("planeado");
      expect(transitions).toContain("em investigação");
      expect(transitions).toContain("em implementação");
      expect(transitions).toContain("encerrado");
      expect(transitions).not.toContain("concluído");
    });

    it("returns empty array for concluído", () => {
      const transitions = getAllowedTransitions("concluído");
      expect(transitions).toHaveLength(0);
    });

    it("returns empty array for encerrado", () => {
      const transitions = getAllowedTransitions("encerrado");
      expect(transitions).toHaveLength(0);
    });
  });

  describe("parseBacklog", () => {
    it("parses backlog items from markdown table", () => {
      const backlogPath = join(testDir, "docs", "BACKLOG.md");
      writeFileSync(
        backlogPath,
        `# BACKLOG

| ID | Title | Priority | Status |
|---|---|---|---|
| TASK-001 | First task | High | planeado |
| TASK-002 | Second task | Medium | em implementação |
| TASK-003 | Third task | Low | concluído |
`,
        "utf-8"
      );

      const items = parseBacklogItems(backlogPath);
      expect(items).toHaveLength(3);
      expect(items[0]?.state).toBe("planeado");
      expect(items[1]?.state).toBe("em implementação");
      expect(items[2]?.state).toBe("concluído");
    });

    it("normalizes state aliases", () => {
      const backlogPath = join(testDir, "docs", "BACKLOG.md");
      writeFileSync(
        backlogPath,
        `| ID | Title | Priority | Status |
|---|---|---|---|
| TASK-001 | Done task | High | Done |
| TASK-002 | In progress | Medium | In Progress |
| TASK-003 | Backlog | Low | Backlog |
`,
        "utf-8"
      );

      const items = parseBacklogItems(backlogPath);
      expect(items[0]?.state).toBe("concluído");
      expect(items[1]?.state).toBe("em implementação");
      expect(items[2]?.state).toBe("planeado");
    });

    it("returns empty array for non-existent file", () => {
      const items = parseBacklogItems("/nonexistent/BACKLOG.md");
      expect(items).toHaveLength(0);
    });
  });

  describe("findBacklogItem", () => {
    it("finds item by exact ID", () => {
      const backlogPath = join(testDir, "docs", "BACKLOG.md");
      writeFileSync(
        backlogPath,
        `| ID | Title | Priority | Status |
|---|---|---|---|
| TASK-001 | First task | High | planeado |
`,
        "utf-8"
      );

      const item = findItem(parseBacklogItems(backlogPath), "TASK-001");
      expect(item).not.toBeNull();
      expect(item?.id).toBe("TASK-001");
    });

    it("finds item by partial ID", () => {
      const backlogPath = join(testDir, "docs", "BACKLOG.md");
      writeFileSync(
        backlogPath,
        `| ID | Title | Priority | Status |
|---|---|---|---|
| BACKLOG-001 | First task | High | planeado |
`,
        "utf-8"
      );

      const item = findItem(parseBacklogItems(backlogPath), "BACKLOG");
      expect(item).not.toBeNull();
      expect(item?.id).toBe("BACKLOG-001");
    });

    it("returns null for non-existent item", () => {
      const backlogPath = join(testDir, "docs", "BACKLOG.md");
      writeFileSync(
        backlogPath,
        `| ID | Title | Priority | Status |
|---|---|---|---|
| TASK-001 | First task | High | planeado |
`,
        "utf-8"
      );

      const item = findItem(parseBacklogItems(backlogPath), "NONEXISTENT");
      expect(item).toBeNull();
    });
  });

  describe("transitionTask", () => {
    it("transitions item to new state", () => {
      const backlogPath = join(testDir, "docs", "BACKLOG.md");
      writeFileSync(
        backlogPath,
        `| ID | Title | Priority | Status |
|---|---|---|---|
| TASK-001 | First task | High | planeado |
`,
        "utf-8"
      );

      const result = transitionTask(testDir, "TASK-001", "planeado", "em implementação");
      expect(result.success).toBe(true);
      expect(result.newState).toBe("em implementação");

      const content = readFileSync(backlogPath, "utf-8");
      expect(content).toContain("em implementação");
    });

    it("fails on invalid transition", () => {
      const backlogPath = join(testDir, "docs", "BACKLOG.md");
      writeFileSync(
        backlogPath,
        `| ID | Title | Priority | Status |
|---|---|---|---|
| TASK-001 | First task | High | planeado |
`,
        "utf-8"
      );

      const result = transitionTask(testDir, "TASK-001", "planeado", "concluído");
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid transition");
    });

    it("fails when current state doesn't match", () => {
      const backlogPath = join(testDir, "docs", "BACKLOG.md");
      writeFileSync(
        backlogPath,
        `| ID | Title | Priority | Status |
|---|---|---|---|
| TASK-001 | First task | High | planeado |
`,
        "utf-8"
      );

      const result = transitionTask(testDir, "TASK-001", "em implementação", "em validação");
      expect(result.success).toBe(false);
      expect(result.message).toContain("is in state");
    });

    it("fails for non-existent task", () => {
      const backlogPath = join(testDir, "docs", "BACKLOG.md");
      writeFileSync(
        backlogPath,
        `| ID | Title | Priority | Status |
|---|---|---|---|
| TASK-001 | First task | High | planeado |
`,
        "utf-8"
      );

      const result = transitionTask(testDir, "NONEXISTENT", "planeado", "em implementação");
      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });
  });

  describe("transitionTask to concluído", () => {
    it("completes an in-progress task", () => {
      const backlogPath = join(testDir, "docs", "BACKLOG.md");
      writeFileSync(
        backlogPath,
        `| ID | Title | Priority | Status |
|---|---|---|---|
| TASK-001 | First task | High | em validação |
`,
        "utf-8"
      );

      const result = transitionItem(backlogPath, "TASK-001", "concluído");
      expect(result.success).toBe(true);
      expect(result.newState).toBe("concluído");
    });

    it("completes a task through full lifecycle", () => {
      const backlogPath = join(testDir, "docs", "BACKLOG.md");
      writeFileSync(
        backlogPath,
        `| ID | Title | Priority | Status |
|---|---|---|---|
| TASK-001 | First task | High | planeado |
`,
        "utf-8"
      );

      let result = transitionTask(testDir, "TASK-001", "planeado", "em implementação");
      expect(result.success).toBe(true);

      result = transitionTask(testDir, "TASK-001", "em implementação", "em validação");
      expect(result.success).toBe(true);

      result = transitionTask(testDir, "TASK-001", "em validação", "concluído");
      expect(result.success).toBe(true);

      const content = readFileSync(backlogPath, "utf-8");
      expect(content).toContain("concluído");
    });
  });
});
