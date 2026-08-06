import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { scaffoldShitenno } from "../infrastructure/scaffolder.js";

const execAsync = promisify(exec);
const CLI_PATH = resolve(import.meta.dirname, "../../dist/bin/shugo.js");

describe("console command", () => {
  const TMP_DIR = join(tmpdir(), `shitenno-console-test-${Date.now()}`);

  beforeAll(() => {
    mkdirSync(TMP_DIR, { recursive: true });
    writeFileSync(join(TMP_DIR, "package.json"), JSON.stringify({ name: "test" }));
    mkdirSync(join(TMP_DIR, "src"), { recursive: true });
    writeFileSync(join(TMP_DIR, "src/index.ts"), "export const x = 1;");

    // Scaffold shugo directly (non-interactive)
    scaffoldShitenno(TMP_DIR, {
      principalModel: "opencode/mimo-v2.5-free",
      executorModel: "opencode/deepseek-v4-flash-free",
      stack: ["typescript"],
      database: "none",
      styling: "none",
      maturity: {
        usedShitennoBefore: false,
        isFirstProject: false,
        projectAge: "new",
        teamSize: "solo",
        hasDedicatedTeam: false,
        hasArchitectureDocs: false,
        hasADRs: false,
        hasTechnicalReviews: false,
        hasCICD: false,
        hasAutomatedTests: false,
        hasValidationPipeline: false,
        intendsToUseAI: false,
        aiWillImplement: false,
        requiresHumanReview: false,
        hasDefinedPatterns: false,
        hasReviewProcess: false,
        hasDecisionControl: false,
      },
    }, ["core", "knowledge", "governance"]);
  });

  afterAll(() => {
    if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
  });

  it("should run console with no data", async () => {
    const result = await execAsync(`node ${CLI_PATH} console --json`, {
      cwd: TMP_DIR,
      timeout: 15000,
      env: { ...process.env, SHITENNO_CHILD: "1", SHITENNO_QUIET: "1" },
    });

    const data = JSON.parse(result.stdout);
    expect(data.totalSessions).toBe(0);
    expect(data.successRate).toBe(0);
    expect(data.tokenEconomy).toBeDefined();
  });
});
