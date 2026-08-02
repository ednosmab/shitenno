import { describe, it, expect } from "vitest";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { scaffoldShitenno, type ScaffoldResult } from "../scaffolder.js";
import type { UserAnswers } from "../prompts.js";
import type { Capability } from "../maturity-profile.js";

const execAsync = promisify(exec);
const CLI_PATH = resolve(import.meta.dirname, "../../dist/bin/shugo.js");

async function runShugo(
  args: string,
  cwd?: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execAsync(`node ${CLI_PATH} ${args}`, {
      cwd: cwd || process.cwd(),
      timeout: 60000,
      env: { ...process.env, SHITENNO_CHILD: "1", SHITENNO_QUIET: "1" },
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || "",
      stderr: error.stderr || "",
      exitCode: error.code || 1,
    };
  }
}

function scaffoldTestProject(
  name: string,
  level: "junior" | "pleno" | "senior" = "junior"
): { dir: string; result: ScaffoldResult } {
  const dir = join(tmpdir(), `shitenno-e2e-${name}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });

  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: "test-project",
        version: "1.0.0",
        type: "module",
        dependencies: { react: "^18.0.0" },
        devDependencies: { typescript: "^5.0.0" },
      },
      null,
      2
    )
  );

  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(
    join(dir, "src", "index.ts"),
    'console.log("hello");'
  );

  const maturityByLevel: Record<string, object> = {
    junior: { usedShitennoBefore: false, isFirstProject: false, projectAge: "new", teamSize: "solo", hasDedicatedTeam: false, hasArchitectureDocs: false, hasADRs: false, hasTechnicalReviews: false, hasCICD: false, hasAutomatedTests: false, hasValidationPipeline: false, intendsToUseAI: false, aiWillImplement: false, requiresHumanReview: false, hasDefinedPatterns: false, hasReviewProcess: false, hasDecisionControl: false },
    pleno: { usedShitennoBefore: false, isFirstProject: false, projectAge: "established", teamSize: "small", hasDedicatedTeam: false, hasArchitectureDocs: false, hasADRs: false, hasTechnicalReviews: false, hasCICD: true, hasAutomatedTests: true, hasValidationPipeline: false, intendsToUseAI: true, aiWillImplement: true, requiresHumanReview: true, hasDefinedPatterns: false, hasReviewProcess: false, hasDecisionControl: false },
    senior: { usedShitennoBefore: true, isFirstProject: false, projectAge: "mature", teamSize: "medium", hasDedicatedTeam: true, hasArchitectureDocs: true, hasADRs: true, hasTechnicalReviews: true, hasCICD: true, hasAutomatedTests: true, hasValidationPipeline: true, intendsToUseAI: true, aiWillImplement: true, requiresHumanReview: true, hasDefinedPatterns: true, hasReviewProcess: true, hasDecisionControl: true },
  };

  const capsByLevel: Record<string, Capability[]> = {
    junior: ["core", "knowledge", "governance"],
    pleno: ["core", "knowledge", "governance"],
    senior: ["core", "knowledge", "architecture", "governance", "ai", "quality", "metrics", "operations", "compliance"],
  };

  const answers: UserAnswers = {
    principalModel: "opencode/mimo-v2.5-free",
    executorModel: "opencode/deepseek-v4-flash-free",
    stack: ["react", "typescript"],
    database: "PostgreSQL",
    styling: "Tailwind CSS",
    maturity: maturityByLevel[level] as UserAnswers["maturity"],
  };

  const result = scaffoldShitenno(dir, answers, capsByLevel[level]!);

  const maturityPath = join(dir, ".shitenno", "maturity-profile.json");
  const dimScores = level === "senior" ? 85 : level === "pleno" ? 55 : 25;
  writeFileSync(
    maturityPath,
    JSON.stringify({
      dimensions: {
        architecture: dimScores,
        governance: dimScores,
        quality: dimScores,
        automation: dimScores,
        ai: dimScores,
        documentation: dimScores,
        observability: dimScores,
      },
      overallScore: dimScores,
      recommendedCapabilities: [],
      installedCapabilities: capsByLevel[level],
      futureCapabilities: [],
      computedAt: new Date().toISOString(),
    }, null, 2)
  );

  return { dir, result };
}

describe("O.1 — Heavy bootstrap scoping regression", () => {
  it("shugo plan status does NOT trigger heavy bootstrap output", async () => {
    const { dir } = scaffoldTestProject("heavy-scope-plan-status");
    try {
      const plansDir = join(dir, ".shitenno", "governance", "plans");
      mkdirSync(plansDir, { recursive: true });
      writeFileSync(
        join(plansDir, "PLAN-A.md"),
        `# Plan A\n\n**Status:** In Progress\n`
      );

      const { stdout, stderr } = await runShugo("plan status PLAN-A andamento", dir);
      const combined = stdout + stderr;

      expect(combined).not.toMatch(/proactive-engine|doc-sync-hook|plan-backlog-sync/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("shugo daemon status does NOT trigger heavy bootstrap output", async () => {
    const { dir } = scaffoldTestProject("heavy-scope-daemon-status");
    try {
      const { stdout, stderr } = await runShugo("daemon status", dir);
      const combined = stdout + stderr;

      expect(combined).not.toMatch(/proactive-engine|doc-sync-hook|plan-backlog-sync/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
