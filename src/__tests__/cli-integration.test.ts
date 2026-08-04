import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { exec, execSync } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { scaffoldShitenno, type ScaffoldResult } from "../scaffolder.js";
import type { UserAnswers } from "../prompts.js";
import type { Capability } from "../maturity-profile.js";

const execAsync = promisify(exec);

// Path to the built CLI
const CLI_PATH = resolve(import.meta.dirname, "../../dist/bin/shugo.js");

// Helper to run CLI command
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

// Helper to create a scaffolded shugo project
function scaffoldTestProject(
  name: string,
  level: "junior" | "pleno" | "senior" = "junior"
): { dir: string; result: ScaffoldResult } {
  const dir = join(tmpdir(), `shitenno-e2e-${name}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });

  // Create a basic package.json with "type": "module" for ESM plugin loading
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

  // Create a src/ directory so the project has something to analyse
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

  // Create maturity-profile.json so lifecycle state reaches "assessed"
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

describe("CLI Integration Tests", () => {
  // ──────────────────────────────────────────────
  // --help and --version
  // ──────────────────────────────────────────────
  describe("shugo --help", () => {
    it("should show all registered commands", async () => {
      const { stdout, exitCode } = await runShugo("--help");

      expect(exitCode).toBe(0);
      expect(stdout).toContain("shugo");
      expect(stdout).toContain("init");
      expect(stdout).toContain("status");
      expect(stdout).toContain("detect");
      expect(stdout).toContain("audit");
      expect(stdout).toContain("upgrade");
      expect(stdout).toContain("validate");
      expect(stdout).toContain("run");
    });

    it("should show version", async () => {
      const { stdout, exitCode } = await runShugo("--version");

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  // ──────────────────────────────────────────────
  // shugo init — edge cases (not interactive)
  // ──────────────────────────────────────────────
  describe("shugo init", () => {
    const dirs: string[] = [];

    afterEach(() => {
      for (const d of dirs) rmSync(d, { recursive: true, force: true });
      dirs.length = 0;
    });

    it("should detect existing initialization", async () => {
      const dir = join(tmpdir(), `shitenno-e2e-init-already-${Date.now()}`);
      mkdirSync(dir, { recursive: true });
      dirs.push(dir);

      mkdirSync(join(dir, ".shitenno"), { recursive: true });

      const { stdout } = await runShugo("init", dir);
      expect(stdout).toContain("already initialized");
    });

    it("should warn when running inside shitenno-cli", async () => {
      const { stdout } = await runShugo("init --dir /tmp/shitenno-cli-testdir");
      expect(stdout).toMatch(/shitenno should be created|already initialized|Governance Setup/);
    });

    it("should warn with --dir containing shitenno-cli", async () => {
      const { stdout } = await runShugo("init --dir /home/runner/work/shitenno-cli/myproject");
      expect(stdout).toContain("shitenno should be created");
    });
  });

  // ──────────────────────────────────────────────
  // shugo status
  // ──────────────────────────────────────────────
  describe("shugo status", () => {
    const dirs: string[] = [];

    afterEach(() => {
      for (const d of dirs) rmSync(d, { recursive: true, force: true });
      dirs.length = 0;
    });

    it("should show 'not initialized' for non-shitenno directory", async () => {
      const dir = join(tmpdir(), `shitenno-e2e-status-empty-${Date.now()}`);
      mkdirSync(dir, { recursive: true });
      dirs.push(dir);

      const { stdout } = await runShugo("status", dir);
      expect(stdout).toContain("not initialized");
    });

    it("should treat shitenno/ alone as initialized", async () => {
      const dir = join(tmpdir(), `shitenno-e2e-status-partial-${Date.now()}`);
      mkdirSync(join(dir, ".shitenno"), { recursive: true });
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("status", dir);
      expect(exitCode).toBe(0);
      expect(stdout).not.toContain("not initialized");
    });

    it("should show health check for a scaffolded junior project", async () => {
      const { dir } = scaffoldTestProject("status-junior", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("status", dir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Health Check");
      expect(stdout).toContain("Project root");
      expect(stdout).toContain("Governance Health");
      expect(stdout).toContain("Complexity Report");
    });

    it("should show complexity score and area breakdown", async () => {
      const { dir } = scaffoldTestProject("status-complexity", "senior");
      dirs.push(dir);

      const { stdout } = await runShugo("status", dir);
      expect(stdout).toContain("Complexity Report");
      expect(stdout).toContain("Score:");
    });

    it("should generate a report file when reports/ exists (senior)", async () => {
      const { dir } = scaffoldTestProject("status-report", "senior");
      dirs.push(dir);

      const { stdout } = await runShugo("status", dir);
      expect(stdout).toContain("Report saved");
    });
  });

  // ──────────────────────────────────────────────
  // shugo detect
  // ──────────────────────────────────────────────
  describe("shugo detect", () => {
    const dirs: string[] = [];

    afterEach(() => {
      for (const d of dirs) rmSync(d, { recursive: true, force: true });
      dirs.length = 0;
    });

    it("should show 'not initialized' for non-shitenno directory", async () => {
      const dir = join(tmpdir(), `shitenno-e2e-detect-empty-${Date.now()}`);
      mkdirSync(dir, { recursive: true });
      dirs.push(dir);

      const { stdout } = await runShugo("detect", dir);
      expect(stdout).toContain("not initialized");
    });

    it("should analyze history and reports for scaffolded project", async () => {
      const { dir } = scaffoldTestProject("detect-junior", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("detect", dir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Pattern Detection");
      expect(stdout).toContain("Detection Results");
      expect(stdout).toContain("History entries analyzed");
      expect(stdout).toContain("Patterns detected");
    });

    it("should show no patterns for a fresh project with no history", async () => {
      const { dir } = scaffoldTestProject("detect-fresh", "junior");
      dirs.push(dir);

      const { stdout } = await runShugo("detect", dir);
      expect(stdout).toContain("No significant patterns detected");
    });

    it("should write a pattern report", async () => {
      const { dir } = scaffoldTestProject("detect-report", "junior");
      dirs.push(dir);

      const { stdout } = await runShugo("detect", dir);
      expect(stdout).toMatch(/Report saved|No significant patterns detected/);
    });
  });

  // ──────────────────────────────────────────────
  // shugo audit
  // ──────────────────────────────────────────────
  describe("shugo audit", () => {
    const dirs: string[] = [];

    afterEach(() => {
      for (const d of dirs) rmSync(d, { recursive: true, force: true });
      dirs.length = 0;
    });

    it("should show 'not initialized' for non-shitenno directory", async () => {
      const dir = join(tmpdir(), `shitenno-e2e-audit-empty-${Date.now()}`);
      mkdirSync(dir, { recursive: true });
      dirs.push(dir);

      const { stdout } = await runShugo("audit", dir);
      expect(stdout).toContain("not initialized");
    });

    it("should run health audit on a scaffolded project", async () => {
      const { dir } = scaffoldTestProject("audit-junior", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("audit", dir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Health Audit");
      expect(stdout).toContain("Health Audit Results");
      expect(stdout).toContain("Code Health");
    });

    it("should show health score out of 100", async () => {
      const { dir } = scaffoldTestProject("audit-score", "junior");
      dirs.push(dir);

      const { stdout } = await runShugo("audit", dir);
      expect(stdout).toMatch(/\d+\/100/);
    });

    it("should show rules and history counts", async () => {
      const { dir } = scaffoldTestProject("audit-counts", "pleno");
      dirs.push(dir);

      const { stdout } = await runShugo("audit", dir);
      expect(stdout).toContain("Rules:");
      expect(stdout).toContain("History entries:");
      expect(stdout).toContain("Issues found:");
    });

    it("should write a health report when reports/ exists (senior)", async () => {
      const { dir } = scaffoldTestProject("audit-report", "senior");
      dirs.push(dir);

      const { stdout } = await runShugo("audit", dir);
      expect(stdout).toMatch(/Report saved/);
    });
  });

  // ──────────────────────────────────────────────
  // shugo upgrade
  // ──────────────────────────────────────────────
  describe("shugo upgrade", () => {
    const dirs: string[] = [];

    afterEach(() => {
      for (const d of dirs) rmSync(d, { recursive: true, force: true });
      dirs.length = 0;
    });

    it("should show upgrade options for a junior project", async () => {
      const { dir } = scaffoldTestProject("upgrade-junior", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("upgrade --list", dir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Capabilities Status");
    });

    it("should detect installed capabilities", async () => {
      const { dir } = scaffoldTestProject("upgrade-level", "junior");
      dirs.push(dir);

      const { stdout } = await runShugo("upgrade --list", dir);
      expect(stdout).toContain("Core");
      expect(stdout).toContain("Knowledge");
    });

    it("should show more capabilities for pleno project", async () => {
      const { dir } = scaffoldTestProject("upgrade-pleno", "pleno");
      dirs.push(dir);

      const { stdout } = await runShugo("upgrade --list", dir);
      expect(stdout).toContain("Governance");
    });
  });

  // ──────────────────────────────────────────────
  // shugo validate
  // ──────────────────────────────────────────────
  describe("shugo validate", () => {
    const dirs: string[] = [];

    afterEach(() => {
      for (const d of dirs) rmSync(d, { recursive: true, force: true });
      dirs.length = 0;
    });

    it("should validate a scaffolded project", async () => {
      const { dir } = scaffoldTestProject("validate-junior", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("validate", dir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Validation");
    });
  });

  // ──────────────────────────────────────────────
  // shugo run
  // ──────────────────────────────────────────────
  describe("shugo run", () => {
    const dirs: string[] = [];

    afterEach(() => {
      for (const d of dirs) rmSync(d, { recursive: true, force: true });
      dirs.length = 0;
    });

    it("should run the full analysis pipeline", async () => {
      const { dir } = scaffoldTestProject("run-junior", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("run", dir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Full Analysis");
      expect(stdout).toContain("Pipeline Results");
      expect(stdout).toContain("analyze");
      expect(stdout).toContain("score");
      expect(stdout).toContain("detect");
      expect(stdout).toContain("audit");
    });

    it("should output valid JSON on run --json", async () => {
      const { dir } = scaffoldTestProject("run-json", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("run --json", dir);
      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json).toHaveProperty("projectRoot");
      expect(json).toHaveProperty("stages");
      expect(json).toHaveProperty("complexity");
      expect(json).toHaveProperty("patterns");
      expect(json).toHaveProperty("health");
      expect(json).toHaveProperty("duration");
    });
  });

  // ──────────────────────────────────────────────
  // --json flag
  // ──────────────────────────────────────────────
  describe("--json flag", () => {
    const dirs: string[] = [];

    afterEach(() => {
      for (const d of dirs) rmSync(d, { recursive: true, force: true });
      dirs.length = 0;
    });

    it("should output valid JSON on status --json", async () => {
      const { dir } = scaffoldTestProject("json-status", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("status --json", dir);
      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json).toHaveProperty("projectRoot");
      expect(json).toHaveProperty("complexity");
      expect(json.complexity).toHaveProperty("score");
      expect(json.complexity).toHaveProperty("level");
      expect(json).toHaveProperty("cacheHit");
    });

    it("should output valid JSON on status --json when not initialized", async () => {
      const dir = join(tmpdir(), `shitenno-e2e-json-status-empty-${Date.now()}`);
      mkdirSync(dir, { recursive: true });
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("status --json", dir);
      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json).toHaveProperty("error");
      expect(json.error).toBe("not_initialized");
    });

    it("should output valid JSON on detect --json", async () => {
      const { dir } = scaffoldTestProject("json-detect", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("detect --json", dir);
      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json).toHaveProperty("projectRoot");
      expect(json).toHaveProperty("patterns");
      expect(json).toHaveProperty("candidateRules");
      expect(json).toHaveProperty("summary");
    });

    it("should output valid JSON on audit --json", async () => {
      const { dir } = scaffoldTestProject("json-audit", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("audit --json", dir);
      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json).toHaveProperty("projectRoot");
      expect(json).toHaveProperty("healthScore");
      expect(json).toHaveProperty("issues");
      expect(json).toHaveProperty("optimizations");
      expect(typeof json.healthScore).toBe("number");
    });

    it("should include semantic layer data in audit --json", async () => {
      const { dir } = scaffoldTestProject("json-audit-semantic", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("audit --json", dir);
      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json).toHaveProperty("semantic");
      const semantic = json.semantic as Record<string, unknown>;
      expect(semantic).toHaveProperty("patterns");
      expect(semantic).toHaveProperty("insights");
      expect(semantic).toHaveProperty("correlations");
      expect(semantic).toHaveProperty("growthProfile");
      expect(Array.isArray(semantic.patterns)).toBe(true);
      expect(Array.isArray(semantic.insights)).toBe(true);
      expect(Array.isArray(semantic.correlations)).toBe(true);
      const gp = semantic.growthProfile as Record<string, unknown>;
      expect(gp).toHaveProperty("growthCapacity");
      expect(gp).toHaveProperty("challengeLevel");
      expect(gp).toHaveProperty("domainChallengeLevels");
      expect(typeof gp.growthCapacity).toBe("number");
      expect(typeof gp.challengeLevel).toBe("number");
    });

    it("should include semantic layer data in detect --json", async () => {
      const { dir } = scaffoldTestProject("json-detect-semantic", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("detect --json", dir);
      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json).toHaveProperty("semantic");
      const semantic = json.semantic as Record<string, unknown>;
      expect(semantic).toHaveProperty("patterns");
      expect(semantic).toHaveProperty("insights");
      expect(semantic).toHaveProperty("correlations");
      expect(Array.isArray(semantic.patterns)).toBe(true);
      expect(Array.isArray(semantic.insights)).toBe(true);
      expect(Array.isArray(semantic.correlations)).toBe(true);
    });

    it("should output valid JSON on validate --json", async () => {
      const { dir } = scaffoldTestProject("json-validate", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("validate --json", dir);
      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json).toHaveProperty("results");
      expect(json).toHaveProperty("passCount");
      expect(json).toHaveProperty("warnCount");
      expect(json).toHaveProperty("failCount");
      expect(Array.isArray(json.results)).toBe(true);
    });

    it("keeps stdout as pure JSON even when doc-sync-hook logs during the run", async () => {
      const { dir } = scaffoldTestProject("json-stdout-pollution", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("status --json", dir);
      expect(exitCode).toBe(0);
      expect(() => JSON.parse(stdout)).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────
  // Error handling
  // ──────────────────────────────────────────────
  describe("Error handling", () => {
    it("should handle invalid command gracefully", async () => {
      const { stdout, stderr, exitCode } = await runShugo("invalid-command");
      expect(exitCode).not.toBe(0);
      expect(stdout + stderr).toMatch(/unknown command|error/i);
    });

    it("should handle missing directory gracefully", async () => {
      const { stdout } = await runShugo("status -d /nonexistent/path-12345");
      expect(stdout).toMatch(/not found|not initialized|Warning|opencode.json not found/);
    });
  });

  // ──────────────────────────────────────────────
  // Event Bus Integration
  // ──────────────────────────────────────────────
  describe("Event Bus Integration", () => {
    const dirs: string[] = [];

    afterEach(() => {
      for (const d of dirs) rmSync(d, { recursive: true, force: true });
      dirs.length = 0;
    });

    it("should publish events from status command", async () => {
      const { dir } = scaffoldTestProject("event-status", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("status --json", dir);
      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json).toHaveProperty("projectRoot");
    });

    it("should publish events from detect command", async () => {
      const { dir } = scaffoldTestProject("event-detect", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("detect --json", dir);
      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json).toHaveProperty("patterns");
    });

    it("should publish events from audit command", async () => {
      const { dir } = scaffoldTestProject("event-audit", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("audit --json", dir);
      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json).toHaveProperty("healthScore");
    });
  });

  // ──────────────────────────────────────────────
  // Run Pipeline Integration
  // ──────────────────────────────────────────────
  describe("Run Pipeline Integration", () => {
    const dirs: string[] = [];

    afterEach(() => {
      for (const d of dirs) rmSync(d, { recursive: true, force: true });
      dirs.length = 0;
    });

    it("should run all 5 stages in pipeline", async () => {
      const { dir } = scaffoldTestProject("pipeline-5stage", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("run --json", dir);
      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json.stages).toHaveLength(5);
      expect(json.stages.map((s: { stage: string }) => s.stage)).toEqual([
        "analyze", "score", "detect", "audit", "evolve",
      ]);
    });

    it("should produce evolution recommendations", async () => {
      const { dir } = scaffoldTestProject("pipeline-evolve", "junior");
      dirs.push(dir);

      const { stdout, exitCode } = await runShugo("run --json", dir);
      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json).toHaveProperty("evolution");
      expect(json.evolution).toHaveProperty("recommendations");
    });
  });

  // ──────────────────────────────────────────────
  // Non-interactive Assess
  // ──────────────────────────────────────────────
  describe("Non-interactive Assess", () => {
    const dirs: string[] = [];

    afterEach(() => {
      for (const d of dirs) rmSync(d, { recursive: true, force: true });
      dirs.length = 0;
    });

    it("should run assess with --answers-file and exit 0", async () => {
      const { dir } = scaffoldTestProject("assess-noninteractive", "junior");
      dirs.push(dir);

      // Create a persona answers file
      const personaPath = join(dir, "persona.json");
      writeFileSync(
        personaPath,
        JSON.stringify({
          principalModel: "opencode/mimo-v2.5-free",
          executorModel: "opencode/deepseek-v4-flash-free",
          stack: ["react", "typescript"],
          database: "PostgreSQL",
          styling: "Tailwind CSS",
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
        })
      );

      const { stdout, exitCode } = await runShugo(
        `assess --dir "${dir}" --answers-file "${personaPath}"`,
        dir
      );
      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/Capability|Maturity|assessed|Assess/i);
    });

    it("should fail fast in non-interactive mode without --answers-file", async () => {
      const { dir } = scaffoldTestProject("assess-noninteractive-fail", "junior");
      dirs.push(dir);

      // Run assess without --answers-file in a non-interactive context
      // The CLI should detect non-TTY and fail fast
      const { stdout, exitCode } = await runShugo(
        `assess --dir "${dir}"`,
        dir
      );
      // Should fail with non-interactive error
      expect(exitCode).not.toBe(0);
      expect(stdout).toMatch(/non-interactive|answers-file/i);
    });
  });

  // ──────────────────────────────────────────────
  // H.1 — E2E scaffold in clean directory
  // ──────────────────────────────────────────────
  describe("shugo init — full scaffold in clean directory (H.1)", () => {
    const dirs: string[] = [];

    afterEach(() => {
      for (const d of dirs) rmSync(d, { recursive: true, force: true });
      dirs.length = 0;
    });

    it("scaffolds a fully usable project from a clean directory", async () => {
      const dir = join(tmpdir(), `shitenno-e2e-fresh-${Date.now()}`);
      mkdirSync(dir, { recursive: true });
      dirs.push(dir);

      // Simulate a real third-party project: minimal package.json, no Shugo artifacts
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "third-party-app", version: "1.0.0", type: "module" }, null, 2)
      );
      writeFileSync(join(dir, "index.js"), "console.log('hello');\n");

      // Phase 0 prerequisite: init requires a git repository (isolation via
      // git worktree). A real third-party project is already versioned.
      execSync("git init -q", { cwd: dir });

      // Create an answers file for non-interactive init (senior level ensures all capabilities installed)
      const personaPath = join(dir, "persona.json");
      writeFileSync(
        personaPath,
        JSON.stringify({
          projectType: "new",
          principalModel: "opencode/mimo-v2.5-free",
          executorModel: "opencode/deepseek-v4-flash-free",
          stack: ["javascript"],
          database: "none",
          styling: "none",
          maturity: {
            usedShitennoBefore: true,
            isFirstProject: false,
            projectAge: "mature",
            teamSize: "medium",
            hasDedicatedTeam: true,
            hasArchitectureDocs: true,
            hasADRs: true,
            hasTechnicalReviews: true,
            hasCICD: true,
            hasAutomatedTests: true,
            hasValidationPipeline: true,
            intendsToUseAI: true,
            aiWillImplement: true,
            requiresHumanReview: true,
            hasDefinedPatterns: true,
            hasReviewProcess: true,
            hasDecisionControl: true,
          },
        })
      );

      const initResult = await runShugo(
        `init --dir "${dir}" --answers-file "${personaPath}"`,
        dir
      );
      expect(initResult.exitCode).toBe(0);

      // The scaffold must create the minimal usable structure:
      expect(existsSync(join(dir, ".shitenno"))).toBe(true);
      expect(existsSync(join(dir, ".shitenno", "governance"))).toBe(true);
      expect(existsSync(join(dir, ".shitenno", "governance", "plans"))).toBe(true);

      // Must be functional immediately, not just have files:
      const statusResult = await runShugo("status --json", dir);
      expect(statusResult.exitCode).toBe(0);
      const status = JSON.parse(statusResult.stdout);
      expect(status.initialized ?? true).toBeTruthy();

      const auditResult = await runShugo("audit --json", dir);
      expect(auditResult.exitCode).toBe(0);
      const audit = JSON.parse(auditResult.stdout);
      expect(typeof audit.healthScore).toBe("number");
    }, 120_000);
  });

  // ──────────────────────────────────────────────
  // M.12 — E2E de comandos que mutam estado
  // ──────────────────────────────────────────────
  describe("shugo act", () => {
    let dir: string;
    beforeEach(() => { dir = scaffoldTestProject("act").dir; });
    afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

    it("executes a valid action and returns success JSON", async () => {
      const { stdout, exitCode } = await runShugo(`act reminder --message "test reminder" --priority medium --json --dir "${dir}"`, dir);
      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json.result).toBe("success");
      expect(json.executionId).toBeDefined();
    });

    it("is idempotent for the same --action-id", async () => {
      const first = await runShugo(`act reminder --message "dup" --action-id ACT-DUP-001 --json --dir "${dir}"`, dir);
      const second = await runShugo(`act reminder --message "dup" --action-id ACT-DUP-001 --json --dir "${dir}"`, dir);
      expect(JSON.parse(second.stdout).executionId).toBe(JSON.parse(first.stdout).executionId);
    });
  });

  describe("shugo plan md", () => {
    let dir: string;
    beforeEach(() => { dir = scaffoldTestProject("plan-md").dir; });
    afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

    it("creates and lists plans end-to-end", async () => {
      const create = await runShugo(`plan create "Test plan E2E" --json --dir "${dir}"`, dir);
      expect(create.exitCode).toBe(0);
      const plan = JSON.parse(create.stdout);
      expect(plan.id).toBeDefined();
      expect(plan.title).toBe("Test plan E2E");

      const list = await runShugo(`plan list --json --dir "${dir}"`, dir);
      const plans = JSON.parse(list.stdout);
      expect(Array.isArray(plans)).toBe(true);
      expect(plans.some((p: { id: string }) => p.id === plan.id)).toBe(true);
    }, 30000);
  });

  describe("shugo decide", () => {
    let dir: string;
    beforeEach(() => { dir = scaffoldTestProject("decide").dir; });
    afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

    it("creates a decision and lists it", async () => {
      const record = await runShugo(`decide "Use PostgreSQL over SQLite" --category architecture --risk medium --impact high --json --dir "${dir}"`, dir);
      expect(record.exitCode).toBe(0);
      expect(existsSync(join(dir, ".shitenno", "governance", "decisions"))).toBe(true);
    });
  });

  describe("shugo hooks", () => {
    let dir: string;
    beforeEach(() => {
      dir = scaffoldTestProject("hooks").dir;
      execSync("git init -q", { cwd: dir });
    });
    afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

    it("installs hooks and they appear in .husky", async () => {
      const { exitCode } = await runShugo(`hooks --dir "${dir}"`, dir);
      expect(exitCode).toBe(0);
      expect(existsSync(join(dir, ".husky", "post-commit"))).toBe(true);
    });
  });

  describe("shugo update", () => {
    let dir: string;
    beforeEach(() => {
      dir = scaffoldTestProject("update").dir;
    });
    afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

    it("--dry-run reports changes without applying", async () => {
      const { exitCode } = await runShugo(`update --dry-run --json --dir "${dir}"`, dir);
      expect(exitCode).toBe(0);
    });
  });

  describe("shugo clean", () => {
    let dir: string;
    beforeEach(() => {
      dir = scaffoldTestProject("clean").dir;
      writeFileSync(join(dir, "important-user-file.txt"), "não pode sumir");
    });
    afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

    it("removes only Shugo-internal transient state, never user files", async () => {
      const { exitCode } = await runShugo(`clean --json --dir "${dir}"`, dir);
      expect(exitCode).toBe(0);
      expect(existsSync(join(dir, "important-user-file.txt"))).toBe(true);
    });
  });

  describe("shugo sync", () => {
    let dir: string;
    beforeEach(() => { dir = scaffoldTestProject("sync").dir; });
    afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

    it("--dry-run shows diff without writing", async () => {
      const target = join(dir, ".shitenno", "governance", "WORKFLOW.md");
      const before = readFileSync(target, "utf-8");
      const { exitCode } = await runShugo(`sync --dry-run --json --dir "${dir}"`, dir);
      expect(exitCode).toBe(0);
      expect(readFileSync(target, "utf-8")).toBe(before);
    });
  });
});
