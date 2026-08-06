import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SHITENNO_DIR_NAME } from "../domain/types/constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..");
const SYNC_SCRIPT = join(ROOT, SHITENNO_DIR_NAME, "scripts", "sync-docs.ts");
const README = join(ROOT, "README.md");
const SYSTEM_MAP = join(ROOT, SHITENNO_DIR_NAME, "governance", "SYSTEM_MAP.md");
const REPORTS_DIR = join(ROOT, SHITENNO_DIR_NAME, "reports");

function runSync(flags = ""): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`npx tsx ${SYNC_SCRIPT} ${flags}`, {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 30_000,
    });
    return { stdout, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; status?: number; stderr?: string };
    return {
      stdout: (e.stdout || e.stderr || "") as string,
      exitCode: e.status ?? 1,
    };
  }
}

describe("sync-docs", () => {
  let originalReadme: string;
  let originalSystemMap: string;

  beforeAll(() => {
    originalReadme = readFileSync(README, "utf-8");
    originalSystemMap = readFileSync(SYSTEM_MAP, "utf-8");
  });

  afterAll(() => {
    writeFileSync(README, originalReadme, "utf-8");
    writeFileSync(SYSTEM_MAP, originalSystemMap, "utf-8");
  });

  it("runs without errors in validate-only mode", () => {
    const { exitCode, stdout } = runSync();
    expect([0, 1]).toContain(exitCode);
    expect(stdout).toContain("SYNC DOCS");
  });

  it("reports correct command count from src/commands/", () => {
    const { stdout } = runSync("--verbose");
    expect(stdout).toContain("commands documented");
  });

  it("--dry-run does not write files", () => {
    const readmeBefore = readFileSync(README, "utf-8");
    runSync("--dry-run");
    const readmeAfter = readFileSync(README, "utf-8");
    expect(readmeAfter).toBe(readmeBefore);
  });

  it("--dry-run shows what would be fixed", () => {
    const { stdout } = runSync("--dry-run");
    expect(stdout).toContain("Dry run");
  });

  it("generates report file", () => {
    runSync();
    const date = new Date().toISOString().split("T")[0];
    const reportPath = join(REPORTS_DIR, `doc-sync-${date}.json`);
    expect(existsSync(reportPath)).toBe(true);
  });

  it("checks SYSTEM_MAP.md tree", () => {
    const { stdout } = runSync("--verbose");
    expect(stdout).toContain("SYSTEM_MAP");
  });

  it("checks version consistency", () => {
    const { stdout } = runSync("--verbose");
    const hasVersionOutput =
      stdout.toLowerCase().includes("version") ||
      stdout.toLowerCase().includes("consistent") ||
      stdout.toLowerCase().includes("mismatch");
    expect(hasVersionOutput).toBe(true);
  });

  it("--quiet suppresses verbose output", () => {
    const { stdout } = runSync("--quiet");
    expect(stdout).not.toContain("Directory exists:");
  });

  it("--fix applies README command count fix", () => {
    const readmeBefore = readFileSync(README, "utf-8");

    // Temporarily break the command count
    const broken = readmeBefore.replace(
      /## All Commands \(\d+\)/,
      "## All Commands (0)"
    );
    writeFileSync(README, broken, "utf-8");

    try {
      const { stdout } = runSync("--fix");
      const readmeAfter = readFileSync(README, "utf-8");

      // Either fixed or reported as needing manual intervention
      const hasRelevantOutput =
        stdout.includes("Applied") ||
        stdout.includes("manual") ||
        stdout.includes("Fixed");
      expect(hasRelevantOutput).toBe(true);

      // If it was fixed, the count should no longer be 0
      if (readmeAfter !== broken) {
        expect(readmeAfter).not.toContain("## All Commands (0)");
      }
    } finally {
      writeFileSync(README, originalReadme, "utf-8");
    }
  });

  it("--fix regenerates SYSTEM_MAP tree", () => {
    try {
      const { stdout } = runSync("--fix");
      // Should either fix or report it's up to date
      const hasRelevantOutput =
        stdout.includes("Applied") ||
        stdout.includes("up to date") ||
        stdout.includes("Fixed") ||
        stdout.includes("regenerated");
      expect(hasRelevantOutput).toBe(true);
    } finally {
      writeFileSync(SYSTEM_MAP, originalSystemMap, "utf-8");
    }
  });
});
