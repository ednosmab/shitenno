import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  getCurrentStatus,
  transitionBacklogStatus,
  type BacklogStatus,
} from "../infrastructure/backlog-transitions.js";
import { writeFileSync, unlinkSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

function createTempBacklog(content: string): string {
  const dir = join(tmpdir(), `backlog-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "BACKLOG.md");
  writeFileSync(path, content, "utf-8");
  return path;
}

function createItem(id: string, status: string, date?: string): string {
  const statusVal = status === "concluído" ? `Done — ${date ?? "2026-07-06"}` : status;
  return `### ${id} Some Title

| Campo | Valor |
|---|---|
| **Status** | ${statusVal} |
| **Severidade** | Alto |
| **Prioridade** | P0 |
| **Owner** | executor |
| **Data** | 2026-07-01 |
| **Fonte** | shugo assess |
| **Modulos** | src/ |
| **Descricao** | Some description |
| **Correcao** | Some correction |`;
}

describe("backlog-transitions", () => {
  describe("isValidTransition", () => {
    it("allows transition from null to any status", () => {
      expect(isValidTransition(null, "planeado")).toBe(true);
      expect(isValidTransition(null, "concluído")).toBe(true);
    });

    it("allows planeado → em investigação", () => {
      expect(isValidTransition("planeado", "em investigação")).toBe(true);
    });

    it("allows planeado → em implementação", () => {
      expect(isValidTransition("planeado", "em implementação")).toBe(true);
    });

    it("blocks planeado → concluído", () => {
      expect(isValidTransition("planeado", "concluído")).toBe(false);
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

    it("blocks concluído → any", () => {
      expect(isValidTransition("concluído", "planeado")).toBe(false);
      expect(isValidTransition("concluído", "em implementação")).toBe(false);
    });

    it("blocks encerrado → any", () => {
      expect(isValidTransition("encerrado", "planeado")).toBe(false);
    });

    it("allows em investigação → encerrado", () => {
      expect(isValidTransition("em investigação", "encerrado")).toBe(true);
    });

    it("allows pausado → em investigação", () => {
      expect(isValidTransition("pausado", "em investigação")).toBe(true);
    });

    it("blocks adiado → any", () => {
      expect(isValidTransition("adiado", "planeado")).toBe(false);
    });

    it("rejects unknown status values", () => {
      expect(isValidTransition("planeado", "unknown" as BacklogStatus)).toBe(false);
    });
  });

  describe("getCurrentStatus", () => {
    it("returns null for non-existent file", () => {
      expect(getCurrentStatus("/nonexistent/BACKLOG.md", "SA3")).toBeNull();
    });

    it("detects Done status as concluído", () => {
      const content = createItem("TEST-001", "Backlog");
      const path = createTempBacklog(content);
      try {
        expect(getCurrentStatus(path, "TEST-001")).toBe("planeado");
      } finally {
        unlinkSync(path);
      }
    });

    it("detects Done status as concluído", () => {
      const content = createItem("TEST-002", "Done", "2026-07-06");
      const path = createTempBacklog(content);
      try {
        expect(getCurrentStatus(path, "TEST-002")).toBe("concluído");
      } finally {
        unlinkSync(path);
      }
    });

    it("detects explicit Backlog status as planeado", () => {
      const content = createItem("TEST-003", "Backlog");
      const path = createTempBacklog(content);
      try {
        expect(getCurrentStatus(path, "TEST-003")).toBe("planeado");
      } finally {
        unlinkSync(path);
      }
    });

    it("returns null for non-existent item", () => {
      const content = createItem("EXISTING", "Backlog");
      const path = createTempBacklog(content);
      try {
        expect(getCurrentStatus(path, "NONEXISTENT")).toBeNull();
      } finally {
        unlinkSync(path);
      }
    });
  });

  describe("transitionBacklogStatus", () => {
    it("transitions Backlog → em implementação", () => {
      const content = createItem("TASK-001", "Backlog");
      const path = createTempBacklog(content);
      try {
        const result = transitionBacklogStatus(path, "TASK-001", "em implementação");
        expect(result.success).toBe(true);
        expect(result.previousStatus).toBe("planeado");
        expect(result.newStatus).toBe("em implementação");
        expect(result.message).toContain("planeado → em implementação");

        const updated = getCurrentStatus(path, "TASK-001");
        expect(updated).toBe("em implementação");
      } finally {
        unlinkSync(path);
      }
    });

    it("transitions em implementação → em validação", () => {
      const content = createItem("TASK-002", "em implementação");
      const path = createTempBacklog(content);
      try {
        const result = transitionBacklogStatus(path, "TASK-002", "em validação");
        expect(result.success).toBe(true);
        expect(result.previousStatus).toBe("em implementação");
        expect(result.newStatus).toBe("em validação");

        const updated = getCurrentStatus(path, "TASK-002");
        expect(updated).toBe("em validação");
      } finally {
        unlinkSync(path);
      }
    });

    it("transitions Done → (no-op, concluído is terminal)", () => {
      const content = createItem("TASK-003", "Done — 2026-07-06");
      const path = createTempBacklog(content);
      try {
        const result = transitionBacklogStatus(path, "TASK-003", "planeado");
        expect(result.success).toBe(false);
        expect(result.message).toContain("Invalid transition");
      } finally {
        unlinkSync(path);
      }
    });

    it("returns failure for non-existent file", () => {
      const result = transitionBacklogStatus("/nonexistent/BACKLOG.md", "TASK", "concluído");
      expect(result.success).toBe(false);
      expect(result.message).toContain("Backlog file not found");
    });

    it("returns failure for invalid transition", () => {
      const content = createItem("TASK-004", "Backlog");
      const path = createTempBacklog(content);
      try {
        const result = transitionBacklogStatus(path, "TASK-004", "concluído");
        expect(result.success).toBe(false);
        expect(result.message).toContain("Invalid transition: planeado → concluído");
      } finally {
        unlinkSync(path);
      }
    });

    it("transitions to concluído with date", () => {
      const content = createItem("TASK-005", "em implementação");
      const path = createTempBacklog(content);
      try {
        const result = transitionBacklogStatus(path, "TASK-005", "em validação");
        expect(result.success).toBe(true);

        const result2 = transitionBacklogStatus(path, "TASK-005", "concluído", { date: "2026-07-06" });
        expect(result2.success).toBe(true);

        const updated = getCurrentStatus(path, "TASK-005");
        expect(updated).toBe("concluído");
      } finally {
        unlinkSync(path);
      }
    });

    it("preserves other items in the backlog", () => {
      const item1 = createItem("ITEM-001", "Backlog");
      const item2 = createItem("ITEM-002", "Backlog");
      const path = createTempBacklog(`${item1}\n\n${item2}`);
      try {
        transitionBacklogStatus(path, "ITEM-001", "em implementação");

        expect(getCurrentStatus(path, "ITEM-001")).toBe("em implementação");
        expect(getCurrentStatus(path, "ITEM-002")).toBe("planeado");
      } finally {
        unlinkSync(path);
      }
    });

    it("preserves the item header line after transition", () => {
      const item = createItem("HEADER-001", "Backlog");
      const path = createTempBacklog(item);
      try {
        const result = transitionBacklogStatus(path, "HEADER-001", "em implementação");
        expect(result.success).toBe(true);

        const content = readFileSync(path, "utf-8");
        expect(content).toContain("### HEADER-001 Some Title");
      } finally {
        unlinkSync(path);
      }
    });
  });
});
