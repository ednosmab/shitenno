import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import type { HealthIssue, SourceFileInfo } from "../types.js";
import { logger } from "../../logger.js";
import * as ts from "typescript";
import { getOrCreateProgram } from "../ts-program-cache.js";
import { analyzeComplexity } from "../complexity/analyzer.js";
import { COMPLEXITY_WARNING_THRESHOLD, COMPLEXITY_CRITICAL_THRESHOLD } from "../constants.js";

export function detectConsoleUsage(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  let consoleCount = 0;
  const consoleFiles: string[] = [];

  for (const file of files) {
    if (file.relPath.startsWith("src/commands/") || file.relPath.startsWith("src/console/")) continue;
    const matches = file.content.match(/console\.(log|warn|error|info|debug|trace)\(/g);
    if (matches) {
      consoleCount += matches.length;
      consoleFiles.push(file.relPath);
    }
  }

  if (consoleCount > 0) {
    issues.push({
      type: "console_log_outside_cmd",
      severity: 1,
      description: `${consoleCount} console.log/warn/error/debug/trace fora de commands/ — usar logger em vez de console`,
      location: consoleFiles.slice(0, 3).join(", ") + (consoleFiles.length > 3 ? ` (+${consoleFiles.length - 3})` : ""),
      recommendation: "Substituir console.log por logger do modulo logger.ts",
      confidence: 0.7,
    });
  }

  return issues;
}

export function detectEmptyCatchBlocks(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  for (const file of files) {
    const emptyCatchRegex = /catch\s*(?:\([^)]*\))?\s*\{\s*(?:(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/)\s*)*\}/g;
    let match;
    while ((match = emptyCatchRegex.exec(file.content)) !== null) {
      const lineNum = file.content.substring(0, match.index).split("\n").length;
      const hasComment = /\/[/*]/.test(match[0]);
      issues.push({
        type: "empty_catch",
        severity: hasComment ? 1 : 2,
        description: hasComment
          ? `Catch vazio comentado em "${file.relPath}:${lineNum}" — verificar se a omissão é intencional`
          : `Catch vazio em "${file.relPath}:${lineNum}" — erros estão silenciados`,
        location: `${file.relPath}:${lineNum}`,
        recommendation: hasComment
          ? `Confirmar se a omissão intencional em ${file.relPath}:${lineNum} — adicionar logger.debug se silenciado de propósito`
          : `Adicionar tratamento de erro ou logger.debug no catch em ${file.relPath}:${lineNum}`,
        confidence: 0.75,
      });
    }
  }
  return issues;
}

export function detectHighComplexity(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  for (const file of files) {
    if (file.relPath.includes("__tests__")) continue;
    try {
      const program = getOrCreateProgram(projectRoot);
      const sourceFile = program.getSourceFile(file.fullPath)
        ?? ts.createSourceFile(file.fullPath, file.content, ts.ScriptTarget.Latest, true);
      if (!sourceFile) continue;

      for (const result of analyzeComplexity(program, sourceFile)) {
        if (result.complexity > COMPLEXITY_WARNING_THRESHOLD) {
          issues.push({
            type: "high_complexity",
            severity: result.complexity > COMPLEXITY_CRITICAL_THRESHOLD ? 3 : 2,
            description: `Alta complexidade ciclomática em "${file.relPath}:${result.line}" (${result.functionName}): complexidade ${result.complexity} (máx: ${COMPLEXITY_WARNING_THRESHOLD})`,
            location: `${file.relPath}:${result.line}`,
            recommendation: `Considerar dividir "${result.functionName}" em funções menores`,
            confidence: 1.0,
          });
        }
      }
    } catch {
      // Skip files that can't be analyzed (parse errors, standalone source files, etc.)
    }
  }

  return issues;
}

function parseAndReportLintIssues(output: string, issues: HealthIssue[], hasError: boolean): void {
  try {
    const results = JSON.parse(output) as Array<{ errorCount: number; warningCount: number }>;
    let totalErrors = 0, totalWarnings = 0;
    for (const r of results) { totalErrors += r.errorCount || 0; totalWarnings += r.warningCount || 0; }
    if (hasError && totalErrors > 0) {
      issues.push({ type: "lint_error", severity: 2, description: `ESLint encontrou ${totalErrors} erro(s) e ${totalWarnings} warning(s)`, location: "src/", recommendation: "Corrigir erros ESLint — execute 'npx eslint src/ --fix' para correcoes automaticas", confidence: 0.95 });
    } else if (totalWarnings > 0) {
      issues.push({ type: "lint_error", severity: 1, description: `ESLint encontrou ${totalWarnings} warning(s) (0 erros)`, location: "src/", recommendation: "Rever warnings ESLint — execute 'npx eslint src/' para detalhes", confidence: 0.95 });
    }
  } catch (parseErr) { logger.debug("engineering-detectors", hasError ? "ESLint error output not JSON:" : "ESLint output not JSON:", parseErr); }
}

export function detectLintIssues(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const eslintConfigs = [".eslintrc.js", ".eslintrc.json", ".eslintrc.yml", "eslint.config.js", "eslint.config.mjs"];
  if (!eslintConfigs.some((c) => existsSync(join(projectRoot, c)))) return issues;
  try {
    const output = execSync("npx eslint src/ --format=json 2>&1", { cwd: projectRoot, encoding: "utf-8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] });
    parseAndReportLintIssues(output, issues, false);
  } catch (err: unknown) {
    const e = err as { stdout?: string };
    parseAndReportLintIssues(String(e.stdout || ""), issues, true);
  }
  return issues;
}

const CONTROL_FLOW_KEYWORDS = new Set(["if", "for", "while", "switch", "try", "catch", "else"]);
const METHOD_DECL_REGEX = /(\w+)\s*\([^)]*\)\s*\{\s*\}/g;

function scanFileForDeadCode(file: SourceFileInfo): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const lines = file.content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (trimmed.startsWith("// @ts-ignore") || trimmed.startsWith("// @ts-expect-error")) {
      issues.push({ type: "dead_code", severity: 1, description: `Type safety bypass em "${file.relPath}:${i + 1}" — ${trimmed.split(" ").slice(0, 3).join(" ")}`, location: `${file.relPath}:${i + 1}`, recommendation: `Remover "${trimmed.split(" ").slice(0, 2).join(" ")}" e corrigir o problema de tipo subjacente`, confidence: 0.6 });
    }
  }
  const emptyFuncRegex = /(?:function\s+\w+|\(\)\s*=>|=>)\s*\{\s*\}/g;
  let emptyMatch;
  while ((emptyMatch = emptyFuncRegex.exec(file.content)) !== null) {
    const lineNum = file.content.substring(0, emptyMatch.index).split("\n").length;
    issues.push({ type: "dead_code", severity: 1, description: `Função vazia em "${file.relPath}:${lineNum}" — corpo sem implementação`, location: `${file.relPath}:${lineNum}`, recommendation: `Implementar a função em ${file.relPath}:${lineNum} ou removê-la se desnecessária`, confidence: 0.6 });
  }
  METHOD_DECL_REGEX.lastIndex = 0;
  let methodMatch;
  while ((methodMatch = METHOD_DECL_REGEX.exec(file.content)) !== null) {
    const name = methodMatch[1];
    if (!name || CONTROL_FLOW_KEYWORDS.has(name)) continue;
    const lineNum = file.content.substring(0, methodMatch.index).split("\n").length;
    issues.push({ type: "dead_code", severity: 1, description: `Método vazio em "${file.relPath}:${lineNum}" — corpo sem implementação`, location: `${file.relPath}:${lineNum}`, recommendation: `Implementar o método em ${file.relPath}:${lineNum} ou removê-lo se desnecessário`, confidence: 0.6 });
  }
  let todoCount = 0;
  for (let i = 0; i < lines.length && todoCount < 5; i++) {
    const trimmed = lines[i]!.trim();
    const todoMatch = trimmed.match(/(?:TODO|FIXME|HACK|XXX)[:\s]*(.*)/);
    if (todoMatch) { issues.push({ type: "dead_code", severity: 1, description: `Código pendente em "${file.relPath}:${i + 1}" — ${todoMatch[0].slice(0, 60)}`, location: `${file.relPath}:${i + 1}`, recommendation: `Resolver o TODO/FIXME em ${file.relPath}:${i + 1} ou removê-lo se já resolvido`, confidence: 0.6 }); todoCount++; }
  }
  return issues;
}

export function detectDeadCodePatterns(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  for (const file of files) issues.push(...scanFileForDeadCode(file));
  return issues;
}
