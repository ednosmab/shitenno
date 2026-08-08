/**
 * load.test.ts — Load smoke tests (Fase 3)
 *
 * Exercises hot paths under an artificially large workload with a
 * generous time budget, so failures surface from the harness itself
 * rather than from timing noise.
 *
 * Run with: pnpm run test:load
 */

import { describe, it, expect } from "vitest";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { parseBacklogItems } from "../infrastructure/backlog-parser.js";

const TIME_BUDGET_MS = 5000;
const ITEM_COUNT = 500;

function buildLargeBacklog(count: number): string {
  const blocks: string[] = [];
  for (let i = 0; i < count; i++) {
    blocks.push(`### ITEM-${String(i).padStart(4, "0")} Load item ${i}

| Campo | Valor |
|---|---|
| **Status** | planeado |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Data** | 2026-08-08 |
| **Fonte** | load-test |
| **Descricao** | Synthetic load item number ${i} with some padding to simulate realistic description length. |
`);
  }
  return blocks.join("\n");
}

describe("load: backlog parser under load", () => {
  function withBacklogFile(content: string, fn: (filePath: string) => void): void {
    const filePath = join(tmpdir(), `load-test-${randomUUID()}.md`);
    writeFileSync(filePath, content, "utf-8");
    try {
      fn(filePath);
    } finally {
      unlinkSync(filePath);
    }
  }

  it(`parses ${ITEM_COUNT} items within ${TIME_BUDGET_MS}ms`, () => {
    const content = buildLargeBacklog(ITEM_COUNT);

    withBacklogFile(content, (filePath) => {
      const start = performance.now();
      const items = parseBacklogItems(filePath);
      const elapsed = performance.now() - start;

      expect(items.length).toBe(ITEM_COUNT);
      expect(items[0]?.id).toBe("ITEM-0000");
      expect(items[ITEM_COUNT - 1]?.id).toBe(`ITEM-${String(ITEM_COUNT - 1).padStart(4, "0")}`);
      expect(elapsed).toBeLessThan(TIME_BUDGET_MS);
    });
  });

  it("parses a missing file as an empty backlog without error", () => {
    const items = parseBacklogItems(join(tmpdir(), `missing-${randomUUID()}.md`));
    expect(items.length).toBe(0);
  });
});
