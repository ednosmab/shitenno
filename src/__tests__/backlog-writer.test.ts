import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";

// Enable spying on ESM module exports by hoisting a passthrough mock
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual };
});

// Suppress vitest-fail-on-console for logger.warn calls in error paths
vi.mock("../shared/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  formatBacklogItem,
  formatBacklogSection,
  appendBacklogSection,
  isDuplicate,
  issueToBacklogItem,
  dimensionToBacklogItem,
  moveItemToDone,
  mapSeverityToPriority,
  severityLabel,
  type BacklogItem,
} from "../application/backlog-writer.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-backlog-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

const sampleItem: BacklogItem = {
  id: "SA1",
  title: "Test issue",
  severity: "Critico",
  priority: "P0",
  source: "shugo audit",
  date: "2026-06-30",
  modules: ["src/test.ts"],
  description: "This is a test issue",
  correction: "Fix the test",
  state: "planeado",
  owner: "unassigned",
  line: 0,
  filePath: "",
  format: "modular",
};

// ═══════════════════════════════════════════════════════════════════════════════
// mapSeverityToPriority
// ═══════════════════════════════════════════════════════════════════════════════

describe("mapSeverityToPriority", () => {
  it("returns P0 for severity 3", () => {
    expect(mapSeverityToPriority(3)).toBe("P0");
  });

  it("returns P1 for severity 2", () => {
    expect(mapSeverityToPriority(2)).toBe("P1");
  });

  it("returns P0 for maturity < 25", () => {
    expect(mapSeverityToPriority(1, 15)).toBe("P0");
  });

  it("returns P1 for maturity 25-49", () => {
    expect(mapSeverityToPriority(1, 30)).toBe("P1");
  });

  it("returns P2 for maturity 50-74", () => {
    expect(mapSeverityToPriority(1, 60)).toBe("P2");
  });

  it("returns P2 for severity 1 with no maturity", () => {
    expect(mapSeverityToPriority(1)).toBe("P2");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// severityLabel
// ═══════════════════════════════════════════════════════════════════════════════

describe("severityLabel", () => {
  it("returns Critico for 3", () => {
    expect(severityLabel(3)).toBe("Critico");
  });

  it("returns Alto for 2", () => {
    expect(severityLabel(2)).toBe("Alto");
  });

  it("returns Medio for 1", () => {
    expect(severityLabel(1)).toBe("Medio");
  });

  it("returns Baixo for 0", () => {
    expect(severityLabel(0)).toBe("Baixo");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// isDuplicate
// ═══════════════════════════════════════════════════════════════════════════════

describe("isDuplicate", () => {
  it("returns true when title exists", () => {
    const content = "### SA1 Test issue\n\nSome content";
    expect(isDuplicate(content, sampleItem)).toBe(true);
  });

  it("returns true when title exists case-insensitive", () => {
    const content = "### SA1 TEST ISSUE\n\nSome content";
    expect(isDuplicate(content, sampleItem)).toBe(true);
  });

  it("returns false when title not found", () => {
    const content = "### SA1 Other issue\n\nSome content";
    expect(isDuplicate(content, sampleItem)).toBe(false);
  });

  it("returns false for empty content", () => {
    expect(isDuplicate("", sampleItem)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// formatBacklogItem
// ═══════════════════════════════════════════════════════════════════════════════

describe("formatBacklogItem", () => {
  it("generates correct markdown", () => {
    const result = formatBacklogItem(sampleItem);
    expect(result).toContain("### SA1 Test issue");
    expect(result).toContain("**Status** | Backlog");
    expect(result).toContain("**Severidade** | Critico");
    expect(result).toContain("**Prioridade** | P0");
    expect(result).toContain("**Owner** | unassigned");
    expect(result).toContain("**Data** | 2026-06-30");
    expect(result).toContain("**Fonte** | shugo audit");
    expect(result).toContain("**Modulos** | src/test.ts");
    expect(result).toContain("**Descricao** | This is a test issue");
    expect(result).toContain("**Correcao** | Fix the test");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// formatBacklogSection
// ═══════════════════════════════════════════════════════════════════════════════

describe("formatBacklogSection", () => {
  it("returns empty string for no items", () => {
    expect(formatBacklogSection([], "2026-06-30")).toBe("");
  });

  it("generates section with header and items", () => {
    const items = [sampleItem];
    const result = formatBacklogSection(items, "2026-06-30");
    expect(result).toContain("## Auto-análise 2026-06-30");
    expect(result).toContain("### SA1 Test issue");
    expect(result).toContain("1 (1 P0, 0 P1, 0 P2, 0 P3)");
  });

  it("counts priorities correctly", () => {
    const items = [
      sampleItem,
      { ...sampleItem, id: "SA2", priority: "P1" as const },
      { ...sampleItem, id: "SA3", priority: "P2" as const },
    ];
    const result = formatBacklogSection(items, "2026-06-30");
    expect(result).toContain("3 (1 P0, 1 P1, 1 P2, 0 P3)");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// appendBacklogSection
// ═══════════════════════════════════════════════════════════════════════════════

describe("appendBacklogSection", () => {
  it("returns empty result when directory creation fails", () => {
    const mkdirSpy = vi
      .spyOn(fs, "mkdirSync")
      .mockImplementation(() => {
        throw new Error("EACCES: permission denied");
      });

    const result = appendBacklogSection(
      join(tempDir, "no-perms", "file.md"),
      [sampleItem],
      "2026-06-30"
    );

    expect(result.itemsAdded).toBe(0);
    expect(result.sectionInserted).toBe(false);
    expect(result.message).toBe("Backlog path not accessible");

    mkdirSpy.mockRestore();
  });

  it("returns empty result when write fails", () => {
    const backlogPath = join(tempDir, "BACKLOG.md");
    writeFileSync(backlogPath, "# Backlog\n", "utf-8");

    const writeSpy = vi
      .spyOn(fs, "writeFileSync")
      .mockImplementation(() => {
        throw new Error("ENOSPC: no space left on device");
      });

    const result = appendBacklogSection(backlogPath, [sampleItem], "2026-06-30");

    expect(result.itemsAdded).toBe(0);
    expect(result.sectionInserted).toBe(false);
    expect(result.message).toBe("Failed to write backlog file");

    writeSpy.mockRestore();
  });

  it("appends section to file", () => {
    const backlogPath = join(tempDir, "BACKLOG.md");
    writeFileSync(backlogPath, "# Backlog\n\n---\n\n## Metricas de Qualidade\n\n```\nTest\n```\n");

    const result = appendBacklogSection(backlogPath, [sampleItem], "2026-06-30");

    expect(result.itemsAdded).toBe(1);
    expect(result.sectionInserted).toBe(true);

    const content = readFileSync(backlogPath, "utf-8");
    expect(content).toContain("## Auto-análise 2026-06-30");
    expect(content).toContain("### SA1 Test issue");
  });

  it("skips duplicate items", () => {
    const backlogPath = join(tempDir, "BACKLOG.md");
    writeFileSync(backlogPath, "# Backlog\n\n### SA1 Test issue\n\nExists\n");

    const result = appendBacklogSection(backlogPath, [sampleItem], "2026-06-30");

    expect(result.itemsAdded).toBe(0);
    expect(result.itemsSkipped).toBe(1);
  });

  it("inserts before Metricas de Qualidade", () => {
    const backlogPath = join(tempDir, "BACKLOG.md");
    writeFileSync(backlogPath, "# Backlog\n\n---\n\n## Metricas de Qualidade\n\n```\nTest\n```\n");

    appendBacklogSection(backlogPath, [sampleItem], "2026-06-30");

    const content = readFileSync(backlogPath, "utf-8");
    const autoIdx = content.indexOf("## Auto-análise");
    const metricasIdx = content.indexOf("## Metricas de Qualidade");
    expect(autoIdx).toBeLessThan(metricasIdx);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// issueToBacklogItem
// ═══════════════════════════════════════════════════════════════════════════════

describe("issueToBacklogItem", () => {
  it("converts audit issue correctly", () => {
    const issue = {
      type: "missing_docs",
      severity: 3,
      description: "Missing WORKFLOW.md",
      location: "shitenno/governance/WORKFLOW.md",
      recommendation: "Create WORKFLOW.md",
    };

    const item = issueToBacklogItem(issue, "2026-06-30", "SA", 1);
    expect(item.id).toBe("SA01");
    expect(item.title).toBe("Missing WORKFLOW.md");
    expect(item.severity).toBe("Critico");
    expect(item.priority).toBe("P0");
    expect(item.source).toBe("shugo audit");
    expect(item.modules).toContain("shitenno/governance/WORKFLOW.md");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// dimensionToBacklogItem
// ═══════════════════════════════════════════════════════════════════════════════

describe("dimensionToBacklogItem", () => {
  it("creates correct item for low score", () => {
    const item = dimensionToBacklogItem("architecture", 15, "2026-06-30", "SA4");
    expect(item.id).toBe("SA4");
    expect(item.title).toContain("architecture");
    expect(item.title).toContain("15%");
    expect(item.severity).toBe("Alto");
    expect(item.priority).toBe("P0");
  });

  it("creates correct item for critical score", () => {
    const item = dimensionToBacklogItem("governance", 0, "2026-06-30", "SA3");
    expect(item.severity).toBe("Critico");
    expect(item.priority).toBe("P0");
  });

  it("creates correct item for medium score", () => {
    const item = dimensionToBacklogItem("quality", 45, "2026-06-30", "SA5");
    expect(item.severity).toBe("Medio");
    expect(item.priority).toBe("P1");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// moveItemToDone
// ═══════════════════════════════════════════════════════════════════════════════

describe("moveItemToDone", () => {
  it("moves a Done item from ACTIVE.md to DONE.md", () => {
    const activePath = join(tempDir, "ACTIVE.md");
    const donePath = join(tempDir, "DONE.md");

    writeFileSync(
      activePath,
      `## Ativo

### BUG-001 Fix login

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P0 |
| **Owner** | unassigned |
| **Descricao** | Login quebra em prod |

`
    );
    writeFileSync(
      donePath,
      `## Done

| Item | Severidade | Resolucao |
|---|---|---|
`
    );

    const moved = moveItemToDone(activePath, donePath, "BUG-001");
    expect(moved.success).toBe(true);

    const active = readFileSync(activePath, "utf-8");
    const done = readFileSync(donePath, "utf-8");

    expect(active).not.toContain("BUG-001");
    expect(done).toContain("BUG-001 Fix login");
    expect(done).toContain("| Alto | Login quebra em prod |");
  });

  it("returns false when item not found in ACTIVE.md", () => {
    const activePath = join(tempDir, "ACTIVE.md");
    const donePath = join(tempDir, "DONE.md");
    writeFileSync(activePath, "## Ativo\n");
    writeFileSync(donePath, "## Done\n");

    expect(moveItemToDone(activePath, donePath, "NOPE").success).toBe(false);
  });
});
