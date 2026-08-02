/**
 * Audit module — Git Intelligence detectors
 *
 * Detectors that analyse git history, branches, and commit patterns
 * to enforce governance rules (COMMIT-POLICY, BRANCH-POLICY, AGENTS.md).
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { HealthIssue } from "./types.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function runGit(projectRoot: string, args: string): string | null {
  try {
    return execSync(`git ${args}`, {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 15_000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function getRecentCommits(projectRoot: string, count = 50): string[] {
  const output = runGit(projectRoot, `log --format="%H|||%s|||%an|||%ae" -n ${count}`);
  if (!output) return [];
  return output.split("\n").filter((line) => line.length > 0);
}

// ── 1.1 Commit Format (Conventional Commits) ────────────────────────────────

const CONVENTIONAL_COMMIT_REGEX =
  /^(feat|fix|chore|docs|refactor|test|perf|style|ci|build|revert)(\(.+\))?!?:\s.{1,72}/;

export function detectCommitFormat(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const commits = getRecentCommits(projectRoot, 100);

  const invalidCommits: string[] = [];
  for (const commit of commits) {
    const parts = commit.split("|||");
    const message = parts[1];
    if (!message) continue;

    if (!CONVENTIONAL_COMMIT_REGEX.test(message)) {
      invalidCommits.push(message.slice(0, 60));
    }
  }

  if (invalidCommits.length > 0) {
    issues.push({
      type: "commit_format_violation",
      severity: 2,
      description: `${invalidCommits.length} commit(s) não seguem Conventional Commits: ${invalidCommits.slice(0, 3).join("; ")}${invalidCommits.length > 3 ? ` (+${invalidCommits.length - 3})` : ""}`,
      location: "git log",
      recommendation: "Formato correcto: type(scope): description (ex: feat: add user auth). Usar commitlint no CI.",
      confidence: 0.9,
    });
  }

  return issues;
}

// ── 1.2 Branch Naming Convention ────────────────────────────────────────────

const VALID_BRANCH_PREFIXES = ["feat/", "fix/", "chore/", "docs/", "refactor/", "hotfix/", "release/", "main", "develop"];

export function detectBranchNaming(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const output = runGit(projectRoot, "branch --format=%(refname:short)");
  if (!output) return issues;

  const branches = output.split("\n").filter((b) => b.length > 0);
  const invalidBranches: string[] = [];

  for (const branch of branches) {
    const trimmed = branch.trim();
    if (trimmed === "main" || trimmed === "develop" || trimmed === "HEAD") continue;
    if (VALID_BRANCH_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) continue;
    if (trimmed.startsWith("origin/")) continue;
    invalidBranches.push(trimmed);
  }

  if (invalidBranches.length > 0) {
    issues.push({
      type: "branch_naming_violation",
      severity: 1,
      description: `${invalidBranches.length} branch(es) não seguem convenção de nomenclatura: ${invalidBranches.slice(0, 5).join(", ")}`,
      location: "git branches",
      recommendation: "Usar formato: feat/<scope>, fix/<scope>, chore/<scope>, docs/<scope>, refactor/<scope>",
      confidence: 0.9,
    });
  }

  return issues;
}

// ── 1.3 Direct Commits to Protected Branches ───────────────────────────────

export function detectDirectMainCommits(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

  const output = runGit(projectRoot, "log main --oneline -n 20");
  if (!output) return issues;

  const lines = output.split("\n").filter((l) => l.length > 0);
  const mergeCommits = lines.filter((l) => l.includes("Merge "));
  const directCommits = lines.length - mergeCommits.length;

  if (directCommits > 5) {
    issues.push({
      type: "direct_main_commits",
      severity: 2,
      description: `${directCommits} commits directos em main (não merges) — viola BRANCH-POLICY`,
      location: "git log main",
      recommendation: "Usar pull requests para alterações em main. Merger apenas via release de develop.",
      confidence: 0.9,
    });
  }

  return issues;
}

// ── 1.4 Force Pushes ───────────────────────────────────────────────────────

export function detectForcePushes(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const output = runGit(projectRoot, 'reflog --oneline -n 100 --grep="forcing"');
  if (!output) return issues;

  const forcePushes = output.split("\n").filter((l) => l.length > 0);
  if (forcePushes.length > 0) {
    issues.push({
      type: "force_push_detected",
      severity: 2,
      description: `${forcePushes.length} force push(es) detectado(s) no reflog — usar --force-with-lease`,
      location: "git reflog",
      recommendation: "Substituir 'git push --force' por 'git push --force-with-lease' para segurança.",
      confidence: 0.9,
    });
  }

  return issues;
}

// ── 1.5 Orphan Branches (merged but not deleted) ───────────────────────────

export function detectOrphanBranches(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const output = runGit(projectRoot, "branch --merged develop --format=%(refname:short)");
  if (!output) return issues;

  const mergedBranches = output
    .split("\n")
    .map((b) => b.trim())
    .filter((b) => b.length > 0 && b !== "main" && b !== "develop" && !b.startsWith("origin/"));

  if (mergedBranches.length > 3) {
    issues.push({
      type: "orphan_branches",
      severity: 1,
      description: `${mergedBranches.length} branches merged mas não deletadas: ${mergedBranches.slice(0, 5).join(", ")}`,
      location: "git branches",
      recommendation: "Deletar branches após merge: git branch -d <branch> ou git branch -D <branch> (remote).",
      confidence: 0.9,
    });
  }

  return issues;
}

// ── 1.6 Non-English Commit Messages ────────────────────────────────────────

const NON_ENGLISH_PATTERNS = [
  /[áàâãéêíóôõúç]/i, // Portuguese accented chars
  /[ñ]/i, // Spanish
  /[äöüß]/i, // German
  /[éèêëïîôù]/i, // French
];

export function detectCommitLanguage(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const commits = getRecentCommits(projectRoot, 50);

  const nonEnglish: string[] = [];
  for (const commit of commits) {
    const parts = commit.split("|||");
    const message = parts[1];
    if (!message) continue;

    const isNonEnglish = NON_ENGLISH_PATTERNS.some((p) => p.test(message));
    if (isNonEnglish) {
      nonEnglish.push(message.slice(0, 50));
    }
  }

  if (nonEnglish.length > 0) {
    issues.push({
      type: "non_english_commit",
      severity: 1,
      description: `${nonEnglish.length} commit(s) com mensagens não-inglesas: ${nonEnglish.slice(0, 3).join("; ")}`,
      location: "git log",
      recommendation: "Mensagens de commit devem ser em inglês (regra AGENTS.md #2).",
      confidence: 0.9,
    });
  }

  return issues;
}

// ── 1.7 Secrets in Git History ─────────────────────────────────────────────

const SECRET_PATTERNS = [
  /(?:password|passwd|pwd)\s*[=:]\s*["']?[^"'\s]{8,}/gi,
  /(?:api[_-]?key|apikey)\s*[=:]\s*["']?[A-Za-z0-9_\-\.]{16,}/gi,
  /(?:secret|token)\s*[=:]\s*["']?[A-Za-z0-9_\-\.]{16,}/gi,
  /(?:private[_-]?key)\s*[=:]\s*["']?[^"'\s]{16,}/gi,
  /(?:aws[_-]?access[_-]?key[_-]?id)\s*[=:]\s*["']?[A-Z0-9]{16,}/gi,
];

function scanLineForSecrets(line: string, patterns: RegExp[]): boolean {
  for (const pattern of patterns) { pattern.lastIndex = 0; if (pattern.test(line)) return true; }
  return false;
}

function parseGitLogForSecrets(output: string): { secretsFound: number; locations: string[] } {
  let secretsFound = 0;
  const locations: string[] = [];
  for (const line of output.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) continue;
    if (line.startsWith("-") && scanLineForSecrets(line, SECRET_PATTERNS)) {
      secretsFound++;
      if (locations.length < 3) locations.push(line.trim().slice(0, 60));
    }
  }
  return { secretsFound, locations };
}

export function detectSecretsInGitHistory(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const output = runGit(projectRoot, 'log --all --diff-filter=A -p -n 10 -- "*.env" "*.json" "*.yaml" "*.yml" 2>/dev/null | head -200');
  if (!output) return issues;
  const { secretsFound, locations } = parseGitLogForSecrets(output);
  if (secretsFound > 0) {
    issues.push({ type: "secret_in_git_history", severity: 3,
      description: `${secretsFound} possível(is) segredo(s) no histórico git: ${locations.join("; ")}`,
      location: "git log -p", recommendation: "Remover segredos do histórico com 'git filter-branch' ou BFG. Adicionar ao .gitignore.", confidence: 0.9 });
  }
  return issues;
}

// ── 1.8 Commits Without Gating ─────────────────────────────────────────────

export function detectCommitWithoutGating(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const hasCI = existsSync(join(projectRoot, ".github", "workflows")) ||
    existsSync(join(projectRoot, ".gitlab-ci.yml")) ||
    existsSync(join(projectRoot, "Jenkinsfile"));
  const hasLintConfig = existsSync(join(projectRoot, ".eslintrc.js")) ||
    existsSync(join(projectRoot, ".eslintrc.json")) ||
    existsSync(join(projectRoot, "eslint.config.js")) ||
    existsSync(join(projectRoot, "eslint.config.mjs"));

  if (!hasCI && !hasLintConfig) {
    issues.push({
      type: "missing_quality_gates",
      severity: 2,
      description: "Nenhum CI/CD nem configuração de lint detectada — commits não têm quality gates",
      location: "project root",
      recommendation: "Adicionar .github/workflows/ci.yml com test + lint + typecheck antes de merge.",
      confidence: 0.95,
    });
  }

  return issues;
}
