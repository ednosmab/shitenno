import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readValidationSource(): string {
  return readFileSync(resolve(__dirname, "..", "..", ".shitenno", "scripts", "close-session.ts"), "utf-8");
}

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

  it("FEEDBACK step is present in close-session.ts — displays recorded session outcomes", () => {
    const source = readValidationSource();
    expect(source).toContain("displaySessionFeedback");
    expect(source).toContain("[FEEDBACK] Session outcome history");
    expect(source).toContain("session-feedback', 'records.jsonl");
  });

  it("FEEDBACK step runs last in the close-session execution order", () => {
    const source = readValidationSource();
    const feedbackCall = source.indexOf("displaySessionFeedback();");
    const e2eCall = source.indexOf("runE2eBestEffort();");
    expect(feedbackCall).toBeGreaterThan(-1);
    expect(e2eCall).toBeGreaterThan(-1);
    expect(feedbackCall).toBeGreaterThan(e2eCall);
  });

  it("session-feedback.ts is a tsup entry so close-session can read feedback from dist", () => {
    const tsupSource = readFileSync(resolve(__dirname, "..", "..", "tsup.config.ts"), "utf-8");
    expect(tsupSource).toContain("src/infrastructure/session-feedback.ts");
  });
});
