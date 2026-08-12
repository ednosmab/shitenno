import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { transitionItem } from "../backlog-writer/core.js";
import { parseBacklogItems } from "../application/backlog-core.js";

describe("backlog-writer/core self-consistency with parser (MCP path)", () => {
  let dir: string;
  let backlogPath: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "backlog-writer-core-validate-"));
    backlogPath = join(dir, "ACTIVE.md");
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function seed(itemId: string, status: string) {
    writeFileSync(
      backlogPath,
      [
        "# Backlog",
        "",
        `### ${itemId} Item test`,
        "",
        "| Campo | Valor |",
        "|---|---|",
        `| **Status** | ${status} |`,
        "| **Prioridade** | P1 |",
        "",
      ].join("\n")
    );
  }

  it("REPRO: transitionItem concluído writes a status the parser cannot read", () => {
    seed("REPRO-001", "em validação");

    const result = transitionItem(backlogPath, "REPRO-001", "concluído");
    expect(result.success).toBe(true);

    const raw = readFileSync(backlogPath, "utf-8");
    console.log("RAW:", JSON.stringify(raw.match(/\*\*Status\*\*\s*\|\s*[^\n]+/)?.[0]));

    const items = parseBacklogItems(backlogPath);
    const item = items.find((i) => i.id === "REPRO-001");
    console.log("PARSED:", item?.state);
    expect(item?.state).toBe("concluído");
  });
});