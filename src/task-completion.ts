import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, relative, resolve } from "node:path";
import { matchesTaskId } from "./id-matcher.js";
import { checkTests, checkLint } from "./plan-lifecycle.js";
import { resolveBacklogPaths } from "./backlog-core.js";

export interface CompletionGate {
  name: string;
  passed: boolean;
  message: string;
}

export interface CompletionResult {
  taskId: string;
  passed: boolean;
  gates: CompletionGate[];
}

export interface CompletionGateOptions {
  projectRoot: string;
  shitennoDir: string;
  affectedFiles?: string[];
  taskId: string;
  /** Optional exec function override (for testing) */
  execFn?: typeof execSync;
}

export function validateCompletionGate(
  options: CompletionGateOptions
): CompletionResult {
  const execFn = options.execFn ?? execSync;
  const gates: CompletionGate[] = [];

  gates.push(checkTestPass(options.projectRoot));
  gates.push(checkLintPass(options.projectRoot));
  gates.push(checkDocumentationUpdated(options.projectRoot, options.shitennoDir, execFn, options.affectedFiles));
  gates.push(checkBacklogUpdated(options.shitennoDir, options.taskId));
  gates.push(checkPlanStatus(options.shitennoDir, options.taskId));

  const allPassed = gates.every((g) => g.passed);

  return {
    taskId: options.taskId,
    passed: allPassed,
    gates,
  };
}

function checkTestPass(projectRoot: string): CompletionGate {
  const result = checkTests(projectRoot);
  return { name: "tests", passed: result.passed, message: result.message };
}

function checkLintPass(projectRoot: string): CompletionGate {
  const result = checkLint(projectRoot);
  return { name: "lint", passed: result.passed, message: result.message };
}

function getModifiedFiles(projectRoot: string, execFn: typeof execSync): string[] {
  const diffOutput = execFn("git diff --name-only --diff-filter=M 2>/dev/null", {
    cwd: projectRoot, timeout: 10000, encoding: "utf-8",
  });
  const stagedOutput = execFn("git diff --cached --name-only 2>/dev/null", {
    cwd: projectRoot, timeout: 10000, encoding: "utf-8",
  });
  return [
    ...diffOutput.trim().split("\n").filter(Boolean),
    ...stagedOutput.trim().split("\n").filter(Boolean),
  ];
}

function isDocFile(f: string): boolean {
  return f.endsWith(".md") || f.includes("docs/") || f.includes("README");
}

function checkDocumentationUpdated(
  projectRoot: string,
  _shitennoDir: string,
  execFn: typeof execSync,
  affectedFiles?: string[]
): CompletionGate {
  if (!affectedFiles || affectedFiles.length === 0) {
    return { name: "documentation", passed: true, message: "No affected files specified — skipping documentation check" };
  }

  try {
    const modifiedFiles = getModifiedFiles(projectRoot, execFn);
    const docFiles = affectedFiles.filter(isDocFile);

    if (docFiles.length === 0) {
      return { name: "documentation", passed: true, message: "No documentation files affected — skipping" };
    }

    const normalize = (p: string) => relative(projectRoot, resolve(projectRoot, p));
    const normalizedModified = new Set(modifiedFiles.map(normalize));
    const missing = docFiles.filter((f) => !normalizedModified.has(normalize(f)));

    if (missing.length === 0) {
      return { name: "documentation", passed: true, message: `All ${docFiles.length} documentation file(s) updated` };
    }

    return { name: "documentation", passed: false, message: `Documentation not updated: ${missing.join(", ")}` };
  } catch {
    return { name: "documentation", passed: true, message: "Could not check documentation (no git history) — skipping" };
  }
}

function checkBacklogUpdated(shitennoDir: string, taskId: string): CompletionGate {
  const { active: backlogPath } = resolveBacklogPaths(shitennoDir);

  if (existsSync(backlogPath)) {
    const content = readFileSync(backlogPath, "utf-8");
    const pattern = `### ${taskId}`;
    const idx = content.indexOf(pattern);
    if (idx === -1) {
      // Task not found - skip check (backwards compatible)
      return {
        name: "backlog",
        passed: true,
        message: `Task ${taskId} not found in backlog — skipping`,
      };
    }

    const nextHeadingIdx = content.indexOf("\n### ", idx + pattern.length);
    const section = nextHeadingIdx === -1
      ? content.slice(idx)
      : content.slice(idx, nextHeadingIdx);
    if (section.includes("Done") || section.includes("concluído") || section.includes("concluido")) {
      return {
        name: "backlog",
        passed: true,
        message: `Task ${taskId} marked as Done in backlog`,
      };
    }
    return {
      name: "backlog",
      passed: false,
      message: `Task ${taskId} found but not marked as Done in backlog`,
    };
  }

  return {
    name: "backlog",
    passed: true,
    message: "No backlog found — skipping",
  };
}

function getPlansDir(shitennoDir: string): string {
  return join(shitennoDir, "governance", "plans");
}

function findMatchingPlan(plansDir: string, taskId: string): string | null {
  try {
    const files = readdirSync(plansDir).filter(
      (f: string) => f.endsWith(".md") && !f.startsWith("TEMPLATE")
    );
    return files.find((f: string) => {
      const id = f.replace(".md", "").toLowerCase();
      return matchesTaskId(id, taskId.toLowerCase());
    }) ?? null;
  } catch {
    return null;
  }
}

function readPlanStatus(plansDir: string, planFile: string): { raw: string; lowered: string } | null {
  const content = readFileSync(join(plansDir, planFile), "utf-8");
  const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/i);
  if (!statusMatch) return null;
  const raw = (statusMatch[1] || "").trim();
  return { raw, lowered: raw.toLowerCase() };
}

function checkPlanStatus(shitennoDir: string, taskId: string): CompletionGate {
  const plansDir = getPlansDir(shitennoDir);
  if (!existsSync(plansDir)) {
    return { name: "plan_status", passed: true, message: "No plans directory found — skipping" };
  }

  const matchingPlan = findMatchingPlan(plansDir, taskId);
  if (!matchingPlan) {
    return { name: "plan_status", passed: true, message: `No active plan found for task ${taskId} — skipping` };
  }

  try {
    const status = readPlanStatus(plansDir, matchingPlan);
    if (!status) {
      return { name: "plan_status", passed: false, message: `Plan ${matchingPlan} has no status field` };
    }
    if (status.lowered === "done" || status.lowered === "concluído" || status.lowered === "concluido" || status.lowered === "checked") {
      return { name: "plan_status", passed: true, message: `Plan ${matchingPlan} status is "${status.raw}"` };
    }
    return {
      name: "plan_status", passed: false,
      message: `Plan ${matchingPlan} status is "${status.raw}" — run "shugo plan md done ${matchingPlan.replace(".md", "")}" to archive`,
    };
  } catch {
    return { name: "plan_status", passed: true, message: "Could not check plan status — skipping" };
  }
}
