/**
 * plan-lifecycle.ts — Plan Lifecycle Management
 *
 * DUAS PORTAS DE ENTRADA PARA "DONE" (ver BLOCO Q):
 *   1. task-completion-pipeline.ts → runCompletionPipeline()
 *      cobre: tests, lint, documentation, backlog, plan_status
 *      NÃO cobre: build, gate_self_test
 *   2. plan-lifecycle.ts → runAutoVerification() / runLifecycleReview()
 *      cobre: build, tests, lint, gate_self_test
 *      NÃO cobre: documentation, backlog
 * Um plano pode ser arquivado por qualquer uma das duas sem passar pelos
 * checks exclusivos da outra. Se isso mudar de ser aceitável, ver o teste
 * done-entrypoints-coverage.test.ts.
 *
 * Detects active plans, infers status, validates completion,
 * and archives/removes them after user confirmation.
 *
 * Flow: detect → infer → validate → prompt (A/S/M/R) → execute
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { analyseProject } from "./analyser.js";
import chalk from "chalk";
import ora from "ora";
import { SHITENNO_DIR_NAME } from "./constants.js";
import { logger } from "./logger.js";
import {
  MarkdownPlanEngine,
  type MarkdownPlan,
} from "./markdown-plan-engine.js";
import {
  InferenceEngine,
  type PlanInference,
} from "./inference-engine.js";
import { output, outputBlank } from "./output.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function extractExecError(err: unknown): string {
  if (err instanceof Error) {
    const execErr = err as Error & { stderr?: string; stdout?: string; killed?: boolean; signal?: string };
    if (execErr.killed) {
      return `[TIMEOUT] Processo interrompido por exceder o tempo limite. ${execErr.stderr || execErr.stdout || ""}`.trim();
    }
    return execErr.stderr || execErr.stdout || err.message;
  }
  return String(err);
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface CompletionCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  checks: CompletionCheck[];
}

export interface LifecycleResult {
  active: number;
  archived: number;
  removed: number;
  skipped: number;
}

// ── Detect Active Plans ────────────────────────────────────────────────────

export function detectActivePlans(shitennoDir: string): MarkdownPlan[] {
  const engine = new MarkdownPlanEngine(shitennoDir);
  return engine.list().filter((p) => p.status !== "done");
}

async function runValidationWithProgress(
  _plan: MarkdownPlan,
  projectRoot: string
): Promise<ValidationResult> {
  const checks: CompletionCheck[] = [];

  const buildSpinner = ora({ spinner: "dots" }).start();
  buildSpinner.text = "Build — checking...";
  const buildCheck = checkBuild(projectRoot);
  checks.push(buildCheck);
  buildSpinner[buildCheck.passed ? "succeed" : "fail"](
    `Build — ${buildCheck.message}`
  );

  const testSpinner = ora({ spinner: "dots" }).start();
  testSpinner.text = "Tests — checking...";
  const testCheck = checkTests(projectRoot);
  checks.push(testCheck);
  testSpinner[testCheck.passed ? "succeed" : "fail"](
    `Tests — ${testCheck.message}`
  );

  const lintSpinner = ora({ spinner: "dots" }).start();
  lintSpinner.text = "Lint — checking...";
  const lintCheck = checkLint(projectRoot);
  checks.push(lintCheck);
  lintSpinner[lintCheck.passed ? "succeed" : "fail"](
    `Lint — ${lintCheck.message}`
  );

  const valid = checks.filter((c) => !c.passed).length === 0;
  return { valid, checks };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readPackageJsonSafe(projectRoot: string): PackageJson | null {
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return null;
  try {
    return JSON.parse(readFileSync(pkgPath, "utf-8")) as PackageJson;
  } catch {
    return null;
  }
}

/**
 * Detect package-manager runner from project signals.
 * Reuses analyser.ts detection that already runs at `shugo init`.
 */
function resolveRunner(projectRoot: string): { run: (script: string) => string } {
  const analysis = analyseProject(projectRoot);
  const pm = analysis.packageManager === "unknown" ? "npm" : analysis.packageManager;
  return {
    run: (script: string) => {
      if (pm === "npm") return `npm run ${script}`;
      if (pm === "yarn") return `yarn run ${script}`;
      return `${pm} run ${script}`;
    },
  };
}

// ── Completion Checks ────────────────────────────────────────────────────────

export function checkBuild(projectRoot: string): CompletionCheck {
  const pkg = readPackageJsonSafe(projectRoot);
  if (!pkg?.scripts?.build) {
    return { name: "BUILD", passed: true, message: "No build script — skipped (non-blocking)" };
  }
  const { run } = resolveRunner(projectRoot);
  try {
    execSync(`${run("build")}`, {
      encoding: "utf-8",
      cwd: projectRoot,
      timeout: 120000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { name: "BUILD", passed: true, message: "Build passed" };
  } catch (err) {
    const detail = extractExecError(err);
    return { name: "BUILD", passed: false, message: `Build failed: ${String(detail).slice(0, 300)}` };
  }
}

function isDocSyncFailure(detail: string): boolean {
  return (
    detail.includes("Command implemented but not documented") ||
    detail.includes("Directory exists but not documented") ||
    detail.includes("Documentation sync failed") ||
    detail.includes("checkCLICommands") ||
    detail.includes("checkUndocumentedDirectories")
  );
}

export function checkTests(projectRoot: string): CompletionCheck {
  const pkg = readPackageJsonSafe(projectRoot);
  // O gate de "done" usa test:unit, não test — a suíte completa inclui
  // 4 arquivos de e2e/bench (cli-integration, dashboard,
  // heavy-bootstrap-scoping, bench) que escalonam o CLI real via
  // subprocess dezenas de vezes; rodá-los a cada verificação de plano
  // estoura o timeout do gate (ver BLOCO P). Suíte completa continua
  // reservada para `npm run test` manual / CI.
  const gateScript = pkg?.scripts?.["test:unit"] ? "test:unit" : "test";
  if (!pkg?.scripts?.[gateScript]) {
    // No test script — blocking. "done" without any runnable test suite defeats the
    // whole purpose of the Bloco F verification gate.
    return { name: "TESTS", passed: false, message: `No '${gateScript}' script in package.json — cannot verify` };
  }
  const { run } = resolveRunner(projectRoot);
  try {
    execSync(`${run(gateScript)}`, {
      encoding: "utf-8",
      cwd: projectRoot,
      timeout: 420000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { name: "TESTS", passed: true, message: "Tests passed" };
  } catch (err) {
    const detail = extractExecError(err);
    const detailStr = String(detail);
    if (isDocSyncFailure(detailStr)) {
      return {
        name: "TESTS",
        passed: false,
        message: `Documentation sync failed (detected via test suite): ${detailStr.slice(0, 280)}`,
      };
    }
    return { name: "TESTS", passed: false, message: `Tests failed: ${detailStr.slice(0, 300)}` };
  }
}

export function checkLint(projectRoot: string): CompletionCheck {
  const pkg = readPackageJsonSafe(projectRoot);
  if (!pkg?.scripts?.lint) {
    // No lint script — skip. Third-party projects without a linter should not be
    // blocked forever by the auto-verification gate.
    return { name: "LINT", passed: true, message: "No lint script — skipped (non-blocking)" };
  }
  const { run } = resolveRunner(projectRoot);
  try {
    execSync(`${run("lint")}`, {
      encoding: "utf-8",
      cwd: projectRoot,
      timeout: 60000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { name: "LINT", passed: true, message: "Lint passed" };
  } catch (err) {
    const detail = extractExecError(err);
    return { name: "LINT", passed: false, message: `Lint failed: ${String(detail).slice(0, 300)}` };
  }
}

export function checkGateIntegrity(projectRoot: string): CompletionCheck {
  try {
    execSync("npx vitest run src/__tests__/plan-lifecycle-gate-e2e.test.ts --reporter=dot", {
      cwd: projectRoot,
      timeout: 30000,
      stdio: "pipe",
    });
    return { name: "GATE_SELF_TEST", passed: true, message: "Gate de done verificado (caso positivo + negativo)" };
  } catch (err) {
    return {
      name: "GATE_SELF_TEST",
      passed: false,
      message: `Mecanismo de done comprometido — não confiar em nenhuma verificação até corrigir: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function checkDocumentation(projectRoot: string): CompletionCheck {
  const pkg = readPackageJsonSafe(projectRoot);
  if (!pkg?.scripts?.["sync:docs"]) {
    return { name: "DOCS", passed: true, message: "No sync:docs script — skipped" };
  }
  const { run } = resolveRunner(projectRoot);
  // 1st attempt: validate only
  try {
    execSync(`${run("sync:docs")} --quiet`, {
      encoding: "utf-8",
      cwd: projectRoot,
      timeout: 60000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { name: "DOCS", passed: true, message: "Documentation in sync" };
  } catch (err) {
    const detail = extractExecError(err);

    // Auto-fix: attempt once before refusing
    logger.info("plan-lifecycle", "DOCS check failed — attempting auto-fix (sync:docs --fix)");
    try {
      execSync(`${run("sync:docs")} --fix --quiet`, {
        encoding: "utf-8",
        cwd: projectRoot,
        timeout: 60000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      // Re-verify after fix
      execSync(`${run("sync:docs")} --quiet`, {
        encoding: "utf-8",
        cwd: projectRoot,
        timeout: 60000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      return { name: "DOCS", passed: true, message: "Documentation auto-fixed" };
    } catch {
      return { name: "DOCS", passed: false, message: `Documentation sync failed (auto-fix attempted): ${String(detail).slice(0, 300)}` };
    }
  }
}

// ── Verification Record ────────────────────────────────────────────────────

export interface VerificationRecord {
  planId: string;
  baseCommit: string; // contexto/depuração — NÃO usar para validar (auto-referência impossível)
  diffHash: string;   // ancoragem real: sha256 do diff de código no momento da verificação
  checks: CompletionCheck[];
  passed: boolean;
  timestamp: string;
}

// Exclui os próprios arquivos de governança de plano do escopo do hash —
// senão o .verification.json cairia no mesmo problema de auto-referência
// um nível abaixo (não pode atestar um conteúdo que inclui a si mesmo).
function computeDiffHash(projectRoot: string): string {
  try {
    const diffOutput = execSync(`git diff HEAD -- . ':!.shitenno/governance/plans'`, {
      cwd: projectRoot,
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
    });
    return createHash("sha256").update(diffOutput).digest("hex");
  } catch {
    // git diff unavailable (e.g. empty repo, no HEAD) — return a sentinel hash
    return createHash("sha256").update("no-diff-available").digest("hex");
  }
}

export function runAutoVerification(
  shitennoDir: string,
  projectRoot: string,
  planId: string
): VerificationRecord {
  const checks = [
    checkBuild(projectRoot),
    checkTests(projectRoot),
    checkLint(projectRoot),
    checkGateIntegrity(projectRoot),
    checkDocumentation(projectRoot),
  ];
  const passed = checks.every((c) => c.passed);
  let baseCommit = "unknown";
  try {
    baseCommit = execSync("git rev-parse HEAD", { cwd: projectRoot, encoding: "utf-8", timeout: 5000 }).trim();
  } catch { /* not in a git repo or git unavailable */ }
  const diffHash = computeDiffHash(projectRoot);

  const record: VerificationRecord = {
    planId,
    baseCommit,
    diffHash,
    checks,
    passed,
    timestamp: new Date().toISOString(),
  };

  const engine = new MarkdownPlanEngine(shitennoDir);
  const plansDir = join(shitennoDir, "governance", "plans");

  if (passed) {
    // Grava o sidecar ANTES de mudar o status.
    // updateStatus(id, "done") move o .md sincronamente dentro dela mesma
    // (markdown-plan-engine.ts) — se o .verification.json for escrito
    // depois dessa chamada, o .md já não está mais em plansDir, e o sidecar
    // fica órfão, nunca migra para done/.
    writeFileSync(
      join(plansDir, `${planId}.verification.json`),
      JSON.stringify(record, null, 2),
      "utf-8"
    );
    engine.updateStatus(planId, "done"); // moveToDone() arrasta o sidecar junto
  } else {
    engine.updateStatus(planId, "refused");
    const failedChecks = checks.filter((c) => !c.passed).map((c) => `${c.name}: ${c.message}`).join("; ");
    logger.warn("plan-lifecycle", `Plan ${planId} refused — ${failedChecks}`);
  }

  return record;
}

// ── Archive / Remove Plan ──────────────────────────────────────────────────

export function archivePlan(shitennoDir: string, planId: string, validation?: ValidationResult): boolean {
  try {
    const engine = new MarkdownPlanEngine(shitennoDir);

    if (validation) {
      const plansDir = join(shitennoDir, "governance", "plans");
      let baseCommit = "unknown";
      try {
        baseCommit = execSync("git rev-parse HEAD", { cwd: shitennoDir, encoding: "utf-8", timeout: 5000 }).trim();
      } catch { /* not a git repo */ }
      let diffHash = "unknown";
      try {
        diffHash = computeDiffHash(join(shitennoDir, ".."));
      } catch { /* git diff not available */ }

      writeFileSync(
        join(plansDir, `${planId}.verification.json`),
        JSON.stringify(
          { planId, baseCommit, diffHash, checks: validation.checks, passed: validation.valid, timestamp: new Date().toISOString() },
          null, 2
        ),
        "utf-8"
      );
    }

    engine.updateStatus(planId, "done");
    return true;
  } catch (error) {
    // Não engolir o motivo real — os chamadores (md-done.ts,
    // runLifecycleReview) já têm try/catch próprio que exibe
    // error.message; só precisamos parar de esconder.
    logger.warn(
      "plan-lifecycle",
      `archivePlan failed for ${planId}: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

export function removePlan(shitennoDir: string, planId: string, validation?: ValidationResult): boolean {
  try {
    return archivePlan(shitennoDir, planId, validation);
  } catch (error) {
    logger.warn(
      "plan-lifecycle",
      `removePlan failed for ${planId}: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

// ── Interactive Review ─────────────────────────────────────────────────────

function askQuestion(query: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function printInference(inf: PlanInference): void {
  const icon =
    inf.inferredStatus === "done" ? "✅" :
    inf.inferredStatus === "obsolete" ? "🗄️" :
    inf.inferredStatus === "inconsistent" ? "⚠️" :
    inf.inferredStatus === "paused" ? "⏸️" : "🔄";

  output(`  ${icon} ${chalk.bold(inf.id)}`);
  output(`     Title: ${inf.title}`);
  output(`     Status: ${inf.rawStatus} → inferred: ${chalk.bold(inf.inferredStatus)}`);

  if (inf.checkboxes.total > 0) {
    output(`     Checkboxes: ${inf.checkboxes.closed}/${inf.checkboxes.total} (${inf.checkboxes.percentage}%)`);
  } else {
    output(`     Checkboxes: none (design document)`);
  }

  output(`     Age: ${inf.ageInDays} day(s)`);
  if (inf.estado) {
    output(`     Estado: ${inf.estado}`);
  }
  output(`     🤖 Recommendation: ${chalk.bold(inf.recommendation)} — ${inf.reason}`);
  outputBlank();
}

interface LifecycleActionContext {
  inf: PlanInference;
  validation: ValidationResult;
  options: { dry?: boolean };
  shitennoDir: string;
  result: LifecycleResult;
}

function executePlanAction(
  action: "archive" | "remove",
  ctx: LifecycleActionContext,
): void {
  if (ctx.options.dry) {
    output(chalk.dim(`  [DRY RUN] Would ${action}: ${ctx.inf.id} → done/`));
    return;
  }
  try {
    if (action === "archive") {
      archivePlan(ctx.shitennoDir, ctx.inf.id, ctx.validation);
      output(chalk.green(`  ✓ Plan archived: ${ctx.inf.id} → done/`));
      ctx.result.archived++;
    } else {
      removePlan(ctx.shitennoDir, ctx.inf.id, ctx.validation);
      output(chalk.green(`  ✓ Plan removed: ${ctx.inf.id} → done/`));
      ctx.result.removed++;
    }
  } catch (error) {
    output(chalk.red(`  ✗ Failed: ${error instanceof Error ? error.message : String(error)}`));
    ctx.result.skipped++;
  }
}

function handleAutoMode(ctx: LifecycleActionContext): boolean {
  const action = ctx.inf.recommendation;
  if (action !== "archive" && action !== "remove") {
    output(chalk.dim(`  Kept: ${ctx.inf.id} (${ctx.inf.reason})`));
    outputBlank();
    ctx.result.skipped++;
    return true;
  }

  if (ctx.options.dry) {
    output(chalk.dim(`  [DRY RUN] Would ${action}: ${ctx.inf.id} → done/`));
    outputBlank();
    return true;
  }

  try {
    archivePlan(ctx.shitennoDir, ctx.inf.id, ctx.validation);
    output(chalk.green(`  ✓ Plan ${action}d: ${ctx.inf.id} → done/`));
    outputBlank();
    if (action === "archive") ctx.result.archived++;
    else ctx.result.removed++;
  } catch (error) {
    output(chalk.red(`  ✗ Failed: ${error instanceof Error ? error.message : String(error)}`));
    outputBlank();
    ctx.result.skipped++;
  }
  return true;
}

async function handleInteractiveMode(ctx: LifecycleActionContext): Promise<void> {
  const answer = await askQuestion(
    `  [A] Archive as done / [S] Skip / [M] Keep active / [R] Remove: `
  );

  switch (answer) {
    case "a":
      executePlanAction("archive", ctx);
      break;
    case "r":
      executePlanAction("remove", ctx);
      break;
    case "m":
      output(chalk.dim(`  Kept: ${ctx.inf.id}`));
      ctx.result.skipped++;
      break;
    default:
      output(chalk.dim(`  Skipped: ${ctx.inf.id}`));
      ctx.result.skipped++;
      break;
  }
  outputBlank();
}

// ── Main Lifecycle Flow ────────────────────────────────────────────────────

export async function runLifecycleReview(
  projectRoot: string,
  options: { auto?: boolean; dry?: boolean } = {}
): Promise<LifecycleResult> {
  const shitennoDir = join(projectRoot, SHITENNO_DIR_NAME);
  const result: LifecycleResult = { active: 0, archived: 0, removed: 0, skipped: 0 };

  outputBlank();
  output(chalk.bold.cyan("🔍 PLAN LIFECYCLE — Checking active plans"));
  outputBlank();

  const inferenceEngine = new InferenceEngine(shitennoDir);
  const summary = inferenceEngine.generateSummary();

  if (summary.totalPlans === 0) {
    output(chalk.green("  No active plans found. All archived."));
    outputBlank();
    return result;
  }

  result.active = summary.totalPlans;
  output(`  ${chalk.bold(String(summary.totalPlans))} active plan(s):`);
  outputBlank();
  for (const inf of summary.plans) printInference(inf);

  for (const inf of summary.plans) {
    const plan = detectActivePlans(shitennoDir).find((p) => p.id === inf.id);
    if (!plan) continue;

    output(chalk.bold(`  🔧 Validating: ${inf.id}`));
    const validation = await runValidationWithProgress(plan, projectRoot);
    outputBlank();

    if (!validation.valid) {
      output(chalk.yellow("  ⚠️  Technical checks failed. Skipping."));
      outputBlank();
      result.skipped++;
      continue;
    }

    if (options.auto) {
      handleAutoMode({ inf, validation, options, shitennoDir, result });
    } else {
      await handleInteractiveMode({ inf, validation, options, shitennoDir, result });
    }
  }

  output(chalk.bold("  ── Summary ──"));
  output(`  Active:   ${result.active}`);
  output(`  Archived: ${chalk.green(String(result.archived))}`);
  output(`  Removed:  ${chalk.red(String(result.removed))}`);
  output(`  Skipped:  ${chalk.yellow(String(result.skipped))}`);
  outputBlank();

  return result;
}

// ── Lightweight Archive (for git hooks) ───────────────────────────────────

/**
 * Lightweight check: scan all active plans and archive any with Status: Done.
 * No user interaction, no validation — just file move + event publish.
 * Used by: shugo detect --auto (post-commit hook).
 *
 * This function is idempotent: plans already in done/ are skipped.
 */
export function checkAndArchiveDonePlans(shitennoDir: string): { checked: number; archived: number; archivedIds: string[] } {
  const engine = new MarkdownPlanEngine(shitennoDir);
  const archivedIds: string[] = [];
  let checked = 0;
  let archived = 0;

  for (const plan of engine.listAll()) {
    if (!plan.isActive) continue;
    checked++;
    try {
      if (engine.archiveIfDone(plan.id)) {
        archived++;
        archivedIds.push(plan.id);
      }
    } catch {
      logger.debug("plan-lifecycle", `Skipping plan ${plan.id} that failed archival check`);
    }
  }

  return { checked, archived, archivedIds };
}
