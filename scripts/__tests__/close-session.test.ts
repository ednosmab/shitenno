import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("close-session script — path resolution (static analysis)", () => {
  it("GOV uses '.shitenno' (with dot prefix)", () => {
    const ROOT = resolve(__dirname, "..", "..");
    const GOV = resolve(ROOT, ".shitenno", "governance");
    const yamlPath = resolve(GOV, "context/context_buffer.yaml");
    expect(existsSync(yamlPath)).toBe(true);
  });

  it("checkBacklog finds .shitenno/docs/backlog/ACTIVE.md (modular path)", () => {
    const ROOT = resolve(__dirname, "..", "..");
    const modularPath = resolve(ROOT, ".shitenno", "docs", "backlog", "ACTIVE.md");
    const legacyPath = resolve(ROOT, ".shitenno", "docs", "BACKLOG.md");
    const backlogPath = existsSync(modularPath) ? modularPath : legacyPath;
    expect(existsSync(backlogPath)).toBe(true);
    expect(backlogPath).toContain("ACTIVE.md");
  });

  it("OLD broken paths (shitenno/ without dot) do NOT exist", () => {
    const ROOT = resolve(__dirname, "..", "..");
    const brokenGov = resolve(ROOT, "shitenno", "governance");
    const brokenBacklog = resolve(ROOT, "shitenno", "docs", "BACKLOG.md");
    expect(existsSync(brokenGov)).toBe(false);
    expect(existsSync(brokenBacklog)).toBe(false);
  });
});
