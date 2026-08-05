import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { parseBacklogItems, parseBacklogWithIntegrity } from "../backlog-core.js";

// Regression test for a real corruption found by validating the MCP's
// getBacklog output against docs/backlog/ACTIVE.md: a table block with no
// "### ID Título" header of its own (leftover/duplicate content between two
// real items) used to be silently merged into the *preceding* item, so
// SA7's reported state/description in the MCP actually belonged to an
// unrelated, unheadered block. See parseModularFormat in backlog-parser.ts.

describe("backlog-parser — integrity (orphan table blocks)", () => {
  let dir: string;
  let activePath: string;

  beforeEach(() => {
    dir = join(tmpdir(), `backlog-integrity-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    activePath = join(dir, "ACTIVE.md");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("does not let an orphan (headerless) table block overwrite the preceding item's fields", () => {
    const content = `# BACKLOG — Active Items

## P1

### SA7 Baixa densidade de relacoes no knowledge graph
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Relacao baixa entre artifacts |

| **Status** | em implementação |

| **Status** | Alto |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | God modules: rule-engine.ts (1307 linhas) |

### LIVING-005 Pipeline de validação por fases
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Pipeline por fases |
`;
    writeFileSync(activePath, content, "utf-8");

    const items = parseBacklogItems(activePath);
    const sa7 = items.find((i) => i.id === "SA7");

    expect(sa7).toBeDefined();
    // Must keep SA7's own fields, not the orphan block's.
    expect(sa7!.state).toBe("planeado"); // "Backlog" normalizes to "planeado"
    expect(sa7!.description).toBe("Relacao baixa entre artifacts");

    // The item after the orphan blocks must still parse correctly —
    // the corruption must not leak forward either.
    const living = items.find((i) => i.id === "LIVING-005");
    expect(living).toBeDefined();
    expect(living!.state).toBe("planeado");
    expect(living!.description).toBe("Pipeline por fases");
  });

  it("reports orphan blocks via parseBacklogWithIntegrity instead of swallowing them", () => {
    const content = `# BACKLOG — Active Items

## P1

### SA7 Titulo
| **Status** | Backlog |
| **Descricao** | Descricao real |

| **Status** | em implementação |
| **Descricao** | Descricao orfa |

### LIVING-005 Titulo
| **Status** | Backlog |
`;
    writeFileSync(activePath, content, "utf-8");

    const { items, issues } = parseBacklogWithIntegrity(activePath);

    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]!.precedingItemId).toBe("SA7");
    expect(issues[0]!.repeatedField).toBe("Status");

    const sa7 = items.find((i) => i.id === "SA7");
    expect(sa7!.description).toBe("Descricao real");
  });

  it("parses a clean file (no orphan blocks) with zero integrity issues", () => {
    const content = `# BACKLOG — Active Items

## P1

### SA1 Titulo
| **Status** | Backlog |
| **Descricao** | Descricao 1 |

### SA2 Titulo
| **Status** | em implementação |
| **Descricao** | Descricao 2 |
`;
    writeFileSync(activePath, content, "utf-8");

    const { items, issues } = parseBacklogWithIntegrity(activePath);
    expect(issues).toHaveLength(0);
    expect(items).toHaveLength(2);
    expect(items[1]!.state).toBe("em implementação");
    expect(items[1]!.description).toBe("Descricao 2");
  });
});
