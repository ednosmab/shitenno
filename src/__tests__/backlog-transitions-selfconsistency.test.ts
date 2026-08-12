import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { transitionBacklogStatus } from "../infrastructure/backlog-transitions.js";
import { parseBacklogItems } from "../infrastructure/backlog-parser.js";

describe("backlog-transitions self-consistency (validation)", () => {
  let dir: string;
  let backlogPath: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "backlog-transitions-validate-"));
    backlogPath = join(dir, "ACTIVE.md");
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("REPRO: transitioning to concluído writes a status the parser cannot read", () => {
    writeFileSync(
      backlogPath,
      [
        "# Backlog",
        "",
        "### ITEM-001 Item test",
        "",
        "| Campo | Valor |",
        "|---|---|",
        "| **Status** | em validação |",
        "| **Prioridade** | P1 |",
        "",
      ].join("\n")
    );

    const result = transitionBacklogStatus(backlogPath, "ITEM-001", "concluído");
    expect(result.success).toBe(true);

    const raw = readFileSync(backlogPath, "utf-8");
    console.log("RAW after transition:", JSON.stringify(raw.match(/\*\*Status\*\*\s*\|\s*[^\n]+/)?.[0]));

    const items = parseBacklogItems(backlogPath);
    const item = items.find((i) => i.id === "ITEM-001");
    console.log("PARSED state:", item?.state);
    expect(item?.state).toBe("concluído");
  });

  it("REPRO: transition from planeado to em implementação is parseable", () => {
    writeFileSync(
      backlogPath,
      [
        "# Backlog",
        "",
        "### ITEM-002 Item test 2",
        "",
        "| Campo | Valor |",
        "|---|---|",
        "| **Status** | planeado |",
        "",
      ].join("\n")
    );

    const result = transitionBacklogStatus(backlogPath, "ITEM-002", "em implementação");
    expect(result.success).toBe(true);

    const items = parseBacklogItems(backlogPath);
    const item = items.find((i) => i.id === "ITEM-002");
    expect(item?.state).toBe("em implementação");
  });
});
